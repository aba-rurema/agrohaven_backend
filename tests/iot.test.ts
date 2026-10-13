import request from 'supertest';
import { markStaleDevices } from '../src/modules/devices/presence';
import { app, prisma, registerUser, resetDatabase } from './helpers';

const email = `iot.${Date.now()}@agrohaven.test`;
const hardwareId = 'AH-IOT-001';

beforeAll(async () => {
  try {
    await prisma.$connect();
    await resetDatabase();
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown database error';
    throw new Error(
      `Cannot reach the test database. Create agrohaven_test, then run prisma migrate deploy with TEST_DATABASE_URL. ${reason}`,
    );
  }
});

afterAll(async () => {
  try {
    await resetDatabase();
  } catch {
    // The database may be unreachable. Disconnect still needs to run.
  }
  await prisma.$disconnect();
});

describe('IoT devices', () => {
  let token = '';
  let farmingUnitId = '';
  let deviceRecordId = '';
  let apiKey = '';
  const equipmentIds: Record<string, string> = {};

  function deviceHeaders() {
    return {
      'X-Device-Id': hardwareId,
      'X-Device-Key': apiKey,
    };
  }

  it('registers a user, farming unit, and device', async () => {
    const user = await registerUser(email);
    expect(user.response.status).toBe(201);
    token = user.token ?? '';

    const unit = await request(app)
      .post('/api/v1/farming-units')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'IoT Tower',
        location: 'Kacyiru, Kigali',
        deviceId: hardwareId,
      });
    expect(unit.status).toBe(201);
    farmingUnitId = unit.body.data.id;

    const registered = await request(app)
      .post('/api/v1/devices/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        farmingUnitId,
        deviceIdentifier: hardwareId,
        firmwareVersion: '1.0.0',
      });
    expect(registered.status).toBe(201);
    expect(registered.body.data.device.apiKeyHash).toBeUndefined();
    expect(registered.body.data.device.status).toBe('OFFLINE');
    expect(registered.body.data.device.lastSeen).toBeNull();
    deviceRecordId = registered.body.data.device.id;
    apiKey = registered.body.data.apiKey;
  });

  it('rejects telemetry that is not authenticated as the device', async () => {
    const missing = await request(app)
      .post('/api/v1/devices/telemetry')
      .send({ temperature: 24, waterLevel: 80 });
    expect(missing.status).toBe(401);

    const userToken = await request(app)
      .post('/api/v1/devices/telemetry')
      .set('Authorization', `Bearer ${token}`)
      .send({ temperature: 24, waterLevel: 80 });
    expect(userToken.status).toBe(401);

    const wrongKey = await request(app)
      .post('/api/v1/devices/telemetry')
      .set('X-Device-Id', hardwareId)
      .set('X-Device-Key', 'not-the-device-key')
      .send({ temperature: 24, waterLevel: 80 });
    expect(wrongKey.status).toBe(401);
    expect(wrongKey.body.error.code).toBe('INVALID_DEVICE_CREDENTIALS');
  });

  it('does not change equipment power while the device is offline', async () => {
    const actuators = [
      ['WATER_PUMP', 'Water pump'],
      ['MIST_PUMP', 'Mist pump'],
      ['LED_GROW_LIGHT', 'LED grow lights'],
      ['FAN', 'Fan'],
    ] as const;

    for (const [type, name] of actuators) {
      const created = await request(app)
        .post('/api/v1/equipment')
        .set('Authorization', `Bearer ${token}`)
        .send({ farmingUnitId, name, type, powerState: 'OFF' });
      expect(created.status).toBe(201);
      equipmentIds[type] = created.body.data.equipment.id;

      const control = await request(app)
        .post('/api/v1/equipment/control')
        .set('Authorization', `Bearer ${token}`)
        .send({ farmingUnitId, type, powerState: 'ON' });
      expect(control.status).toBe(409);
      expect(control.body.error.code).toBe('DEVICE_OFFLINE');

      const stored = await request(app)
        .get(`/api/v1/equipment/${equipmentIds[type]}`)
        .set('Authorization', `Bearer ${token}`);
      expect(stored.body.data.powerState).toBe('OFF');
    }

    const missing = await request(app)
      .post('/api/v1/equipment/control')
      .set('Authorization', `Bearer ${token}`)
      .send({ farmingUnitId, type: 'OTHER', powerState: 'ON' });
    expect(missing.status).toBe(404);
  });

  it('records a heartbeat and accepts telemetry from the device', async () => {
    const heartbeat = await request(app)
      .post('/api/v1/devices/heartbeat')
      .set(deviceHeaders())
      .send({ firmwareVersion: '1.1.0' });
    expect(heartbeat.status).toBe(200);
    expect(heartbeat.body.data.status).toBe('ONLINE');
    expect(heartbeat.body.data.lastSeen).toEqual(expect.any(String));
    expect(heartbeat.body.data.apiKeyHash).toBeUndefined();

    const telemetry = await request(app)
      .post('/api/v1/devices/telemetry')
      .set(deviceHeaders())
      .send({
        temperature: 24,
        humidity: 60,
        waterLevel: 80,
        extra: { soilMoisture: 40 },
      });
    expect(telemetry.status).toBe(201);
    expect(telemetry.body.data.reading.temperature).toBe(24);
    expect(telemetry.body.data.reading.extra.soilMoisture).toBe(40);
    expect(telemetry.body.data.status).toBe('ONLINE');
    expect(telemetry.body.data.lastSeen).toEqual(expect.any(String));
    expect(telemetry.body.data.commands).toEqual([]);

    const device = await request(app)
      .get(`/api/v1/devices/${deviceRecordId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(device.body.data.status).toBe('ONLINE');
    expect(Date.now() - new Date(device.body.data.lastSeen).getTime()).toBeLessThan(60_000);

    const alerts = await request(app)
      .get('/api/v1/alerts/unread')
      .set('Authorization', `Bearer ${token}`);
    const types = alerts.body.data.map((alert: { type: string }) => alert.type);
    expect(types).not.toContain('LOW_WATER');
    expect(types).not.toContain('HIGH_TEMPERATURE');
  });

  it('queues power commands for each actuator and returns them with the next telemetry', async () => {
    for (const type of ['WATER_PUMP', 'MIST_PUMP', 'LED_GROW_LIGHT', 'FAN']) {
      const control = await request(app)
        .post('/api/v1/equipment/control')
        .set('Authorization', `Bearer ${token}`)
        .send({ farmingUnitId, type, powerState: 'ON' });
      expect(control.status).toBe(200);
      expect(control.body.data.delivered).toBe(true);
      expect(control.body.data.equipment[0].powerState).toBe('ON');
      expect(control.body.data.commands[0].command).toBe('SET_POWER');
      expect(control.body.data.commands[0].payload).toMatchObject({
        powerState: 'ON',
        equipmentType: type,
      });
    }

    const telemetry = await request(app)
      .post('/api/v1/devices/telemetry')
      .set(deviceHeaders())
      .send({ temperature: 25, waterLevel: 75 });
    expect(telemetry.status).toBe(201);
    const types = telemetry.body.data.commands.map(
      (command: { payload: { equipmentType: string } }) => command.payload.equipmentType,
    );
    expect(types).toEqual(['WATER_PUMP', 'MIST_PUMP', 'LED_GROW_LIGHT', 'FAN']);

    const waterCommand = telemetry.body.data.commands.find(
      (command: { payload: { equipmentType: string } }) =>
        command.payload.equipmentType === 'WATER_PUMP',
    );
    const ack = await request(app)
      .post(`/api/v1/devices/commands/${waterCommand.id}/ack`)
      .set(deviceHeaders())
      .send({ status: 'ACKNOWLEDGED' });
    expect(ack.status).toBe(200);

    const remaining = await request(app).get('/api/v1/devices/commands').set(deviceHeaders());
    const remainingTypes = remaining.body.data.map(
      (command: { payload: { equipmentType: string } }) => command.payload.equipmentType,
    );
    expect(remainingTypes).not.toContain('WATER_PUMP');
  });

  it('creates low-water and high-temperature alerts from configured thresholds', async () => {
    const reading = await request(app)
      .post('/api/v1/devices/telemetry')
      .set(deviceHeaders())
      .send({ temperature: 40, waterLevel: 5 });
    expect(reading.status).toBe(201);

    const alerts = await request(app)
      .get('/api/v1/alerts/unread')
      .set('Authorization', `Bearer ${token}`);
    const types = alerts.body.data.map((alert: { type: string }) => alert.type);
    expect(types).toContain('LOW_WATER');
    expect(types).toContain('HIGH_TEMPERATURE');

    await request(app)
      .post('/api/v1/devices/telemetry')
      .set(deviceHeaders())
      .send({ temperature: 41, waterLevel: 4 });

    const again = await request(app)
      .get('/api/v1/alerts/unread')
      .set('Authorization', `Bearer ${token}`);
    const lowWater = again.body.data.filter((alert: { type: string }) => alert.type === 'LOW_WATER');
    const highTemp = again.body.data.filter(
      (alert: { type: string }) => alert.type === 'HIGH_TEMPERATURE',
    );
    expect(lowWater).toHaveLength(1);
    expect(highTemp).toHaveLength(1);
  });

  it('accepts an extra sensor threshold without a schema change', async () => {
    const updated = await request(app)
      .patch(`/api/v1/devices/${deviceRecordId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        configuration: {
          alertThresholds: {
            additional: [
              {
                metric: 'soilMoisture',
                operator: 'lt',
                value: 20,
                alertType: 'SYSTEM_ERROR',
                severity: 'WARNING',
                title: 'Low soil moisture',
                message: 'Soil moisture is below the configured threshold.',
              },
            ],
          },
        },
      });
    expect(updated.status).toBe(200);

    const reading = await request(app)
      .post('/api/v1/devices/telemetry')
      .set(deviceHeaders())
      .send({ extra: { soilMoisture: 10 } });
    expect(reading.status).toBe(201);
    expect(reading.body.data.reading.extra.soilMoisture).toBe(10);

    const alerts = await request(app)
      .get('/api/v1/alerts/unread')
      .set('Authorization', `Bearer ${token}`);
    expect(alerts.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'SYSTEM_ERROR',
          title: 'Low soil moisture',
          farmingUnitId,
        }),
      ]),
    );
  });

  it('marks a silent device offline and refuses further power changes', async () => {
    const activated = await request(app)
      .patch(`/api/v1/farming-units/${farmingUnitId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ACTIVE' });
    expect(activated.status).toBe(200);

    await prisma.device.update({
      where: { id: deviceRecordId },
      data: { status: 'ONLINE', lastSeen: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const updated = await markStaleDevices();
    expect(updated).toBe(1);

    const device = await request(app)
      .get(`/api/v1/devices/${deviceRecordId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(device.body.data.status).toBe('OFFLINE');

    const unit = await request(app)
      .get(`/api/v1/farming-units/${farmingUnitId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(unit.body.data.status).toBe('OFFLINE');

    const alerts = await request(app)
      .get('/api/v1/alerts/unread')
      .set('Authorization', `Bearer ${token}`);
    expect(alerts.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'DEVICE_OFFLINE', farmingUnitId }),
      ]),
    );

    const status = await request(app)
      .get(`/api/v1/equipment/${equipmentIds.WATER_PUMP}/status`)
      .set('Authorization', `Bearer ${token}`);
    expect(status.body.data.powerState).toBe('ON');
    expect(status.body.data.deviceOnline).toBe(false);

    const control = await request(app)
      .post('/api/v1/equipment/control')
      .set('Authorization', `Bearer ${token}`)
      .send({ farmingUnitId, type: 'FAN', powerState: 'OFF' });
    expect(control.status).toBe(409);
    expect(control.body.error.code).toBe('DEVICE_OFFLINE');

    const fan = await request(app)
      .get(`/api/v1/equipment/${equipmentIds.FAN}`)
      .set('Authorization', `Bearer ${token}`);
    expect(fan.body.data.powerState).toBe('ON');

    await prisma.alert.deleteMany({ where: { type: 'DEVICE_OFFLINE' } });
    await prisma.farmingUnit.update({
      where: { id: farmingUnitId },
      data: { status: 'MAINTENANCE' },
    });
    await prisma.device.update({
      where: { id: deviceRecordId },
      data: { status: 'ONLINE', lastSeen: new Date(Date.now() - 60 * 60 * 1000) },
    });

    await markStaleDevices();

    const maintained = await prisma.farmingUnit.findUnique({ where: { id: farmingUnitId } });
    expect(maintained?.status).toBe('MAINTENANCE');
    const offlineAlert = await prisma.alert.findFirst({
      where: { farmingUnitId, type: 'DEVICE_OFFLINE' },
    });
    expect(offlineAlert).not.toBeNull();
  });
});
