import { Router, Request, Response } from 'express';
import { Campaign, ICampaign } from '../models/Campaign.js';
import { Recipient, IRecipient } from '../models/Recipient.js';
import { Template } from '../models/Template.js';
import type { IMetaTemplate } from '../models/Template.js';
import { validateExcel, getPreviewRows } from '../services/excelValidator.js';
import { generateRecipientExcel } from '../services/excelGenerator.js';
import {
  scheduleDelivery,
  cancelCampaignJobs,
  cancelRecipientJobs,
} from '../services/schedulerService.js';
import { getGeneratedDir } from '../services/storageService.js';
import { uploadContactsExcel } from '../middleware/upload.js';
import { importContactsFromExcel } from '../services/contactImportService.js';
import {
  prepareManualRecipients,
  ManualRecipientInput,
  PreparedRecipient,
} from '../services/manualRecipientService.js';
import {
  zonedTimeToUtc,
  combineDateAndTime,
  expandDailyRange,
} from '../services/templateService.js';
import type { IRecurrence } from '../models/Campaign.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { Types } from 'mongoose';

const router = Router();

/**
 * Build the personalised workbook for a recipient and queue its delivery job.
 *
 * `fileCache` lets a caller share one workbook across a person's repeat sends —
 * on a daily range the contents are identical every day, so generating one file
 * per send would write hundreds of duplicates.
 */
async function generateAndSchedule(
  campaign: ICampaign,
  recipient: IRecipient,
  fileCache?: Map<string, string>
): Promise<void> {
  const cached = fileCache?.get(recipient.phoneNumber);

  const filePath =
    cached ??
    (await generateRecipientExcel(
      {
        recipientName: recipient.recipientName,
        phoneNumber: recipient.phoneNumber,
        dateOfBirth: recipient.dateOfBirth,
        message: recipient.message,
        extraColumns: {},
      },
      campaign.name,
      campaign.selectedOutputColumns || [],
      getGeneratedDir(),
      campaign.columnMapping
    ));

  fileCache?.set(recipient.phoneNumber, filePath);

  recipient.generatedFilePath = filePath;
  recipient.status = 'queued';
  await recipient.save();

  await scheduleDelivery(
    recipient._id as Types.ObjectId,
    campaign._id as Types.ObjectId,
    recipient.scheduledAt
  );
}


/**
 * A template can only drive a Meta send once its Meta counterpart is approved.
 * Anything else falls back to the free-form path, which works against the test
 * number during development.
 */
function approvedMetaTemplate(template: { meta?: IMetaTemplate } | null) {
  const meta = template?.meta;
  if (!meta?.templateName || meta.status !== 'approved') return null;
  return meta;
}

/**
 * Read a daily-range request ("send every day from X to Y at HH:mm") and expand
 * it into one instant per day. Returns nothing when the request isn't a range.
 */
function resolveRecurrence(
  body: Record<string, unknown>,
  timezone: string
): { recurrence?: IRecurrence; occurrences?: Date[]; error?: string } {
  const repeat = body.repeat as
    | { mode?: string; startDate?: string; endDate?: string; time?: string }
    | undefined;

  if (!repeat || !repeat.mode || repeat.mode === 'none') return {};

  if (repeat.mode !== 'daily') {
    return { error: `Unsupported repeat mode: ${repeat.mode}` };
  }

  const recurrence: IRecurrence = {
    mode: 'daily',
    startDate: (repeat.startDate || '').slice(0, 10),
    endDate: (repeat.endDate || '').slice(0, 10),
    time: repeat.time || '10:00',
  };

  const { occurrences, error } = expandDailyRange(recurrence, timezone);
  if (error) return { error };

  return { recurrence, occurrences };
}

/**
 * Work out the campaign-wide default send time from the request body:
 * an explicit local datetime, a template's event date + time, or "send now".
 */
