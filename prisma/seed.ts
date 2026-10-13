import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password';
import { hashDeviceKey } from '../src/utils/secrets';

const prisma = new PrismaClient();

const ids = {
  admin: '11111111-1111-4111-8111-111111111111',
  customer: '22222222-2222-4222-8222-222222222222',
  technician: '33333333-3333-4333-8333-333333333333',
  unit: '44444444-4444-4444-8444-444444444444',
  device: '55555555-5555-4555-8555-555555555555',
  pump: '66666666-6666-4666-8666-666666666666',
  mist: '77777777-7777-4777-8777-777777777777',
  light: '88888888-8888-4888-8888-888888888888',
  fan: '99999999-9999-4999-8999-999999999999',
  growingCrop: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  harvestedCrop: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  harvest: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  automation: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  alert: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
};

const deviceIdentifier = 'AH-UNIT-001';
const developmentDeviceKey = 'dev-agrohaven-device-key';

async function main(): Promise<void> {
  const [adminPassword, customerPassword, technicianPassword] = await Promise.all([
    hashPassword('AdminPass1'),
    hashPassword('CustomerPass1'),
    hashPassword('TechPass123'),
  ]);

  await prisma.user.upsert({
    where: { email: 'admin@agrohaven.local' },
    update: { password: adminPassword, isActive: true, role: 'ADMIN' },
    create: {
      id: ids.admin,
      fullName: 'AgroHaven Admin',
      email: 'admin@agrohaven.local',
      phone: '+250788000001',
      password: adminPassword,
      role: 'ADMIN',
      location: 'Kigali',
    },
  });

  await prisma.user.upsert({
    where: { email: 'customer@agrohaven.local' },
    update: { password: customerPassword, isActive: true },
    create: {
      id: ids.customer,
      fullName: 'Aline Uwase',
      email: 'customer@agrohaven.local',
      phone: '+250788000002',
      password: customerPassword,
      role: 'CUSTOMER',
      location: 'Kacyiru, Kigali',
    },
  });

  await prisma.user.upsert({
    where: { email: 'technician@agrohaven.local' },
    update: { password: technicianPassword, isActive: true, role: 'TECHNICIAN' },
    create: {
      id: ids.technician,
      fullName: 'Eric Habimana',
      email: 'technician@agrohaven.local',
      phone: '+250788000003',
      password: technicianPassword,
      role: 'TECHNICIAN',
      location: 'Kigali',
    },
  });

  await prisma.farmingUnit.upsert({
    where: { id: ids.unit },
    update: {
      name: 'Kacyiru Tower',
      status: 'ACTIVE',
      deviceId: deviceIdentifier,
      ownerId: ids.customer,
    },
    create: {
      id: ids.unit,
      name: 'Kacyiru Tower',
      ownerId: ids.customer,
      location: 'Kacyiru, Kigali',
      status: 'ACTIVE',
      deviceId: deviceIdentifier,
      installationDate: new Date('2026-03-01T00:00:00.000Z'),
    },
  });

  await prisma.device.upsert({
    where: { deviceIdentifier },
    update: {
      farmingUnitId: ids.unit,
      status: 'ONLINE',
      lastSeen: new Date(),
      firmwareVersion: '1.0.0',
      apiKeyHash: hashDeviceKey(developmentDeviceKey),
    },
    create: {
      id: ids.device,
      deviceIdentifier,
      apiKeyHash: hashDeviceKey(developmentDeviceKey),
      farmingUnitId: ids.unit,
      status: 'ONLINE',
      lastSeen: new Date(),
      firmwareVersion: '1.0.0',
      health: { batteryPercent: 86, sensorError: false },
      configuration: { sampleIntervalSeconds: 60 },
    },
  });

  const equipment = [
    { id: ids.pump, name: 'Reservoir pump', type: 'WATER_PUMP' as const },
    { id: ids.mist, name: 'Root mist pump', type: 'MIST_PUMP' as const },
    { id: ids.light, name: 'Grow lights', type: 'LED_GROW_LIGHT' as const },
    { id: ids.fan, name: 'Circulation fan', type: 'FAN' as const },
  ];

  for (const item of equipment) {
    await prisma.equipment.upsert({
      where: { id: item.id },
      update: { name: item.name, type: item.type, farmingUnitId: ids.unit },
      create: {
        id: item.id,
        farmingUnitId: ids.unit,
        name: item.name,
        type: item.type,
        status: 'ONLINE',
        powerState: 'OFF',
      },
    });
  }

  await prisma.sensorReading.deleteMany({ where: { deviceId: ids.device } });
  const now = Date.now();
  await prisma.sensorReading.createMany({
    data: [
      {
        deviceId: ids.device,
        farmingUnitId: ids.unit,
        temperature: 23.4,
        humidity: 68,
        lightIntensity: 12000,
        airQuality: 38,
        waterLevel: 72,
        timestamp: new Date(now - 2 * 60 * 60 * 1000),
      },
      {
        deviceId: ids.device,
        farmingUnitId: ids.unit,
        temperature: 24.1,
        humidity: 66,
        lightIntensity: 18000,
        airQuality: 41,
        waterLevel: 64,
        timestamp: new Date(now - 60 * 60 * 1000),
      },
      {
        deviceId: ids.device,
        farmingUnitId: ids.unit,
        temperature: 24.8,
        humidity: 63,
        lightIntensity: 21000,
        airQuality: 44,
        waterLevel: 58,
        extra: { nutrientEc: 1.4 },
        timestamp: new Date(now - 5 * 60 * 1000),
      },
    ],
  });

  await prisma.automation.upsert({
    where: { id: ids.automation },
    update: { enabled: true },
    create: {
      id: ids.automation,
      farmingUnitId: ids.unit,
      name: 'Refill when water is low',
      type: 'THRESHOLD',
      enabled: true,
      condition: { metric: 'waterLevel', operator: 'lt', value: 15 },
      action: { kind: 'equipment', equipmentType: 'WATER_PUMP', powerState: 'ON' },
    },
  });

  await prisma.crop.upsert({
    where: { id: ids.growingCrop },
    update: { status: 'GROWING' },
    create: {
      id: ids.growingCrop,
      farmingUnitId: ids.unit,
      name: 'Lettuce',
      variety: 'Butterhead',
      plantingDate: new Date('2026-09-01T00:00:00.000Z'),
      expectedHarvestDate: new Date('2026-10-20T00:00:00.000Z'),
      status: 'GROWING',
      notes: 'First tower cycle',
    },
  });

  await prisma.crop.upsert({
    where: { id: ids.harvestedCrop },
    update: {},
    create: {
      id: ids.harvestedCrop,
      farmingUnitId: ids.unit,
      name: 'Basil',
      variety: 'Genovese',
      plantingDate: new Date('2026-07-01T00:00:00.000Z'),
      expectedHarvestDate: new Date('2026-08-15T00:00:00.000Z'),
      actualHarvestDate: new Date('2026-08-16T00:00:00.000Z'),
      status: 'HARVESTED',
    },
  });

  await prisma.harvest.upsert({
    where: { id: ids.harvest },
    update: {},
    create: {
      id: ids.harvest,
      cropId: ids.harvestedCrop,
      quantity: 1.2,
      unit: 'kg',
      harvestDate: new Date('2026-08-16T00:00:00.000Z'),
      quality: 'Good',
      notes: 'Recorded harvest weight',
    },
  });

  await prisma.waterUsage.deleteMany({ where: { farmingUnitId: ids.unit } });
  await prisma.waterUsage.createMany({
    data: [
      {
        farmingUnitId: ids.unit,
        amountUsed: 3.5,
        unit: 'liters',
        recordedAt: new Date(now - 24 * 60 * 60 * 1000),
      },
      {
        farmingUnitId: ids.unit,
        amountUsed: 2.8,
        unit: 'liters',
        recordedAt: new Date(now - 2 * 60 * 60 * 1000),
      },
    ],
  });

  await prisma.alert.upsert({
    where: { id: ids.alert },
    update: { isRead: false },
    create: {
      id: ids.alert,
      userId: ids.customer,
      farmingUnitId: ids.unit,
      type: 'MAINTENANCE_REQUIRED',
      severity: 'INFO',
      title: 'Monthly inspection',
      message: 'Schedule a nozzle inspection for Kacyiru Tower.',
      isRead: false,
    },
  });

  console.log('Seed complete.');
  console.log('Development accounts:');
  console.log('  admin@agrohaven.local / AdminPass1');
  console.log('  customer@agrohaven.local / CustomerPass1');
  console.log('  technician@agrohaven.local / TechPass123');
  console.log(`Development device key for ${deviceIdentifier}: ${developmentDeviceKey}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
