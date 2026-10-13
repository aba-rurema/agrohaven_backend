import type { AuthUser } from '../types';
import { farmingUnitRepository } from '../repositories/farming-unit.repository';
import { ApiError } from '../utils/api-error';

export type UnitPermission = 'read' | 'operate' | 'manage';

export async function requireFarmingUnit(
  user: AuthUser,
  farmingUnitId: string,
  permission: UnitPermission,
) {
  const unit = await farmingUnitRepository.findById(farmingUnitId);
  if (!unit) throw new ApiError(404, 'NOT_FOUND', 'Farming unit not found');
  if (user.role === 'ADMIN') return unit;

  if (user.role === 'TECHNICIAN') {
    if (permission === 'manage') {
      throw new ApiError(403, 'FORBIDDEN', 'Technicians cannot change this farming unit record');
    }
    return unit;
  }

  if (unit.ownerId !== user.id) {
    throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this farming unit');
  }
  return unit;
}
