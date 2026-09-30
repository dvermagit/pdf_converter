import { getAgenda } from '../config/agenda.js';
import { Recipient } from '../models/Recipient.js';
import { Campaign } from '../models/Campaign.js';
import * as whatsappService from '../services/whatsappService.js';
import { logger } from '../utils/logger.js';
import path from 'path';
import { Job } from 'agenda';

const JOB_NAME = 'send-whatsapp-message';

interface JobData {
  recipientId: string;
  campaignId: string;
}

export function defineWhatsAppJob(): void {
  const agenda = getAgenda();

  agenda.define<JobData>(
    JOB_NAME,
    { concurrency: 2, lockLifetime: 10 * 60 * 1000 },
    async (job: Job<JobData>) => {
      const { recipientId, campaignId } = job.attrs.data;

      logger.info({ recipientId, campaignId }, 'WhatsApp delivery job starting');

      const recipient = await Recipient.findById(recipientId);
      if (!recipient) {
        logger.error({ recipientId }, 'Recipient not found — skipping job');
        return;
      }

      // Idempotency check — don't re-send if already sent/delivered/read
      if (['sent', 'delivered', 'read'].includes(recipient.status)) {
        logger.warn({ recipientId, status: recipient.status }, 'Recipient already sent — skipping');
        return;
      }

      // Check if campaign is cancelled
      const campaign = await Campaign.findById(campaignId);
      if (!campaign || campaign.status === 'cancelled') {
        logger.warn({ campaignId }, 'Campaign cancelled — skipping delivery');
        recipient.status = 'failed';
        recipient.errorMessage = 'Campaign was cancelled';
        await recipient.save();
        return;
      }

      // Mark as sending
      recipient.status = 'sending';
      recipient.attempts += 1;
      recipient.lastAttemptAt = new Date();
      await recipient.save();

      // Update campaign status if first delivery
      if (campaign.status === 'scheduled') {
        campaign.status = 'in_progress';
        await campaign.save();
      }

      try {
        // Step 1: Upload the Excel document to Meta
        const mediaId = await whatsappService.uploadMedia(recipient.generatedFilePath);
        const filename = path.basename(recipient.generatedFilePath);

        // Step 2: Send it.
        //
        // An approved Meta template is the only thing that reaches someone
        // outside the 24-hour customer service window, so production campaigns
        // go that way. The free-form document send is kept for development
        // against the test number, where the window restriction doesn't bite.
        let messageId: string;

        if (campaign.metaTemplate?.templateName) {
          messageId = await whatsappService.sendTemplateMessage(
            recipient.phoneNumber,
            campaign.metaTemplate.templateName,
            campaign.metaTemplate.languageCode || 'en',
            recipient.templateParams || [],
            campaign.metaTemplate.headerType === 'document'
              ? { documentId: mediaId, filename }
              : {}
          );
        } else {
          messageId = await whatsappService.sendDocumentMessage(
            recipient.phoneNumber,
            mediaId,
            recipient.message,
            filename
          );
        }

        // Mark as sent
        recipient.status = 'sent';
        recipient.whatsappMessageId = messageId;
        recipient.sentAt = new Date();
        await recipient.save();

        // Update campaign counters
        await Campaign.findByIdAndUpdate(campaignId, {
          $inc: { sent: 1, pending: -1 },
        });

        logger.info(
          { recipientId, messageId, phoneNumber: recipient.phoneNumber },
          'WhatsApp message sent successfully'
        );
      } catch (error) {
        let errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Extract Meta's detailed error message if it's an Axios error
        if (error && typeof error === 'object' && 'isAxiosError' in error) {
          const axiosError = error as any;
          if (axiosError.response?.data?.error?.message) {
            errorMessage = axiosError.response.data.error.message;
          }
        }

        if (whatsappService.isRetryableError(error) && recipient.attempts < recipient.maxAttempts) {
          // Schedule retry with exponential backoff
          const backoffMs = Math.pow(2, recipient.attempts) * 30000; // 30s, 60s, 120s...
          const retryAt = new Date(Date.now() + backoffMs);

          recipient.status = 'queued';
          recipient.errorMessage = `Attempt ${recipient.attempts} failed: ${errorMessage}. Retrying at ${retryAt.toISOString()}`;
          await recipient.save();

          await agenda.schedule(retryAt, JOB_NAME, {
            recipientId,
            campaignId,
          });

          logger.warn(
            { recipientId, attempt: recipient.attempts, retryAt, error: errorMessage },
            'Delivery failed — scheduled retry'
          );
        } else {
          // Permanent failure or max attempts reached
          recipient.status = 'failed';
          recipient.errorMessage = `Failed after ${recipient.attempts} attempt(s): ${errorMessage}`;
          await recipient.save();

          await Campaign.findByIdAndUpdate(campaignId, {
            $inc: { failed: 1, pending: -1 },
          });

          logger.error(
            { recipientId, attempts: recipient.attempts, error: errorMessage },
            'Delivery permanently failed'
          );
        }
      }

      // Check if campaign is complete
      await checkCampaignCompletion(campaignId);
    }
  );

  logger.info('WhatsApp delivery job defined');
}

async function checkCampaignCompletion(campaignId: string): Promise<void> {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign || campaign.status === 'completed' || campaign.status === 'cancelled') return;

  const pendingCount = await Recipient.countDocuments({
    campaignId,
    status: { $in: ['pending', 'queued', 'sending'] },
  });

  if (pendingCount === 0) {
    campaign.status = 'completed';

    // Recalculate final counts
    const [sentCount, deliveredCount, failedCount] = await Promise.all([
      Recipient.countDocuments({ campaignId, status: 'sent' }),
      Recipient.countDocuments({ campaignId, status: { $in: ['delivered', 'read'] } }),
      Recipient.countDocuments({ campaignId, status: 'failed' }),
    ]);

    campaign.sent = sentCount + deliveredCount;
    campaign.delivered = deliveredCount;
    campaign.failed = failedCount;
    campaign.pending = 0;

    await campaign.save();
    logger.info({ campaignId, sent: campaign.sent, failed: campaign.failed }, 'Campaign completed');
  }
}