function resolveDefaultScheduledAt(
  body: Record<string, unknown>,
  timezone: string
): { date: Date | null; reason?: string } {
  if (body.sendNow === true) {
    // A small lead time keeps the job from firing before its row is committed.
    return { date: new Date(Date.now() + 60 * 1000) };
  }

  if (typeof body.scheduledAt === 'string' && body.scheduledAt.trim()) {
    const parsed = zonedTimeToUtc(body.scheduledAt, timezone);
    return parsed
      ? { date: parsed }
      : { date: null, reason: 'Invalid scheduled date/time' };
  }

  if (typeof body.eventDate === 'string' && body.eventDate.trim()) {
    const time = typeof body.sendTime === 'string' ? body.sendTime : '10:00';
    const parsed = combineDateAndTime(body.eventDate, time, timezone);
    return parsed ? { date: parsed } : { date: null, reason: 'Invalid event date' };
  }

  return { date: null, reason: 'A scheduled date/time is required' };
}

// GET /api/campaigns — List campaigns for current user
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    const filter: Record<string, unknown> = { createdBy: req.user!.userId };
    if (status) filter.status = status;

    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Campaign.countDocuments(filter),
    ]);

    res.json({
      campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error({ error }, 'List campaigns failed');
    res.status(500).json({ error: 'Failed to list campaigns' });
  }
});

// POST /api/campaigns/manual — Create a campaign from the form (no Excel upload)
router.post('/manual', async (req: Request, res: Response) => {
  try {
    const {
      name,
      templateId,
      message,
      eventName,
      recipients: rawRecipients,
      startNow,
    } = req.body;

    const timezone = req.body.timezone || env.DEFAULT_CAMPAIGN_TIMEZONE;

    if (!name || !String(name).trim()) {
      res.status(400).json({ error: 'Campaign name is required' });
      return;
    }

    if (!Array.isArray(rawRecipients) || rawRecipients.length === 0) {
      res.status(400).json({ error: 'Add at least one recipient' });
      return;
    }

    // A template supplies the message body and, unless overridden, the send time.
    let template = null;
    if (templateId) {
      template = await Template.findOne({
        _id: templateId,
        createdBy: req.user!.userId,
      });

      if (!template) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }
    }

    const messageBody = (message && String(message).trim()) || template?.messageBody || '';
    if (!messageBody) {
      res.status(400).json({
        error: 'A message is required — pick a template or type a message',
      });
      return;
    }

    const eventDate = req.body.eventDate
      ? new Date(req.body.eventDate)
      : template?.eventDate ?? null;

    const scheduleBody = {
      ...req.body,
      eventDate: req.body.eventDate ?? template?.eventDate?.toISOString().slice(0, 10),
      sendTime: req.body.sendTime ?? template?.defaultSendTime,
    };

    const { recurrence, occurrences, error: repeatError } = resolveRecurrence(
      req.body,
      timezone
    );

    if (repeatError) {
      res.status(400).json({ error: repeatError });
      return;
    }

    // A range supplies its own schedule; otherwise resolve the single send time.
    let defaultScheduledAt: Date;
    if (occurrences) {
      defaultScheduledAt = occurrences[0];
    } else {
      const resolved = resolveDefaultScheduledAt(scheduleBody, timezone);
      if (!resolved.date) {
        res.status(400).json({ error: resolved.reason || 'A scheduled date/time is required' });
        return;
      }
      defaultScheduledAt = resolved.date;
    }

    const metaTemplate = approvedMetaTemplate(template);

    const { recipients: prepared, errors, peopleCount, messagesPerPerson } =
      prepareManualRecipients(rawRecipients as ManualRecipientInput[], {
        timezone,
        defaultScheduledAt,
        occurrences,
        messageBody,
        metaBodyParameters: metaTemplate?.bodyParameters,
        eventName: eventName || template?.name,
        eventDate: eventDate && !isNaN(eventDate.getTime()) ? eventDate : null,
        maxRecipients: env.MAX_RECIPIENTS_PER_CAMPAIGN,
      });

    if (errors.length > 0) {
      res.status(400).json({ error: 'Some recipients are invalid', errors });
      return;
    }

    const campaign = await Campaign.create({
      name: String(name).trim(),
      source: 'manual',
      templateId: template?._id,
      messageBody,
      metaTemplate: metaTemplate
        ? {
            templateName: metaTemplate.templateName,
            languageCode: metaTemplate.languageCode,
            headerType: metaTemplate.headerType,
          }
        : undefined,
      recurrence,
      eventDate: eventDate && !isNaN(eventDate.getTime()) ? eventDate : undefined,
      originalFileName: '',
      masterFilePath: '',
      timezone,
      status: 'validated',
      totalRecipients: prepared.length,
      pending: prepared.length,
      columnMapping: {},
      selectedOutputColumns: [],
      createdBy: req.user!.userId,
    });

    await Recipient.insertMany(
      prepared.map((r: PreparedRecipient) => ({
        campaignId: campaign._id,
        ...r,
        timezone,
        generatedFilePath: '',
        status: 'pending',
      }))
    );

    if (template) {
      await Template.findByIdAndUpdate(template._id, { $inc: { usageCount: 1 } });
    }

    logger.info(
      {
        campaignId: campaign._id,
        people: peopleCount,
        messages: prepared.length,
        messagesPerPerson,
        templateId: template?._id,
      },
      'Manual campaign created'
    );

    // Optionally generate workbooks and queue the jobs in the same request.
    if (startNow) {
      const saved = await Recipient.find({ campaignId: campaign._id, status: 'pending' });
      const fileCache = new Map<string, string>();
      for (const recipient of saved) {
        await generateAndSchedule(campaign, recipient, fileCache);
      }
      campaign.status = 'scheduled';
      await campaign.save();
    }

    res.status(201).json({
      campaign: campaign.toJSON(),
      scheduledCount: startNow ? prepared.length : 0,
      peopleCount,
      messagesPerPerson,
    });
  } catch (error) {
    logger.error({ error }, 'Manual campaign creation failed');
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// POST /api/campaigns/manual/import — Read contacts out of a sheet into the form
router.post(
  '/manual/import',
  uploadContactsExcel.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // The client re-sends these when auto-detection picked the wrong column.
      const overrides = {
        name: req.body.nameColumn || undefined,
        phone: req.body.phoneColumn || undefined,
        dateOfBirth: req.body.dobColumn || undefined,
        scheduledAt: req.body.scheduleColumn || undefined,
      };

      const result = await importContactsFromExcel(
        req.file.buffer,
        overrides,
        env.MAX_RECIPIENTS_PER_CAMPAIGN
      );

      if (result.error) {
        // Headers travel with the error so the form can offer a column picker.
        res.status(400).json({
          error: result.error,
          headers: result.headers,
          detected: result.detected,
        });
        return;
      }

      res.json(result);
    } catch (error) {
      logger.error({ error }, 'Contact import failed');
      res.status(500).json({ error: 'Could not read that file' });
    }
  }
);

