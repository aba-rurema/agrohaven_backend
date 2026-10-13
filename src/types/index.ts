import type { Role } from '@prisma/client';

export type AuthUser = {
  id: string;
  role: Role;
  jti: string;
  tokenVersion: number;
};

export type DevicePrincipal = {
  id: string;
  deviceIdentifier: string;
  farmingUnitId: string | null;
};
