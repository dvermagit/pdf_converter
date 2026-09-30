import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { startAgenda, stopAgenda } from './config/agenda.js';
import { defineWhatsAppJob } from './jobs/sendWhatsApp.js';
import { startMaintenanceJobs } from './jobs/maintenance.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import campaignRoutes from './routes/campaignRoutes.js';
import templateRoutes from './routes/templateRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';

const app = express();

// Security & parsing middleware
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check (public)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes
app.use('/api/auth', authRoutes);

// WhatsApp webhooks (public — verified by token)
app.use('/api/webhooks/whatsapp', webhookRoutes);

// Protected routes
app.use('/api/campaigns/upload', authMiddleware, uploadRoutes);
app.use('/api/campaigns', authMiddleware, campaignRoutes);
app.use('/api/templates', authMiddleware, templateRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);

// 404 and error handler
app.use(notFoundHandler);
app.use(errorHandler);

// Startup
async function start() {
  try {
    // Connect to MongoDB
    await connectDB();

    // Define Agenda jobs before starting
    defineWhatsAppJob();

    // Start Agenda scheduler
    await startAgenda();

    // Start node-cron maintenance jobs
    startMaintenanceJobs();

    // Start HTTP server
    app.listen(env.PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${env.PORT}`);
      logger.info(`📋 Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error({ error }, 'Server startup failed');
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received');
  await stopAgenda();
  await disconnectDB();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Async failures that escape a try/catch (a driver's DNS lookup, for example)
// otherwise kill the process with a bare stack trace and no context.
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection — shutting down');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception — shutting down');
  process.exit(1);
});

start();

export default app;
