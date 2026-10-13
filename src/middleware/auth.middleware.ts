import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { userRepository } from '../repositories/user.repository';
import { tokenRepository } from '../repositories/token.repository';
import { ApiError } from '../utils/api-error';
import { readBearerToken, verifyAccessToken } from '../utils/jwt';

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const claims = verifyAccessToken(readBearerToken(req.header('authorization')));
    const revoked = await tokenRepository.isRevoked(claims.jti);
    if (revoked) {
      throw new ApiError(401, 'TOKEN_REVOKED', 'This session has been logged out');
    }

    const user = await userRepository.findAuthState(claims.sub);
    if (!user) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    if (!user.isActive) {
      throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account is deactivated');
    }
    if (user.tokenVersion !== claims.tv) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Session is no longer valid. Please log in again.');
    }

    req.user = {
      id: user.id,
      role: user.role,
      jti: claims.jti,
      tokenVersion: user.tokenVersion,
    };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(401, 'UNAUTHORIZED', 'Authentication required'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
      return;
    }
    next();
  };
}

export function requireUser(req: Request) {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return req.user;
}
