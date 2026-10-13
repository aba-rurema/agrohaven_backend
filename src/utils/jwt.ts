import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import type { Role } from '@prisma/client';
import { env } from '../config/env';
import { ApiError } from './api-error';

export type AccessTokenClaims = {
  sub: string;
  role: Role;
  jti: string;
  tv: number;
  exp: number;
};

const roles: Role[] = ['CUSTOMER', 'ADMIN', 'TECHNICIAN'];

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && roles.includes(value as Role);
}

export function readBearerToken(header: string | undefined): string {
  if (!header) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  const token = match?.[1];
  if (!token) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return token;
}

export function signAccessToken(user: { id: string; role: Role; tokenVersion: number }): string {
  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    subject: user.id,
    jwtid: randomUUID(),
  };

  return jwt.sign({ role: user.role, tv: user.tokenVersion }, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof decoded === 'string') {
      throw new ApiError(401, 'UNAUTHORIZED', 'Invalid access token');
    }

    if (
      typeof decoded.sub !== 'string' ||
      typeof decoded.jti !== 'string' ||
      typeof decoded.tv !== 'number' ||
      typeof decoded.exp !== 'number' ||
      !isRole(decoded.role)
    ) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Invalid access token');
    }

    return {
      sub: decoded.sub,
      role: decoded.role,
      jti: decoded.jti,
      tv: decoded.tv,
      exp: decoded.exp,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired access token');
  }
}
