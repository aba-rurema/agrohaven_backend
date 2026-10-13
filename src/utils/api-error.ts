export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function errorBody(message: string, code: string, details: Record<string, unknown> = {}) {
  return {
    success: false as const,
    message,
    error: {
      code,
      details,
    },
  };
}
