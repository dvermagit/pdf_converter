import cron from 'node-cron';
import { Recipient } from '../models/Recipient.js';
import { Campaign } from '../models/Campaign.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

export function startMaintenanceJobs(): void {
  // Every 5 minutes: detect stuck jobs (sending for more than 15 minutes)
  cron.schedule('*/5 * * * *', async () => {
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      const stuckRecipients = await Recipient.find({
        status: 'sending',
        lastAttemptAt: { $lt: fifteenMinutesAgo },
      });

      if (stuckRecipients.length > 0) {
        logger.warn({ count: stuckRecipients.length }, 'Detected stuck recipients');

        for (const recipient of stuckRecipients) {
          if (recipient.attempts < recipient.maxAttempts) {
            recipient.status = 'queued';
            recipient.errorMessage = 'Job appeared stuck — reset to queued for retry';
          } else {
            recipient.status = 'failed';
            recipient.errorMessage = 'Job stuck and max attempts reached';
            await Campaign.findByIdAndUpdate(recipient.campaignId, {
              $inc: { failed: 1, pending: -1 },
            });
          }
          await recipient.save();
        }
      }
    } catch (error) {
      logger.error({ error }, 'Stuck job detection failed');
    }
  });

  // Every hour: clean up temporary files older than 7 days
  cron.schedule('0 * * * *', async () => {
    try {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const generatedDir = path.resolve('generated');

      if (!fs.existsSync(generatedDir)) return;

      // A workbook is built when its campaign starts but read when the message
      // finally goes out, which may be weeks later on a scheduled or daily-range
      // campaign. Deleting on age alone breaks those sends, so anything still
      // awaiting delivery is kept regardless of how old the file is.
      const undelivered = await Recipient.find({
        status: { $in: ['pending', 'queued', 'sending'] },
        generatedFilePath: { $nin: ['', null] },
      }).select('generatedFilePath');

      const inUse = new Set(undelivered.map((r) => path.resolve(r.generatedFilePath)));

      const files = fs.readdirSync(generatedDir);
      let cleanedCount = 0;
      let keptInUse = 0;

      for (const file of files) {
        const filePath = path.join(generatedDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtimeMs >= sevenDaysAgo) continue;

        if (inUse.has(path.resolve(filePath))) {
          keptInUse++;
          continue;
        }

        fs.unlinkSync(filePath);
        cleanedCount++;
      }

      if (cleanedCount > 0 || keptInUse > 0) {
        logger.info({ cleanedCount, keptInUse }, 'Cleaned expired generated files');
      }
    } catch (error) {
      logger.error({ error }, 'File cleanup failed');
    }
  });

  // Daily at midnight: generate summary of campaigns that completed today
  cron.schedule('0 0 * * *', async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const completedToday = await Campaign.countDocuments({
        status: 'completed',
        updatedAt: { $gte: today },
      });

      const failedToday = await Campaign.countDocuments({
        status: 'failed',
        updatedAt: { $gte: today },
      });

      logger.info(
        { completedToday, failedToday, date: today.toISOString() },
        'Daily campaign summary'
      );
    } catch (error) {
      logger.error({ error }, 'Daily summary generation failed');
    }
  });

  logger.info('✅ Maintenance cron jobs started');
}
