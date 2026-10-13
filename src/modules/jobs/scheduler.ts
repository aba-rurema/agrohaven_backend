import { env } from '../../config/env';
import { tokenRepository } from '../../repositories/token.repository';
import { logger } from '../../utils/logger';
import { evaluateScheduleAutomations } from '../automation/engine';
import { markStaleDevices } from '../devices/presence';

let timer: NodeJS.Timeout | null = null;
let running = false;

async function runMaintenance(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await markStaleDevices();
    await evaluateScheduleAutomations();
    await tokenRepository.deleteExpired();
  } finally {
    running = false;
  }
}

export function startBackgroundJobs(): void {
  if (env.NODE_ENV === 'test' || !env.RUN_BACKGROUND_JOBS || timer) return;
  void runMaintenance().catch((error: unknown) => {
    logger.error('Background job failed', error instanceof Error ? error : undefined);
  });
  timer = setInterval(() => {
    void runMaintenance().catch((error: unknown) => {
      logger.error('Background job failed', error instanceof Error ? error : undefined);
    });
  }, 60_000);
}

export function stopBackgroundJobs(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