// POST /api/campaigns/manual/preview — Validate form recipients without saving
router.post('/manual/preview', async (req: Request, res: Response) => {
  try {
    const timezone = req.body.timezone || env.DEFAULT_CAMPAIGN_TIMEZONE;
    const rawRecipients = Array.isArray(req.body.recipients) ? req.body.recipients : [];

    let template = null;
    if (req.body.templateId) {
      template = await Template.findOne({
        _id: req.body.templateId,
        createdBy: req.user!.userId,
      });
    }

    const messageBody =
      (req.body.message && String(req.body.message).trim()) || template?.messageBody || '';

    const scheduleBody = {
      ...req.body,
      eventDate: req.body.eventDate ?? template?.eventDate?.toISOString().slice(0, 10),
      sendTime: req.body.sendTime ?? template?.defaultSendTime,
    };

    const { occurrences, error: repeatError } = resolveRecurrence(req.body, timezone);

    if (repeatError) {
      res.json({
        isValid: false,
        recipients: [],
        totalRecipients: 0,
        peopleCount: 0,
        messagesPerPerson: 0,
        errors: [{ row: 0, column: 'repeat', value: '', reason: repeatError }],
      });
      return;
    }

    const { date: singleDate } = resolveDefaultScheduledAt(scheduleBody, timezone);
    const defaultScheduledAt = occurrences?.[0] ?? singleDate ?? new Date();

    const eventDate = req.body.eventDate
      ? new Date(req.body.eventDate)
      : template?.eventDate ?? null;

    // Only the first day is expanded for the sample messages — a 68-day range
    // would otherwise render thousands of near-identical copies just to preview.
    const sampleOccurrences = occurrences ? occurrences.slice(0, 1) : undefined;

    const { recipients, errors, peopleCount } = prepareManualRecipients(
      rawRecipients as ManualRecipientInput[],
      {
        timezone,
        defaultScheduledAt,
        occurrences: sampleOccurrences,
        // The cap applies to the full expansion, not the sampled one.
        capMultiplier: occurrences?.length,
        messageBody,
        eventName: req.body.eventName || template?.name,
        eventDate: eventDate && !isNaN(eventDate.getTime()) ? eventDate : null,
        maxRecipients: env.MAX_RECIPIENTS_PER_CAMPAIGN,
      }
    );

    const messagesPerPerson = occurrences?.length ?? 1;

    res.json({
      isValid: errors.length === 0 && recipients.length > 0,
      recipients: recipients.slice(0, 10),
      totalRecipients: peopleCount * messagesPerPerson,
      peopleCount,
      messagesPerPerson,
      firstSendAt: occurrences?.[0] ?? defaultScheduledAt,
      lastSendAt: occurrences?.[occurrences.length - 1] ?? defaultScheduledAt,
      errors,
    });
  } catch (error) {
    logger.error({ error }, 'Manual preview failed');
    res.status(500).json({ error: 'Failed to preview recipients' });
  }
});

