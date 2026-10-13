type LogMeta = Record<string, unknown> | Error | undefined;

function write(level: 'info' | 'warn' | 'error', message: string, meta?: LogMeta): void {
  const entry = {
    time: new Date().toISOString(),
    level,
    message,
    ...(meta instanceof Error
      ? { error: { name: meta.name, message: meta.message, stack: meta.stack } }
      : meta
        ? { meta }
        : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info(message: string, meta?: LogMeta): void {
    write('info', message, meta);
  },
  warn(message: string, meta?: LogMeta): void {
    write('warn', message, meta);
  },
  error(message: string, meta?: LogMeta): void {
    write('error', message, meta);
  },
};
