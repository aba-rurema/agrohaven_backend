import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError, errorBody } from '../utils/api-error';
import { logger } from '../utils/logger';

type ErrorWithStatus = { status?: number; type?: string; message?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(errorBody('Route not found', 'NOT_FOUND', { path: req.originalUrl }));
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    res.status(400).json(
      errorBody('Validation failed', 'VALIDATION_ERROR', {
        issues: error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.map(String).join('.') : 'form',
          path: issue.path.map(String).join('.'),
          code: issue.code,
          message: issue.message,
        })),
      }),
    );
    return;
  }

  if (error instanceof ApiError) {
    res.status(error.statusCode).json(errorBody(error.message, error.code, error.details));
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json(
        errorBody('A record with that value already exists', 'CONFLICT', {
          fields: error.meta?.target ?? [],
        }),
      );
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json(errorBody('Record not found', 'NOT_FOUND'));
      return;
    }
    if (error.code === 'P2003') {
      res.status(400).json(errorBody('Related record does not exist', 'INVALID_REFERENCE'));
      return;
    }
  }

  if (isRecord(error)) {
    const typed = error as ErrorWithStatus;
    if (typed.type === 'entity.parse.failed') {
      res.status(400).json(errorBody('Request body must be valid JSON', 'INVALID_JSON'));
      return;
    }
    if (typed.type === 'entity.too.large') {
      res.status(413).json(errorBody('Request body is too large', 'PAYLOAD_TOO_LARGE'));
      return;
    }
  }

  logger.error('Unhandled error', error instanceof Error ? error : undefined);
  res.status(500).json(errorBody('Something went wrong', 'INTERNAL_ERROR'));
}