// POST /api/campaigns/:id/validate — Validate with column mapping
router.post('/:id/validate', async (req: Request, res: Response) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      createdBy: req.user!.userId,
    });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const { columnMapping, timezone, selectedOutputColumns } = req.body;

    if (!columnMapping) {
      res.status(400).json({ error: 'Column mapping is required' });
      return;
    }

    const result = await validateExcel(campaign.masterFilePath, columnMapping);

    campaign.columnMapping = columnMapping;
    campaign.timezone = timezone || campaign.timezone;
    campaign.selectedOutputColumns = selectedOutputColumns || [];
    campaign.totalRecipients = result.totalRows;
    campaign.pending = result.isValid ? result.totalRows : 0;
    campaign.validationErrors = result.errors;
    campaign.status = result.isValid ? 'validated' : 'failed';
    await campaign.save();

    res.json({
      campaign: campaign.toJSON(),
      validation: {
        isValid: result.isValid,
        headers: result.headers,
        preview: getPreviewRows(result.rows),
        errors: result.errors,
        totalRows: result.totalRows,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Validation failed');
    res.status(500).json({ error: 'Validation failed' });
  }
});

// GET /api/campaigns/:id — Get campaign details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      createdBy: req.user!.userId,
    });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    res.json({ campaign });
  } catch (error) {
    logger.error({ error }, 'Get campaign failed');
    res.status(500).json({ error: 'Failed to get campaign' });
  }
});

