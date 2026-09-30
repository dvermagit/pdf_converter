import { Router, Request, Response } from 'express';
import * as whatsappService from '../services/whatsappService.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/settings — Get current settings (never expose secrets)
router.get('/', (_req: Request, res: Response) => {
  res.json({
    whatsapp: {
      configured: !!env.META_WA_PHONE_NUMBER_ID && !!env.META_WA_ACCESS_TOKEN,
      phoneNumberId: env.META_WA_PHONE_NUMBER_ID || null,
      apiVersion: env.META_GRAPH_API_VERSION,
      webhookVerifyToken: env.META_WA_WEBHOOK_VERIFY_TOKEN ? '••••••••' : null,
    },
    email: {
      configured: !!env.SMTP_USER && !!env.SMTP_PASS,
      smtpHost: env.SMTP_HOST,
      from: env.SMTP_FROM,
    },
    limits: {
      maxRecipientsPerCampaign: env.MAX_RECIPIENTS_PER_CAMPAIGN,
      maxUploadSizeMB: env.MAX_UPLOAD_SIZE_MB,
      defaultTimezone: env.DEFAULT_CAMPAIGN_TIMEZONE,
    },
  });
});

// POST /api/settings/test-whatsapp — Test WhatsApp API connection
router.post('/test-whatsapp', async (_req: Request, res: Response) => {
  try {
    const result = await whatsappService.testConnection();
    res.json(result);
  } catch (error) {
    logger.error({ error }, 'WhatsApp connection test failed');
    res.status(500).json({ success: false, error: 'Connection test failed' });
  }
});

export default router;
