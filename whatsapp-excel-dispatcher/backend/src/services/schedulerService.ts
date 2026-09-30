import { getAgenda } from '../config/agenda.js';
import { logger } from '../utils/logger.js';
import { Types } from 'mongoose';

const JOB_NAME = 'send-whatsapp-message';

export async function scheduleDelivery(
  recipientId: Types.ObjectId,
  campaignId: Types.ObjectId,
  scheduledAt: Date
): Promise<void> {
  const agenda = getAgenda();

  await agenda.schedule(scheduledAt, JOB_NAME, {
    recipientId: recipientId.toString(),
    campaignId: campaignId.toString(),
  });

  logger.info(
    { recipientId, campaignId, scheduledAt },
    'Delivery job scheduled'
  );
}

export async function cancelCampaignJobs(campaignId: string): Promise<number> {
  const agenda = getAgenda();

  const numRemoved = await agenda.cancel({
    name: JOB_NAME,
    'data.campaignId': campaignId,
  }) ?? 0;

  logger.info({ campaignId, numRemoved }, 'Campaign jobs cancelled');
  return numRemoved;
}

export async function cancelRecipientJobs(recipientId: string): Promise<number> {
  const agenda = getAgenda();

  const numRemoved = await agenda.cancel({
    name: JOB_NAME,
    'data.recipientId': recipientId,
  }) ?? 0;

  logger.info({ recipientId, numRemoved }, 'Recipient jobs cancelled');
  return numRemoved;
}

export async function getJobStats(campaignId: string) {
  const agenda = getAgenda();
  const jobs = await (agenda as any).jobs({
    name: JOB_NAME,
    'data.campaignId': campaignId,
  });

  const stats = {
    total: jobs.length,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
  };

  for (const job of jobs) {
    if (job.attrs.failedAt) stats.failed++;
    else if (job.attrs.lastFinishedAt) stats.completed++;
    else if (job.attrs.lockedAt) stats.running++;
    else stats.pending++;
  }

  return stats;
}
