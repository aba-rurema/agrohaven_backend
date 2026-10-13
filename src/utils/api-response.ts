import type { Response } from 'express';

type SuccessOptions<T> = {
  status?: number;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
};

export function sendSuccess<T>(res: Response, options: SuccessOptions<T>): Response {
  const body: {
    success: true;
    message: string;
    data?: T;
    meta?: Record<string, unknown>;
  } = {
    success: true,
    message: options.message,
  };

  if (options.data !== undefined) body.data = options.data;
  if (options.meta !== undefined) body.meta = options.meta;

  return res.status(options.status ?? 200).json(body);
}
