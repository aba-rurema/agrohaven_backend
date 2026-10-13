import request from 'supertest';
import { sendPasswordReset } from '../src/modules/notifications/password-reset';
import { app, prisma, resetDatabase } from './helpers';

jest.mock('../src/modules/notifications/password-reset', () => ({
  sendPasswordReset: jest.fn().mockResolvedValue(undefined),
}));

const mockedReset = sendPasswordReset as jest.MockedFunction<typeof sendPasswordReset>;

const secretKeys = ['password', 'passwordResetToken', 'passwordResetExpires', 'tokenVersion'];

function assertNoSecretFields(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoSecretFields);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    expect(secretKeys).not.toContain(key);
    assertNoSecretFields(nested);
  }
}

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

beforeEach(() => {
  mockedReset.mockClear();
});

describe('authentication', () => {
  const email = `auth.${Date.now()}@agrohaven.test`;
  const password = 'Password1';
  let token = '';

  it('registers a customer and does not return the password', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Auth Farmer',
      email,
      password,
      phone: '+250788123456',
      location: 'Kigali <script>',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe('CUSTOMER');
    expect(response.body.data.user.location).toBe('Kigali script');
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    assertNoSecretFields(response.body);
    expect(JSON.stringify(response.body)).not.toContain(password);
    token = response.body.data.accessToken as string;
  });

  it('rejects registration that tries to set a role', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Other Farmer',
        email: `other.${Date.now()}@agrohaven.test`,
        password,
        role: 'ADMIN',
      });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a weak password and a duplicate email', async () => {
    const weak = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Weak Farmer',
        email: `weak.${Date.now()}@agrohaven.test`,
        password: 'password',
      });
    expect(weak.status).toBe(400);

    const duplicate = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Auth Farmer',
      email,
      password,
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('CONFLICT');
  });

  it('logs in and rejects a wrong password', async () => {
    const success = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(success.status).toBe(200);
    assertNoSecretFields(success.body);
    expect(JSON.stringify(success.body)).not.toContain(password);
    token = success.body.data.accessToken as string;

    const failure = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPass1' });
    expect(failure.status).toBe(401);
    expect(failure.body.error.code).toBe('INVALID_CREDENTIALS');

    const unknown = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'missing@agrohaven.test', password });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('protects the current user route and rejects an unsigned token', async () => {
    const anonymous = await request(app).get('/api/v1/auth/me');
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe('UNAUTHORIZED');

    const unsigned =
      'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxIiwicm9sZSI6IkFETUlOIiwianRpIjoiMSIsInR2IjowfQ.';
    const forged = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${unsigned}`);
    expect(forged.status).toBe(401);

    const current = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `bearer ${token}`);
    expect(current.status).toBe(200);
    expect(current.body.data.email).toBe(email);
    assertNoSecretFields(current.body);
  });

  it('updates the profile and rejects role or script URL changes', async () => {
    const updated = await request(app)
      .patch('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Auth Farmer Updated',
        location: 'Musanze',
        profileImage: 'https://cdn.example.com/aline.png',
      });
    expect(updated.status).toBe(200);
    expect(updated.body.data.fullName).toBe('Auth Farmer Updated');
    expect(updated.body.data.profileImage).toBe('https://cdn.example.com/aline.png');
    assertNoSecretFields(updated.body);

    const viaUsers = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`);
    expect(viaUsers.status).toBe(200);
    expect(viaUsers.body.data.fullName).toBe('Auth Farmer Updated');
    assertNoSecretFields(viaUsers.body);

    const roleChange = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'ADMIN' });
    expect(roleChange.status).toBe(400);

    const scriptUrl = await request(app)
      .patch('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ profileImage: 'javascript:alert(1)' });
    expect(scriptUrl.status).toBe(400);
  });

  it('blocks a customer from admin routes', async () => {
    const response = await request(app)
      .get('/api/v1/admin/statistics')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('changes the password and invalidates the previous token', async () => {
    const wrong = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongPass1', newPassword: 'Password2' });
    expect(wrong.status).toBe(400);

    const changed = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: password, newPassword: 'Password2' });
    expect(changed.status).toBe(200);
    assertNoSecretFields(changed.body);
    expect(JSON.stringify(changed.body)).not.toContain('Password2');

    const stale = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(stale.status).toBe(401);

    const oldPassword = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(oldPassword.status).toBe(401);

    const relogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password2' });
    expect(relogin.status).toBe(200);
    assertNoSecretFields(relogin.body);
    token = relogin.body.data.accessToken as string;
  });

  it('logs out and rejects the revoked token', async () => {
    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(logout.status).toBe(200);

    const again = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(again.status).toBe(401);
    expect(again.body.error.code).toBe('TOKEN_REVOKED');
  });

  it('creates and consumes a password reset without exposing the token', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password2' });
    expect(login.status).toBe(200);

    const known = await request(app).post('/api/v1/auth/forgot-password').send({ email });
    const unknown = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@agrohaven.test' });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.message).toBe(unknown.body.message);
    expect(mockedReset).toHaveBeenCalledTimes(1);
    const resetToken = mockedReset.mock.calls[0]?.[1];
    expect(typeof resetToken).toBe('string');
    expect(JSON.stringify(known.body)).not.toContain(resetToken);
    expect(JSON.stringify(unknown.body)).not.toContain('resetToken');

    const invalid = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'not-a-valid-reset-token-value', password: 'Password3' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('INVALID_RESET_TOKEN');

    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, password: 'Password3' });
    expect(reset.status).toBe(200);
    assertNoSecretFields(reset.body);

    const reused = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, password: 'Password4' });
    expect(reused.status).toBe(400);

    const previous = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password2' });
    expect(previous.status).toBe(401);

    const current = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password3' });
    expect(current.status).toBe(200);
    assertNoSecretFields(current.body);
    expect(JSON.stringify(current.body)).not.toContain('Password3');
  });
});
