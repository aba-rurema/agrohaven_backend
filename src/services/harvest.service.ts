import { cropRepository } from '../repositories/crop.repository';
import { harvestRepository } from '../repositories/harvest.repository';
import type { AuthUser } from '../types';
import { ApiError } from '../utils/api-error';
import { appliedSort, getPagination, pageMeta } from '../utils/pagination';
import type { CreateHarvestInput, ListHarvestsQuery } from '../validators/harvest.validator';
import { requireFarmingUnit } from './access.service';

export const harvestService = {
  async create(user: AuthUser, input: CreateHarvestInput) {
    const crop = await cropRepository.findById(input.cropId);
    if (!crop) throw new ApiError(404, 'NOT_FOUND', 'Crop not found');
    await requireFarmingUnit(user, crop.farmingUnitId, 'manage');
    if (input.harvestDate < crop.plantingDate) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Harvest date cannot be before the planting date',
      );
    }

    const harvest = await harvestRepository.create({
      cropId: crop.id,
      quantity: input.quantity,
      unit: input.unit,
      harvestDate: input.harvestDate,
      quality: input.quality,
      notes: input.notes,
    });

    if (input.markCropHarvested !== false) {
      await cropRepository.update(crop.id, {
        status: 'HARVESTED',
        actualHarvestDate: crop.actualHarvestDate ?? input.harvestDate,
      });
    }

    return harvest;
  },

  async list(user: AuthUser, query: ListHarvestsQuery) {
    if (!query.cropId && !query.farmingUnitId) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'cropId or farmingUnitId is required');
    }
    if (query.farmingUnitId) await requireFarmingUnit(user, query.farmingUnitId, 'read');
    if (query.cropId) {
      const crop = await cropRepository.findById(query.cropId);
      if (!crop) throw new ApiError(404, 'NOT_FOUND', 'Crop not found');
      await requireFarmingUnit(user, crop.farmingUnitId, 'read');
    }
    if (query.from && query.to && query.from >= query.to) {
      throw new ApiError(400, 'VALIDATION_ERROR', '`from` must be earlier than `to`');
    }
    const { skip, take } = getPagination(query.page, query.limit);
    const sort = appliedSort(query.sort, 'harvestDate', query.order);
    const [items, total] = await harvestRepository.list({
      cropId: query.cropId,
      farmingUnitId: query.farmingUnitId,
      from: query.from,
      to: query.to,
      sort: sort.sort as 'harvestDate' | 'quantity' | 'createdAt',
      order: sort.order,
      skip,
      take,
    });
    return { items, meta: pageMeta(query.page, query.limit, total, sort) };
  },

  async getById(user: AuthUser, id: string) {
    const harvest = await harvestRepository.findById(id);
    if (!harvest) throw new ApiError(404, 'NOT_FOUND', 'Harvest not found');
    await requireFarmingUnit(user, harvest.crop.farmingUnitId, 'read');
    return harvest;
  },
};
