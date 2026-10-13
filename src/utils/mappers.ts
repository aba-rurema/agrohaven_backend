import type { User } from '@prisma/client';

export type PublicUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: User['role'];
  profileImage: string | null;
  location: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function toPublicUser(user: PublicUser): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    profileImage: user.profileImage,
    location: user.location,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
