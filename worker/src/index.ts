import express from 'express';
import { initScheduler } from './scheduler/cron';
import { setupQueue } from './queue/setup';
import { setupManualTriggers } from './scheduler/manual';
import { logger } from './utils/logger';
import { env } from './config/env';

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
    }, 'HTTP request completed');
  });
  
  next();
});

async function main() {
  try {
    logger.info('Starting AsymAudit Worker Service');

    // Initialize BullMQ queue and workers
    logger.info('Setting up job queue...');
    await setupQueue();

    // Start cron scheduler - reads schedules from Supabase
    logger.info('Initializing scheduler...');
    await initScheduler();

    // Set up Express endpoints for manual triggers and health checks
    logger.info('Setting up API endpoints...');
    setupManualTriggers(app);

    // Error handling middleware
    app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error({ error, url: req.url, method: req.method }, 'Unhandled request error');
      
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // 404 handler
    app.use('*', (req: express.Request, res: express.Response) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        timestamp: new Date().toISOString(),
      });
    });

    // Start HTTP server
    const PORT = env.PORT;
    const server = app.listen(PORT, () => {
      logger.info({ port: PORT }, 'AsymAudit Worker Service is running');
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown');

      // Stop accepting new connections
      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          // Stop scheduler
          const { stopScheduler } = await import('./scheduler/cron');
          await stopScheduler();

          // Stop queue
          const { shutdownQueue } = await import('./queue/setup');
          await shutdownQueue();

          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error({ error }, 'Error during graceful shutdown');
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.fatal({ error }, 'Uncaught exception');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.fatal({ reason, promise }, 'Unhandled rejection');
      process.exit(1);
    });

  } catch (error) {
    logger.fatal({ error }, 'Failed to start worker service');
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  logger.fatal({ error }, 'Application startup failed');
  process.exit(1);
});