// POST /api/campaigns/:id/start — Process, generate workbooks, and schedule
router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      createdBy: req.user!.userId,
    });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    if (campaign.status !== 'validated') {
      res.status(400).json({
        error: `Campaign must be validated before starting. Current status: ${campaign.status}`,
      });
      return;
    }

    campaign.status = 'processing';
    await campaign.save();

    // Manual campaigns already hold their recipients — just build the files and queue.
    if (campaign.source === 'manual') {
      const pendingRecipients = await Recipient.find({
        campaignId: campaign._id,
        status: 'pending',
      });

      if (pendingRecipients.length === 0) {
        campaign.status = 'validated';
        await campaign.save();
        res.status(400).json({ error: 'Campaign has no recipients to schedule' });
        return;
      }

      const fileCache = new Map<string, string>();
      for (const recipient of pendingRecipients) {
        await generateAndSchedule(campaign, recipient, fileCache);
      }

      const totalRecipients = await Recipient.countDocuments({ campaignId: campaign._id });
      campaign.status = 'scheduled';
      campaign.totalRecipients = totalRecipients;
      campaign.pending = totalRecipients;
      campaign.sent = 0;
      campaign.delivered = 0;
      campaign.failed = 0;
      await campaign.save();

      logger.info(
        { campaignId: campaign._id, scheduledCount: pendingRecipients.length },
        'Manual campaign scheduled'
      );

      res.json({ campaign: campaign.toJSON(), scheduledCount: pendingRecipients.length });
      return;
    }

    // Re-parse the master Excel
    const result = await validateExcel(campaign.masterFilePath, campaign.columnMapping);
    if (!result.isValid) {
      campaign.status = 'failed';
      campaign.validationErrors = result.errors;
      await campaign.save();
      res.status(400).json({ error: 'Validation failed on re-check', errors: result.errors });
      return;
    }

    const generatedDir = getGeneratedDir();
    let scheduledCount = 0;

    for (const row of result.rows) {
      const recipientName = String(
        row.data[campaign.columnMapping.recipientName] || ''
      );
      const phoneNumber = String(row.data['__normalizedPhone'] || '');
      const message = String(row.data[campaign.columnMapping.message] || '');
      const scheduledAt = row.data['__parsedScheduledAt'] as Date;
      const dateOfBirth = row.data['__parsedDob'] as Date | undefined;

      // Generate personalized Excel
      const extraColumns: Record<string, unknown> = {};
      for (const col of campaign.selectedOutputColumns) {
        if (row.data[col] !== undefined) {
          extraColumns[col] = row.data[col];
        }
      }

      const filePath = await generateRecipientExcel(
        {
          recipientName,
          phoneNumber,
          dateOfBirth,
          message,
          extraColumns,
        },
        campaign.name,
        campaign.selectedOutputColumns,
        generatedDir,
        campaign.columnMapping
      );

      // Create recipient record
      const recipient = await Recipient.create({
        campaignId: campaign._id,
        recipientName,
        phoneNumber,
        dateOfBirth,
        message,
        scheduledAt,
        timezone: campaign.timezone,
        generatedFilePath: filePath,
        status: 'queued',
      });

      // Schedule Agenda job
      await scheduleDelivery(
        recipient._id as Types.ObjectId,
        campaign._id as Types.ObjectId,
        scheduledAt
      );

      scheduledCount++;
    }

    campaign.status = 'scheduled';
    campaign.totalRecipients = scheduledCount;
    campaign.pending = scheduledCount;
    campaign.sent = 0;
    campaign.delivered = 0;
    campaign.failed = 0;
    await campaign.save();

    logger.info(
      { campaignId: campaign._id, scheduledCount },
      'Campaign processing complete — all jobs scheduled'
    );

    res.json({
      campaign: campaign.toJSON(),
      scheduledCount,
    });
  } catch (error) {
    logger.error({ error }, 'Campaign start failed');
    res.status(500).json({ error: 'Failed to start campaign' });
  }
});

// DELETE /api/campaigns/:id — Cancel campaign
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      createdBy: req.user!.userId,
    });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // Cancel all pending Agenda jobs
    const cancelled = await cancelCampaignJobs(campaign._id.toString());

    // Update all pending/queued recipients to failed
    await Recipient.updateMany(
      {
        campaignId: campaign._id,
        status: { $in: ['pending', 'queued'] },
      },
      {
        status: 'failed',
        errorMessage: 'Campaign cancelled by user',
      }
    );

    campaign.status = 'cancelled';
    const failedCount = await Recipient.countDocuments({
      campaignId: campaign._id,
      status: 'failed',
    });
    campaign.failed = failedCount;
    campaign.pending = 0;
    await campaign.save();

    logger.info({ campaignId: campaign._id, cancelledJobs: cancelled }, 'Campaign cancelled');

    res.json({ campaign: campaign.toJSON(), cancelledJobs: cancelled });
  } catch (error) {
    logger.error({ error }, 'Campaign cancellation failed');
    res.status(500).json({ error: 'Failed to cancel campaign' });
  }
});

// GET /api/campaigns/:id/recipients — Paginated recipient list
router.get('/:id/recipients', async (req: Request, res: Response) => {
  try {
    // Verify campaign ownership
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      createdBy: req.user!.userId,
    });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const status = req.query.status as string;
    const sortBy = (req.query.sortBy as string) || 'scheduledAt';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;

    const filter: Record<string, unknown> = { campaignId: req.params.id };
    if (status) filter.status = status;

    const [recipients, total] = await Promise.all([
      Recipient.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit),
      Recipient.countDocuments(filter),
    ]);

    res.json({
      recipients,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error({ error }, 'List recipients failed');
    res.status(500).json({ error: 'Failed to list recipients' });
  }
});

