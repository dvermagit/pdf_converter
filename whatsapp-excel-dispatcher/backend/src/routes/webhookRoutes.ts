import { Router, Request, Response } from 'express';
import { Recipient } from '../models/Recipient.js';
import { Campaign } from '../models/Campaign.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/webhooks/whatsapp — Webhook verification (Meta sends GET to verify)
router.get('/', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.META_WA_WEBHOOK_VERIFY_TOKEN) {
    logger.info('WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    logger.warn({ mode, token }, 'WhatsApp webhook verification failed');
    res.sendStatus(403);
  }
});

// POST /api/webhooks/whatsapp — Receive delivery status callbacks
router.post('/', async (req: Request, res: Response) => {
  try {
    // Always respond 200 to Meta immediately
    res.sendStatus(200);

    const body = req.body;

    // Process only message status updates
    if (body?.entry?.[0]?.changes?.[0]?.value?.statuses) {
      const statuses = body.entry[0].changes[0].value.statuses;

      for (const status of statuses) {
        const messageId = status.id;
        const statusType = status.status; // sent, delivered, read, failed
        const timestamp = status.timestamp
          ? new Date(parseInt(status.timestamp) * 1000)
          : new Date();

        const recipient = await Recipient.findOne({ whatsappMessageId: messageId });
        if (!recipient) {
          logger.debug({ messageId, statusType }, 'Webhook status for unknown message ID');
          continue;
        }

        // Only update if it's a forward progression (don't go backward)
        const statusOrder = ['pending', 'queued', 'sending', 'sent', 'delivered', 'read', 'failed'];
        const currentIdx = statusOrder.indexOf(recipient.status);
        const newIdx = statusOrder.indexOf(statusType);

        // Allow failure from any state, but otherwise only advance
        if (statusType === 'failed' || newIdx > currentIdx) {
          recipient.status = statusType;

          switch (statusType) {
            case 'delivered':
              recipient.deliveredAt = timestamp;
              await Campaign.findByIdAndUpdate(recipient.campaignId, {
                $inc: { delivered: 1 },
              });
              break;
            case 'read':
              recipient.readAt = timestamp;
              if (!recipient.deliveredAt) {
                recipient.deliveredAt = timestamp;
                await Campaign.findByIdAndUpdate(recipient.campaignId, {
                  $inc: { delivered: 1 },
                });
              }
              break;
            case 'failed':
              const errorInfo = status.errors?.[0];
              recipient.errorMessage = errorInfo
                ? `${errorInfo.code}: ${errorInfo.title}`
                : 'Delivery failed (webhook)';
              await Campaign.findByIdAndUpdate(recipient.campaignId, {
                $inc: { failed: 1, sent: -1 },
              });
              break;
          }

          await recipient.save();

          logger.info(
            {
              recipientId: recipient._id,
              messageId,
              status: statusType,
              campaignId: recipient.campaignId,
            },
            'Webhook status update processed'
          );
        }
      }
    }
  } catch (error) {
    logger.error({ error }, 'Webhook processing error');
    // Already sent 200 above — don't send another response
  }
});

export default router;
