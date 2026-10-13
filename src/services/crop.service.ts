import { CropStatus } from '@prisma/client';
import { cropRepository } from '../repositories/crop.repository';
import { harvestRepository } from '../repositories/harvest.repository';
import type { AuthUser } from '../types';
import { ApiError } from '../utils/api-error';
import { appliedSort, getPagination, pageMeta } from '../utils/pagination';
import type {
  CreateCropInput,
  ListCropsQuery,
  UpdateCropInput,
} from '../validators/crop.validator';
import { requireFarmingUnit } from './access.service';

const statuses: CropStatus[] = ['PLANTED', 'GROWING', 'READY_FOR_HARVEST', 'HARVESTED', 'FAILED'];

export const cropService = {
  async create(user: AuthUser, input: CreateCropInput) {
    await requireFarmingUnit(user, input.farmingUnitId, 'manage');
    return cropRepository.create({
      farmingUnitId: input.farmingUnitId,
      name: input.name,
      variety: input.variety,
      plantingDate: input.plantingDate,
      expectedHarvestDate: input.expectedHarvestDate,
      actualHarvestDate: input.actualHarvestDate,
      status: input.status ?? 'PLANTED',
      notes: input.notes,
    });
  },

  async list(user: AuthUser, query: ListCropsQuery) {
    await requireFarmingUnit(user, query.farmingUnitId, 'read');
    const { skip, take } = getPagination(query.page, query.limit);
    const sort = appliedSort(query.sort, 'plantingDate', query.order);
    const [items, total] = await cropRepository.list({
      farmingUnitId: query.farmingUnitId,
      status: query.status,
      search: query.search,
      sort: sort.sort as 'plantingDate' | 'name' | 'status' | 'createdAt',
      order: sort.order,
      skip,
      take,
    });
    return { items, meta: pageMeta(query.page, query.limit, total, sort) };
  },

  async statistics(user: AuthUser, farmingUnitId: string) {
    await requireFarmingUnit(user, farmingUnitId, 'read');
    const [grouped, harvests] = await Promise.all([
      cropRepository.countByStatus(farmingUnitId),
      harvestRepository.sumByUnitForFarmingUnit(farmingUnitId),
    ]);
    const byStatus = Object.fromEntries(statuses.map((status) => [status, 0])) as Record<
      CropStatus,
      number
    >;
    for (const row of grouped) byStatus[row.status] = row._count._all;
    const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
    return {
      total,
      byStatus,
      recordedHarvests: harvests.map((row) => ({
        unit: row.unit,
        quantity: row._sum.quantity ?? 0,
        count: row._count._all,
      })),
    };
  },

  async getById(user: AuthUser, id: string) {
    const crop = await cropRepository.findById(id);
    if (!crop) throw new ApiError(404, 'NOT_FOUND', 'Crop not found');
    await requireFarmingUnit(user, crop.farmingUnitId, 'read');
    return crop;
  },

  async update(user: AuthUser, id: string, input: UpdateCropInput) {
    const crop = await this.getById(user, id);
    await requireFarmingUnit(user, crop.farmingUnitId, 'manage');
    const plantingDate = input.plantingDate ?? crop.plantingDate;
    if (input.expectedHarvestDate && input.expectedHarvestDate < plantingDate) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Expected harvest date cannot be before the planting date',
      );
    }
    if (input.actualHarvestDate && input.actualHarvestDate < plantingDate) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Actual harvest date cannot be before the planting date',
      );
    }
    return cropRepository.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.variety !== undefined ? { variety: input.variety } : {}),
      ...(input.plantingDate !== undefined ? { plantingDate: input.plantingDate } : {}),
      ...(input.expectedHarvestDate !== undefined
        ? { expectedHarvestDate: input.expectedHarvestDate }
        : {}),
      ...(input.actualHarvestDate !== undefined
        ? { actualHarvestDate: input.actualHarvestDate }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    });
  },

  async remove(user: AuthUser, id: string) {
    const crop = await this.getById(user, id);
    await requireFarmingUnit(user, crop.farmingUnitId, 'manage');
    await cropRepository.delete(id);
  },
};
