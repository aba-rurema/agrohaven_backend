import request from 'supertest';
import { app, prisma, registerUser, resetDatabase } from './helpers';

const email = `farmer.${Date.now()}@agrohaven.test`;
const password = 'Password1';

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

describe('AgroHaven API', () => {
  let token = '';
  let farmingUnitId = '';
  const hardwareId = `AH-TEST-${Date.now()}`;

  it('registers a customer without returning the password', async () => {
    const { response } = await registerUser(email);
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(email);
    expect(response.body.data.user.role).toBe('CUSTOMER');
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toContain(password);
    expect(response.body.data.user.password).toBeUndefined();
    token = response.body.data.accessToken;
  });

  it('logs in with the registered credentials', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.user.password).toBeUndefined();
    token = response.body.data.accessToken;
  });

  it('rejects a protected route without a token and allows it with a token', async () => {
    const anonymous = await request(app).get('/api/v1/auth/me');
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.success).toBe(false);
    expect(anonymous.body.error.code).toBe('UNAUTHORIZED');

    const current = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(current.status).toBe(200);
    expect(current.body.data.email).toBe(email);
    expect(current.body.data.password).toBeUndefined();
  });

  it('creates a farming unit for the authenticated user', async () => {
    const response = await request(app)
      .post('/api/v1/farming-units')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Kigali Tower',
        location: 'Kacyiru, Kigali',
        deviceId: hardwareId,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe('Kigali Tower');
    expect(response.body.data.status).toBe('INACTIVE');
    farmingUnitId = response.body.data.id;
  });

  it('stores a sensor reading and returns it as the latest reading', async () => {
    const registered = await request(app)
      .post('/api/v1/devices/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        farmingUnitId,
        deviceIdentifier: hardwareId,
        firmwareVersion: '1.0.0',
      });
    expect(registered.status).toBe(201);
    expect(registered.body.data.apiKey).toEqual(expect.any(String));
    expect(registered.body.data.device.apiKeyHash).toBeUndefined();

    const created = await request(app)
      .post('/api/v1/sensors/readings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        farmingUnitId,
        temperature: 24.5,
        humidity: 61,
        lightIntensity: 18000,
        airQuality: 42,
        waterLevel: 70,
      });
    expect(created.status).toBe(201);
    expect(created.body.data.temperature).toBe(24.5);

    const latest = await request(app)
      .get('/api/v1/sensors/readings/latest')
      .query({ farmingUnitId })
      .set('Authorization', `Bearer ${token}`);
    expect(latest.status).toBe(200);
    expect(latest.body.data.humidity).toBe(61);

    const invalid = await request(app)
      .post('/api/v1/sensors/readings')
      .set('Authorization', `Bearer ${token}`)
      .send({ farmingUnitId, temperature: 120 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates an alert from a low-water automation and lists it', async () => {
    const automation = await request(app)
      .post('/api/v1/automations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        farmingUnitId,
        name: 'Low water alert',
        type: 'ALERT',
        condition: { metric: 'waterLevel', operator: 'lt', value: 20 },
        action: {
          kind: 'alert',
          alertType: 'LOW_WATER',
          severity: 'CRITICAL',
          title: 'Water is low',
          message: 'The reservoir reading is below the configured threshold.',
        },
      });
    expect(automation.status).toBe(201);

    const reading = await request(app)
      .post('/api/v1/sensors/readings')
      .set('Authorization', `Bearer ${token}`)
      .send({ farmingUnitId, waterLevel: 8 });
    expect(reading.status).toBe(201);

    const alerts = await request(app)
      .get('/api/v1/alerts/unread')
      .set('Authorization', `Bearer ${token}`);
    expect(alerts.status).toBe(200);
    expect(alerts.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'LOW_WATER',
          isRead: false,
          farmingUnitId,
        }),
      ]),
    );
  });
});
