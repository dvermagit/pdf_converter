import { Agenda } from 'agenda';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let agenda: Agenda;

export function getAgenda(): Agenda {
  if (!agenda) {
    // Agenda opens its own connection rather than reusing Mongoose's: it runs
    // on mongodb v4 (callback API) while Mongoose 8 bundles v6, whose
    // `createIndex` ignores the callback Agenda waits on — handing it
    // Mongoose's Db makes `start()` hang forever waiting for 'ready'.
    agenda = new Agenda({
      db: {
        address: env.MONGODB_URI,
        collection: 'agendaJobs',
      },
      processEvery: '30 seconds',
      maxConcurrency: 5,
      defaultConcurrency: 2,
      defaultLockLifetime: 10 * 60 * 1000, // 10 minutes
    });

    // Agenda emits connection/index failures here; without a listener they
    // surface as an unhandled 'error' event and take the process down.
    agenda.on('error', (error) => {
      logger.error({ error }, 'Agenda scheduler error');
    });

    agenda.on('start', (job) => {
      logger.info({ jobName: job.attrs.name, jobId: job.attrs._id }, 'Agenda job started');
    });

    agenda.on('complete', (job) => {
      logger.info({ jobName: job.attrs.name, jobId: job.attrs._id }, 'Agenda job completed');
    });

    agenda.on('fail', (err, job) => {
      logger.error(
        { jobName: job.attrs.name, jobId: job.attrs._id, error: err.message },
        'Agenda job failed'
      );
    });
  }

  return agenda;
}

export async function startAgenda(): Promise<void> {
  const ag = getAgenda();
  await ag.start();
  logger.info('✅ Agenda scheduler started');
}

export async function stopAgenda(): Promise<void> {
  if (agenda) {
    await agenda.stop();
    logger.info('Agenda scheduler stopped gracefully');
  }
}