// POST /api/campaigns/:id/recipients — Add people to a manual campaign
router.post('/:id/recipients', async (req: Request, res: Response) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      createdBy: req.user!.userId,
    });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    if (campaign.source !== 'manual') {
      res.status(400).json({
        error: 'Recipients can only be added to campaigns created with the form',
      });
      return;
    }

    if (!['validated', 'scheduled', 'in_progress'].includes(campaign.status)) {
      res.status(400).json({
        error: `Cannot add recipients while the campaign is ${campaign.status}`,
      });
      return;
    }

    const rawRecipients = Array.isArray(req.body.recipients) ? req.body.recipients : [];
    if (rawRecipients.length === 0) {
      res.status(400).json({ error: 'Add at least one recipient' });
      return;
    }

    const template = campaign.templateId
      ? await Template.findOne({ _id: campaign.templateId, createdBy: req.user!.userId })
      : null;

    // Prefer an explicit override, then the template, then the body this
    // campaign was created with — otherwise a typed-message campaign could
    // never take new people.
    const messageBody =
      (req.body.message && String(req.body.message).trim()) ||
      template?.messageBody ||
      campaign.messageBody ||
      '';

    if (!messageBody && rawRecipients.some((r: ManualRecipientInput) => !r.message?.trim())) {
      res.status(400).json({
        error: 'A message is required for recipients without their own message',
      });
      return;
    }

    const scheduleBody = {
      ...req.body,
      eventDate:
        req.body.eventDate ?? campaign.eventDate?.toISOString().slice(0, 10),
      sendTime: req.body.sendTime ?? template?.defaultSendTime,
    };

    // On a recurring campaign new people join the existing daily schedule,
    // picking up from today so already-past days aren't back-filled.
    let occurrences: Date[] | undefined;
    if (campaign.recurrence) {
      const today = new Date().toISOString().slice(0, 10);
      const startDate =
        campaign.recurrence.startDate > today ? campaign.recurrence.startDate : today;

      // Built field by field: `recurrence` is a Mongoose subdocument, and
      // spreading one yields its internals rather than the stored values.
      const expansion = expandDailyRange(
        {
          startDate,
          endDate: campaign.recurrence.endDate,
          time: campaign.recurrence.time,
        },
        campaign.timezone
      );

      if (expansion.error) {
        res.status(400).json({ error: expansion.error });
        return;
      }
      if (expansion.occurrences.length === 0) {
        res.status(400).json({ error: 'This campaign’s daily range has already ended' });
        return;
      }
      occurrences = expansion.occurrences;
    }

    let defaultScheduledAt: Date;
    if (occurrences) {
      defaultScheduledAt = occurrences[0];
    } else {
      const resolved = resolveDefaultScheduledAt(scheduleBody, campaign.timezone);
      if (!resolved.date) {
        res.status(400).json({ error: resolved.reason || 'A scheduled date/time is required' });
        return;
      }
      defaultScheduledAt = resolved.date;
    }

    // Existing numbers block duplicates across the whole campaign, not just this batch.
    const existing = await Recipient.find({ campaignId: campaign._id }).select('phoneNumber');
    const existingPhones = new Set(existing.map((r) => r.phoneNumber));

    const { recipients: prepared, errors } = prepareManualRecipients(
      rawRecipients as ManualRecipientInput[],
      {
        timezone: campaign.timezone,
        defaultScheduledAt,
        occurrences,
        messageBody,
        metaBodyParameters: approvedMetaTemplate(template)?.bodyParameters,
        eventName: req.body.eventName || template?.name,
        eventDate: campaign.eventDate ?? null,
        existingPhones,
        existingMessageCount: existing.length,
        maxRecipients: env.MAX_RECIPIENTS_PER_CAMPAIGN,
      }
    );

    if (errors.length > 0) {
      res.status(400).json({ error: 'Some recipients are invalid', errors });
      return;
    }

    const created = await Recipient.insertMany(
      prepared.map((r: PreparedRecipient) => ({
        campaignId: campaign._id,
        ...r,
        timezone: campaign.timezone,
        generatedFilePath: '',
        status: 'pending',
      }))
    );

    // A campaign that is already running schedules the new people immediately;
    // one that has not started yet keeps them pending until it does.
    const isLive = ['scheduled', 'in_progress'].includes(campaign.status);
    if (isLive) {
      const fileCache = new Map<string, string>();
      for (const recipient of created) {
        await generateAndSchedule(campaign, recipient as IRecipient, fileCache);
      }
    }

    campaign.totalRecipients += created.length;
    campaign.pending += created.length;
    await campaign.save();

    logger.info(
      { campaignId: campaign._id, added: created.length, scheduled: isLive },
      'Recipients added to manual campaign'
    );

    res.status(201).json({
      campaign: campaign.toJSON(),
      addedCount: created.length,
      scheduled: isLive,
    });
  } catch (error) {
    logger.error({ error }, 'Add recipients failed');
    res.status(500).json({ error: 'Failed to add recipients' });
  }
});

