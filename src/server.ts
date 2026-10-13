import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { startBackgroundJobs, stopBackgroundJobs } from './modules/jobs/scheduler';
import { logger } from './utils/logger';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`AgroHaven API listening on port ${env.PORT}`);
});

startBackgroundJobs();

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down`);
  stopBackgroundJobs();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
