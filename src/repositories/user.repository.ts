import { Prisma, type Role } from '@prisma/client';
import { prisma } from '../config/prisma';

export const userPublicSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  profileImage: true,
  location: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const userWithTokenSelect = {
  ...userPublicSelect,
  tokenVersion: true,
} satisfies Prisma.UserSelect;

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email }, select: userPublicSelect });
  },

  findByEmailWithSecret(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { ...userWithTokenSelect, password: true },
    });
  },

  findByIdWithSecret(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { ...userWithTokenSelect, password: true },
    });
  },

  findAuthState(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, isActive: true, tokenVersion: true },
    });
  },

  findPublicById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: userPublicSelect });
  },

  findByIdWithTokenVersion(id: string) {
    return prisma.user.findUnique({ where: { id }, select: userWithTokenSelect });
  },

  findByEmailForReset(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, isActive: true },
    });
  },

  create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data, select: userWithTokenSelect });
  },

  updateProfile(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data, select: userPublicSelect });
  },

  updatePassword(id: string, password: string) {
    return prisma.user.update({
      where: { id },
      data: {
        password,
        tokenVersion: { increment: 1 },
        passwordResetToken: null,
        passwordResetExpires: null,
      },
      select: userPublicSelect,
    });
  },

  consumePasswordReset(passwordResetToken: string, password: string) {
    return prisma.user.updateMany({
      where: {
        passwordResetToken,
        isActive: true,
        passwordResetExpires: { gt: new Date() },
      },
      data: {
        password,
        tokenVersion: { increment: 1 },
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
  },

  setResetToken(id: string, passwordResetToken: string, passwordResetExpires: Date) {
    return prisma.user.update({
      where: { id },
      data: { passwordResetToken, passwordResetExpires },
      select: { id: true },
    });
  },

  setActive(id: string, isActive: boolean) {
    return prisma.user.update({ where: { id }, data: { isActive }, select: userPublicSelect });
  },

  countActiveAdmins(exceptUserId?: string) {
    return prisma.user.count({
      where: {
        role: 'ADMIN',
        isActive: true,
        ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
      },
    });
  },

  list(params: { skip: number; take: number; role?: Role; search?: string; isActive?: boolean }) {
    const where: Prisma.UserWhereInput = {
      ...(params.role ? { role: params.role } : {}),
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params.search
        ? {
            OR: [
              { fullName: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return prisma.$transaction([
      prisma.user.findMany({
        where,
        select: userPublicSelect,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      prisma.user.count({ where }),
    ]);
  },

  countByRole() {
    return prisma.user.groupBy({
      by: ['role'],
      _count: { _all: true },
    });
  },

  countAll() {
    return prisma.user.count();
  },

  countActive() {
    return prisma.user.count({ where: { isActive: true } });
  },
};