// DELETE /api/campaigns/:id/recipients/:recipientId — Remove someone not yet sent to
router.delete('/:id/recipients/:recipientId', async (req: Request, res: Response) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      createdBy: req.user!.userId,
    });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const recipient = await Recipient.findOne({
      _id: req.params.recipientId,
      campaignId: campaign._id,
    });

    if (!recipient) {
      res.status(404).json({ error: 'Recipient not found' });
      return;
    }

    if (!['pending', 'queued', 'failed'].includes(recipient.status)) {
      res.status(400).json({
        error: `Cannot remove a recipient whose message is already ${recipient.status}`,
      });
      return;
    }

    const wasPending = recipient.status === 'pending' || recipient.status === 'queued';

    if (recipient.status === 'queued') {
      await cancelRecipientJobs(recipient._id!.toString());
    }

    await recipient.deleteOne();

    campaign.totalRecipients = Math.max(0, campaign.totalRecipients - 1);
    if (wasPending) {
      campaign.pending = Math.max(0, campaign.pending - 1);
    } else {
      campaign.failed = Math.max(0, campaign.failed - 1);
    }
    await campaign.save();

    logger.info(
      { campaignId: campaign._id, recipientId: recipient._id },
      'Recipient removed from campaign'
    );

    res.json({ success: true, campaign: campaign.toJSON() });
  } catch (error) {
    logger.error({ error }, 'Remove recipient failed');
    res.status(500).json({ error: 'Failed to remove recipient' });
  }
});

// POST /api/campaigns/:id/recipients/:recipientId/retry
router.post('/:id/recipients/:recipientId/retry', async (req: Request, res: Response) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      createdBy: req.user!.userId,
    });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const recipient = await Recipient.findOne({
      _id: req.params.recipientId,
      campaignId: req.params.id,
    });

    if (!recipient) {
      res.status(404).json({ error: 'Recipient not found' });
      return;
    }

    if (recipient.status !== 'failed') {
      res.status(400).json({ error: `Can only retry failed deliveries. Current status: ${recipient.status}` });
      return;
    }

    // Reset and reschedule
    recipient.status = 'queued';
    recipient.errorMessage = undefined;
    recipient.attempts = 0;
    await recipient.save();

    // Schedule immediate delivery
    await scheduleDelivery(
      recipient._id as Types.ObjectId,
      campaign._id as Types.ObjectId,
      new Date() // Immediate
    );

    // Update campaign counters
    await Campaign.findByIdAndUpdate(campaign._id, {
      $inc: { failed: -1, pending: 1 },
    });

    if (campaign.status === 'completed') {
      campaign.status = 'in_progress';
      await campaign.save();
    }

    logger.info(
      { recipientId: recipient._id, campaignId: campaign._id },
      'Recipient delivery retried'
    );

    res.json({ recipient: recipient.toJSON() });
  } catch (error) {
    logger.error({ error }, 'Retry failed');
    res.status(500).json({ error: 'Failed to retry delivery' });
  }
});

export default router;
