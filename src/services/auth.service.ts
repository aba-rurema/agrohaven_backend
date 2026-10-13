import { env } from '../config/env';
import { sendPasswordReset } from '../modules/notifications/password-reset';
import { tokenRepository } from '../repositories/token.repository';
import { userRepository } from '../repositories/user.repository';
import type { AuthUser } from '../types';
import { ApiError } from '../utils/api-error';
import { readBearerToken, signAccessToken, verifyAccessToken } from '../utils/jwt';
import { toPublicUser } from '../utils/mappers';
import { hashPassword, verifyPassword } from '../utils/password';
import { generateResetToken, hashToken } from '../utils/secrets';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '../validators/auth.validator';
import { logger } from '../utils/logger';

function authResponse(user: {
  id: string;
  role: 'CUSTOMER' | 'ADMIN' | 'TECHNICIAN';
  tokenVersion: number;
  fullName: string;
  email: string;
  phone: string | null;
  profileImage: string | null;
  location: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    accessToken: signAccessToken(user),
    tokenType: 'Bearer' as const,
    expiresIn: env.JWT_EXPIRES_IN,
    user: toPublicUser(user),
  };
}

export const authService = {
  async register(input: RegisterInput) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new ApiError(409, 'CONFLICT', 'An account with this email already exists');
    }

    const user = await userRepository.create({
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      password: await hashPassword(input.password),
      location: input.location,
      role: 'CUSTOMER',
    });

    return authResponse(user);
  },

  async login(input: LoginInput) {
    const user = await userRepository.findByEmailWithSecret(input.email);
    const matches = await verifyPassword(input.password, user?.password ?? null);
    if (!user || !matches) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    if (!user.isActive) {
      throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account is deactivated');
    }
    return authResponse(user);
  },

  async logout(user: AuthUser, authorization: string | undefined) {
    const claims = verifyAccessToken(readBearerToken(authorization));
    if (claims.sub !== user.id || claims.jti !== user.jti) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    await tokenRepository.revoke({
      jti: user.jti,
      userId: user.id,
      expiresAt: new Date(claims.exp * 1000),
    });
  },

  async changePassword(user: AuthUser, input: ChangePasswordInput) {
    const stored = await userRepository.findByIdWithSecret(user.id);
    if (!stored || !(await verifyPassword(input.currentPassword, stored.password))) {
      throw new ApiError(400, 'INVALID_CREDENTIALS', 'Current password is incorrect');
    }
    await userRepository.updatePassword(user.id, await hashPassword(input.newPassword));
  },

  async forgotPassword(email: string) {
    const user = await userRepository.findByEmailForReset(email);
    if (user?.isActive) {
      const token = generateResetToken();
      const expires = new Date(Date.now() + env.PASSWORD_RESET_MINUTES * 60 * 1000);
      await userRepository.setResetToken(user.id, hashToken(token), expires);
      try {
        await sendPasswordReset(user.email, token);
      } catch (error) {
        logger.error(
          'Failed to send password reset email',
          error instanceof Error ? error : undefined,
        );
      }
    }

    return {
      message:
        'If an account exists for that email, password reset instructions have been created.',
    };
  },

  async resetPassword(input: ResetPasswordInput) {
    const password = await hashPassword(input.password);
    const updated = await userRepository.consumePasswordReset(hashToken(input.token), password);
    if (updated.count !== 1) {
      throw new ApiError(400, 'INVALID_RESET_TOKEN', 'Reset token is invalid or has expired');
    }
  },
};
