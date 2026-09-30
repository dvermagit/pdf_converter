import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Template } from '../models/Template.js';
import { Campaign } from '../models/Campaign.js';
import {
  TEMPLATE_PRESETS,
  SUPPORTED_PLACEHOLDERS,
  renderTemplate,
} from '../services/templateService.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const router = Router();

const templateBodySchema = z.object({
  name: z.string().min(1, 'Template name is required').max(120),
  occasion: z.string().max(60).optional(),
  description: z.string().max(400).optional(),
  messageBody: z.string().min(1, 'Message body is required').max(4000),
  eventDate: z.string().optional().nullable(),
  defaultSendTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Send time must be in HH:mm format')
    .optional(),
  timezone: z.string().optional(),
  emoji: z.string().max(8).optional(),
  // Link to the approved template registered with Meta. Business-initiated
  // messages can only go out through one of these.
  meta: z
    .object({
      templateName: z
        .string()
        .min(1)
        .max(512)
        // Meta's own constraint: lowercase letters, digits and underscores.
        .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers and underscores only'),
      languageCode: z.string().min(2).max(10).default('en'),
      category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).default('MARKETING'),
      status: z
        .enum(['not_submitted', 'pending', 'approved', 'rejected'])
        .default('not_submitted'),
      headerType: z.enum(['none', 'document', 'text', 'image']).default('none'),
      bodyParameters: z.array(z.string()).default([]),
    })
    .optional()
    .nullable(),
});

function parseEventDate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

// GET /api/templates/presets — built-in starter templates
router.get('/presets', (_req: Request, res: Response) => {
  res.json({ presets: TEMPLATE_PRESETS, placeholders: SUPPORTED_PLACEHOLDERS });
});

// GET /api/templates — list templates for current user
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const occasion = req.query.occasion as string | undefined;
    const search = (req.query.search as string | undefined)?.trim();

    const filter: Record<string, unknown> = { createdBy: req.user!.userId };
    if (occasion) filter.occasion = occasion;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const [templates, total] = await Promise.all([
      Template.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Template.countDocuments(filter),
    ]);

    res.json({
      templates,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error({ error }, 'List templates failed');
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

// POST /api/templates — create a template (optionally seeded from a preset)
router.post('/', async (req: Request, res: Response) => {
  try {
    const presetKey = req.body.presetKey as string | undefined;
    const preset = presetKey
      ? TEMPLATE_PRESETS.find((p) => p.key === presetKey)
      : undefined;

    if (presetKey && !preset) {
      res.status(400).json({ error: `Unknown preset: ${presetKey}` });
      return;
    }

    const merged = {
      name: req.body.name ?? preset?.name,
      occasion: req.body.occasion ?? preset?.occasion,
      description: req.body.description ?? preset?.description,
      messageBody: req.body.messageBody ?? preset?.messageBody,
      eventDate: req.body.eventDate,
      defaultSendTime: req.body.defaultSendTime ?? preset?.defaultSendTime,
      timezone: req.body.timezone ?? env.DEFAULT_CAMPAIGN_TIMEZONE,
      emoji: req.body.emoji ?? preset?.emoji,
      meta: req.body.meta,
    };

    const parsed = templateBodySchema.safeParse(merged);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid template',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const template = await Template.create({
      ...parsed.data,
      eventDate: parseEventDate(parsed.data.eventDate),
      meta: parsed.data.meta ?? undefined,
      createdBy: req.user!.userId,
    });

    logger.info({ templateId: template._id, name: template.name }, 'Template created');
    res.status(201).json({ template: template.toJSON() });
  } catch (error) {
    logger.error({ error }, 'Create template failed');
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// POST /api/templates/preview — render a message body with sample values
router.post('/preview', (req: Request, res: Response) => {
  const { messageBody, name, phone, eventName, eventDate, dob, timezone } = req.body;

  if (typeof messageBody !== 'string') {
    res.status(400).json({ error: 'messageBody is required' });
    return;
  }

  const rendered = renderTemplate(messageBody, {
    name: name || 'Priya Sharma',
    phone: phone || '+919876543210',
    eventName: eventName || '',
    eventDate: eventDate ? new Date(eventDate) : null,
    dob: dob ? new Date(dob) : null,
    timezone: timezone || env.DEFAULT_CAMPAIGN_TIMEZONE,
  });

  res.json({ rendered });
});

// GET /api/templates/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      createdBy: req.user!.userId,
    });

    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    res.json({ template });
  } catch (error) {
    logger.error({ error }, 'Get template failed');
    res.status(500).json({ error: 'Failed to get template' });
  }
});

// PATCH /api/templates/:id — update a template
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      createdBy: req.user!.userId,
    });

    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const parsed = templateBodySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid template',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { eventDate, meta, ...rest } = parsed.data;
    Object.assign(template, rest);

    if (eventDate !== undefined) {
      template.eventDate = parseEventDate(eventDate);
    }

    // `null` unlinks the Meta template and drops the campaign back to free-form.
    if (meta !== undefined) {
      template.meta = meta ?? undefined;
    }

    await template.save();
    res.json({ template: template.toJSON() });
  } catch (error) {
    logger.error({ error }, 'Update template failed');
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const template = await Template.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user!.userId,
    });

    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    // Campaigns keep their copied message; just drop the dangling reference.
    await Campaign.updateMany({ templateId: template._id }, { $unset: { templateId: '' } });

    logger.info({ templateId: template._id }, 'Template deleted');
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Delete template failed');
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
