import type { DeviceStatus } from '@prisma/client';
import { env } from '../../config/env';
import { alertRepository } from '../../repositories/alert.repository';
import { deviceRepository } from '../../repositories/device.repository';
import { farmingUnitRepository } from '../../repositories/farming-unit.repository';

export function isDeviceOnline(
  device: { status: DeviceStatus; lastSeen: Date | null },
  now = new Date(),
): boolean {
  if (device.status !== 'ONLINE') return false;
  if (!device.lastSeen) return false;
  const thresholdMs = env.DEVICE_OFFLINE_AFTER_MINUTES * 60 * 1000;
  return now.getTime() - device.lastSeen.getTime() <= thresholdMs;
}

export async function markStaleDevices(): Promise<number> {
  const cutoff = new Date(Date.now() - env.DEVICE_OFFLINE_AFTER_MINUTES * 60 * 1000);
  const stale = await deviceRepository.findStaleOnline(cutoff);
  let updated = 0;

  for (const device of stale) {
    await deviceRepository.update(device.id, { status: 'OFFLINE' });
    updated += 1;

    if (!device.farmingUnit) continue;

    if (device.farmingUnit.status === 'ACTIVE') {
      await farmingUnitRepository.update(device.farmingUnit.id, { status: 'OFFLINE' });
    }

    const since = new Date(Date.now() - env.ALERT_DEDUPE_MINUTES * 60 * 1000);
    const duplicate = await alertRepository.findRecentDuplicate({
      userId: device.farmingUnit.ownerId,
      farmingUnitId: device.farmingUnit.id,
      type: 'DEVICE_OFFLINE',
      since,
    });
    if (duplicate) continue;

    await alertRepository.create({
      userId: device.farmingUnit.ownerId,
      farmingUnitId: device.farmingUnit.id,
      type: 'DEVICE_OFFLINE',
      severity: 'WARNING',
      title: 'Device offline',
      message: `The device has not communicated for ${env.DEVICE_OFFLINE_AFTER_MINUTES} minutes.`,
    });
  }

  return updated;
}
