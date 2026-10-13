import { Prisma } from '@prisma/client';
import { automationRepository } from '../repositories/automation.repository';
import type { AuthUser } from '../types';
import { ApiError } from '../utils/api-error';
import {
  parseAutomationPayload,
  type CreateAutomationInput,
  type UpdateAutomationInput,
} from '../validators/automation.validator';
import { requireFarmingUnit } from './access.service';

export const automationService = {
  async create(user: AuthUser, input: CreateAutomationInput) {
    await requireFarmingUnit(user, input.farmingUnitId, 'operate');
    const parsed = parseAutomationPayload(input.type, input.condition, input.action);
    return automationRepository.create({
      farmingUnitId: input.farmingUnitId,
      name: input.name,
      type: input.type,
      condition: parsed.condition as Prisma.InputJsonValue,
      action: parsed.action as Prisma.InputJsonValue,
      enabled: input.enabled ?? true,
    });
  },

  async list(user: AuthUser, farmingUnitId: string) {
    await requireFarmingUnit(user, farmingUnitId, 'read');
    return automationRepository.listByUnit(farmingUnitId);
  },

  async getById(user: AuthUser, id: string) {
    const automation = await automationRepository.findById(id);
    if (!automation) throw new ApiError(404, 'NOT_FOUND', 'Automation not found');
    await requireFarmingUnit(user, automation.farmingUnitId, 'read');
    return automation;
  },

  async update(user: AuthUser, id: string, input: UpdateAutomationInput) {
    const current = await this.getById(user, id);
    await requireFarmingUnit(user, current.farmingUnitId, 'operate');
    const nextType = input.type ?? current.type;
    const nextCondition = input.condition ?? current.condition;
    const nextAction = input.action ?? current.action;
    const parsed = parseAutomationPayload(nextType, nextCondition, nextAction);

    return automationRepository.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      type: nextType,
      condition: parsed.condition as Prisma.InputJsonValue,
      action: parsed.action as Prisma.InputJsonValue,
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    });
  },

  async setEnabled(user: AuthUser, id: string, enabled: boolean) {
    const current = await this.getById(user, id);
    await requireFarmingUnit(user, current.farmingUnitId, 'operate');
    return automationRepository.update(id, { enabled });
  },

  async remove(user: AuthUser, id: string) {
    const current = await this.getById(user, id);
    await requireFarmingUnit(user, current.farmingUnitId, 'operate');
    await automationRepository.delete(id);
  },
};
