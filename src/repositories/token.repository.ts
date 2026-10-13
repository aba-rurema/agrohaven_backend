import { prisma } from '../config/prisma';

export const tokenRepository = {
  revoke(data: { jti: string; userId: string; expiresAt: Date }) {
    return prisma.revokedToken.upsert({
      where: { jti: data.jti },
      update: {},
      create: data,
    });
  },

  isRevoked(jti: string) {
    return prisma.revokedToken.findUnique({ where: { jti }, select: { id: true } });
  },

  deleteExpired(now = new Date()) {
    return prisma.revokedToken.deleteMany({ where: { expiresAt: { lt: now } } });
  },
};
