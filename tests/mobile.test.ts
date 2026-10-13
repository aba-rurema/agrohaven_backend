import request from 'supertest';
import { app, prisma, registerUser, resetDatabase } from './helpers';

const email = `mobile.${Date.now()}@agrohaven.test`;

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

describe('mobile API contract', () => {
  let token = '';
  let farmingUnitId = '';

  it('returns a bearer token and field errors the login and register screens can bind', async () => {
    const invalid = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Mobile Farmer',
      email,
      password: 'short',
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.success).toBe(false);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalid.body.error.details.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'password', message: expect.any(String) }),
      ]),
    );

    const registered = await registerUser(email);
    expect(registered.response.status).toBe(201);
    expect(registered.response.body.data.tokenType).toBe('Bearer');
    expect(registered.response.body.data.accessToken).toEqual(expect.any(String));
    expect(registered.response.body.data.user.password).toBeUndefined();
    token = registered.token ?? '';

    const badLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPass1' });
    expect(badLogin.status).toBe(401);
    expect(badLogin.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('supports the home, unit, sensor, equipment, and settings screens', async () => {
    const first = await request(app)
      .post('/api/v1/farming-units')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alpha Tower', location: 'Kigali', deviceId: 'AH-MOBILE-1' });
    expect(first.status).toBe(201);
    farmingUnitId = first.body.data.id;

    const second = await request(app)
      .post('/api/v1/farming-units')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Beta Tower', location: 'Musanze' });
    expect(second.status).toBe(201);

    const page = await request(app)
      .get('/api/v1/farming-units')
      .query({ page: 1, limit: 1, sort: 'name', order: 'asc' })
      .set('Authorization', `Bearer ${token}`);
    expect(page.status).toBe(200);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.data[0].name).toBe('Alpha Tower');
    expect(page.body.meta).toMatchObject({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
      sort: 'name',
      order: 'asc',
    });

    const badSort = await request(app)
      .get('/api/v1/farming-units')
      .query({ sort: 'owner' })
      .set('Authorization', `Bearer ${token}`);
    expect(badSort.status).toBe(400);
    expect(badSort.body.error.details.issues[0].field).toBe('sort');

    const emptyCrops = await request(app)
      .get('/api/v1/crops')
      .query({ farmingUnitId })
      .set('Authorization', `Bearer ${token}`);
    expect(emptyCrops.status).toBe(200);
    expect(emptyCrops.body.data).toEqual([]);
    expect(emptyCrops.body.meta.total).toBe(0);
    expect(emptyCrops.body.meta.hasNextPage).toBe(false);

    const registered = await request(app)
      .post('/api/v1/devices/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ farmingUnitId, deviceIdentifier: 'AH-MOBILE-1' });
    expect(registered.status).toBe(201);

    const pump = await request(app)
      .post('/api/v1/equipment')
      .set('Authorization', `Bearer ${token}`)
      .send({ farmingUnitId, name: 'Water pump', type: 'WATER_PUMP' });
    expect(pump.status).toBe(201);

    const equipment = await request(app)
      .get('/api/v1/equipment')
      .query({ farmingUnitId, type: 'WATER_PUMP' })
      .set('Authorization', `Bearer ${token}`);
    expect(equipment.status).toBe(200);
    expect(equipment.body.data[0]).toMatchObject({ type: 'WATER_PUMP', deviceOnline: false });
    expect(equipment.body.meta.deviceOnline).toBe(false);
    expect(equipment.body.meta.total).toBe(1);

    const reading = await request(app)
      .post('/api/v1/sensors/readings')
      .set('Authorization', `Bearer ${token}`)
      .send({ farmingUnitId, temperature: 22, humidity: 55, waterLevel: 70 });
    expect(reading.status).toBe(201);

    const latest = await request(app)
      .get('/api/v1/sensors/readings/latest')
      .query({ farmingUnitId })
      .set('Authorization', `Bearer ${token}`);
    expect(latest.status).toBe(200);
    expect(latest.body.data.humidity).toBe(55);
    expect(latest.body.meta).toMatchObject({ deviceOnline: false, deviceStatus: 'OFFLINE' });

    const metrics = await request(app)
      .get('/api/v1/sensors/metrics')
      .set('Authorization', `Bearer ${token}`);
    expect(metrics.status).toBe(200);
    expect(metrics.body.data.temperature.unit).toBe('celsius');

    const overview = await request(app)
      .get(`/api/v1/farming-units/${farmingUnitId}/overview`)
      .set('Authorization', `Bearer ${token}`);
    expect(overview.status).toBe(200);
    expect(overview.body.data.unit.id).toBe(farmingUnitId);
    expect(overview.body.data.latestReading.waterLevel).toBe(70);
    expect(overview.body.data.equipment[0].type).toBe('WATER_PUMP');
    expect(overview.body.data.device.online).toBe(false);
    expect(overview.body.data.alerts.unread).toEqual(expect.any(Number));

    const dashboard = await request(app)
      .get('/api/v1/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: farmingUnitId,
          name: 'Alpha Tower',
          unreadAlerts: expect.any(Number),
          latestReading: expect.objectContaining({ temperature: 22, waterLevel: 70 }),
        }),
      ]),
    );
    expect(dashboard.body.data.unreadAlertCount).toEqual(expect.any(Number));

    const settings = await request(app)
      .get('/api/v1/users/me/settings')
      .set('Authorization', `Bearer ${token}`);
    expect(settings.status).toBe(200);
    expect(settings.body.data.profile.email).toBe(email);
    expect(settings.body.data.operations.timezone).toEqual(expect.any(String));
    expect(settings.body.data.operations.lowWaterPercent).toEqual(expect.any(Number));
    expect(settings.body.data.profile.password).toBeUndefined();

    const summary = await request(app)
      .get('/api/v1/alerts/summary')
      .set('Authorization', `Bearer ${token}`);
    expect(summary.status).toBe(200);
    expect(summary.body.data.unread).toEqual(expect.any(Number));
    expect(summary.body.data.bySeverity).toMatchObject({
      INFO: expect.any(Number),
      WARNING: expect.any(Number),
      CRITICAL: expect.any(Number),
    });
  });
});
