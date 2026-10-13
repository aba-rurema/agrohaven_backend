import { alertRepository } from '../repositories/alert.repository';
import { cropRepository } from '../repositories/crop.repository';
import { deviceRepository } from '../repositories/device.repository';
import { equipmentRepository } from '../repositories/equipment.repository';
import { farmingUnitRepository } from '../repositories/farming-unit.repository';
import { harvestRepository } from '../repositories/harvest.repository';
import { sensorRepository } from '../repositories/sensor.repository';
import { waterUsageRepository } from '../repositories/water-usage.repository';
import { userService } from './user.service';
import { requireFarmingUnit } from './access.service';
import { toWaterTotals } from '../modules/water/statistics';
import { isDeviceOnline } from '../modules/devices/presence';
import type { AuthUser } from '../types';

export const dashboardService = {
  async get(user: AuthUser, farmingUnitId?: string) {
    const profile = await userService.getMe(user);
    const units = farmingUnitId
      ? [await requireFarmingUnit(user, farmingUnitId, 'read')].map((unit) => ({
          id: unit.id,
          name: unit.name,
          status: unit.status,
          location: unit.location,
        }))
      : await farmingUnitRepository.findOwnedSummary(user.id);

    const ids = units.map((unit) => unit.id);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const [devicePage, reading, alertPage, equipment, crops, harvests, waterAll, waterRecent, latestByUnit, unreadByUnit, unreadAlertCount] =
      await Promise.all([
        deviceRepository.list({ skip: 0, take: Math.max(ids.length, 1), farmingUnitIds: ids }),
        sensorRepository.latestForUnits(ids),
        alertRepository.list({
          userId: user.id,
          isRead: false,
          farmingUnitId,
          skip: 0,
          take: 10,
        }),
        equipmentRepository.listByUnits(ids),
        cropRepository.listCurrent(ids),
        harvestRepository.recentForUnits(ids, 5),
        waterUsageRepository.totalsForUnits(ids),
        waterUsageRepository.totalsForUnits(ids, since, now),
        sensorRepository.latestByUnits(ids),
        alertRepository.countUnreadByUnits(user.id, ids),
        alertRepository.countUnread(user.id),
      ]);

    const devicesByUnit = new Map(
      devicePage[0].filter((device) => device.farmingUnitId).map((device) => [device.farmingUnitId, device]),
    );
    const readingsByUnit = new Map(latestByUnit.map((row) => [row.farmingUnitId, row]));
    const unreadByFarm = new Map(
      unreadByUnit
        .filter((row) => row.farmingUnitId)
        .map((row) => [row.farmingUnitId as string, row._count._all]),
    );
    const equipmentByUnit = new Map<string, { total: number; poweredOn: number }>();
    for (const item of equipment) {
      const current = equipmentByUnit.get(item.farmingUnitId) ?? { total: 0, poweredOn: 0 };
      current.total += 1;
      if (item.powerState === 'ON') current.poweredOn += 1;
      equipmentByUnit.set(item.farmingUnitId, current);
    }

    return {
      user: profile,
      unreadAlertCount,
      cards: units.map((unit) => {
        const device = devicesByUnit.get(unit.id) ?? null;
        const latest = readingsByUnit.get(unit.id) ?? null;
        return {
          id: unit.id,
          name: unit.name,
          location: unit.location,
          status: unit.status,
          device: device
            ? {
                id: device.id,
                status: device.status,
                lastSeen: device.lastSeen,
                online: isDeviceOnline(device),
              }
            : null,
          latestReading: latest
            ? {
                temperature: latest.temperature,
                humidity: latest.humidity,
                waterLevel: latest.waterLevel,
                lightIntensity: latest.lightIntensity,
                airQuality: latest.airQuality,
                timestamp: latest.timestamp,
              }
            : null,
          unreadAlerts: unreadByFarm.get(unit.id) ?? 0,
          equipment: equipmentByUnit.get(unit.id) ?? { total: 0, poweredOn: 0 },
        };
      }),
      farmingUnits: {
        total: units.length,
        active: units.filter((unit) => unit.status === 'ACTIVE').length,
        items: units,
      },
      devices: devicePage[0].map((device) => ({
        id: device.id,
        farmingUnitId: device.farmingUnitId,
        deviceIdentifier: device.deviceIdentifier,
        status: device.status,
        lastSeen: device.lastSeen,
        firmwareVersion: device.firmwareVersion,
        online: isDeviceOnline(device),
      })),
      latestReadings: {
        farmingUnitId: reading?.farmingUnitId ?? null,
        temperature: reading?.temperature ?? null,
        humidity: reading?.humidity ?? null,
        waterLevel: reading?.waterLevel ?? null,
        lightIntensity: reading?.lightIntensity ?? null,
        airQuality: reading?.airQuality ?? null,
        timestamp: reading?.timestamp ?? null,
      },
      activeAlerts: alertPage[0],
      equipment,
      crops,
      recentHarvests: harvests,
      waterUsage: {
        totals: toWaterTotals(waterAll),
        last30Days: toWaterTotals(waterRecent),
      },
    };
  },
};
