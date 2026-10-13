import dotenv from 'dotenv';

dotenv.config();

process.env.NODE_ENV = 'test';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_SALT_ROUNDS = '10';
process.env.RUN_BACKGROUND_JOBS = 'false';
process.env.DEVICE_OFFLINE_AFTER_MINUTES = '5';
process.env.ALERT_DEDUPE_MINUTES = '60';
process.env.LOW_WATER_PERCENT = '20';
process.env.HIGH_TEMPERATURE_CELSIUS = '32';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.TIMEZONE = 'Africa/Kigali';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://agrohaven:agrohaven@localhost:5432/agrohaven_test?schema=public';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'test-jwt-secret-agrohaven-32chars-min';
}

if (!process.env.DATABASE_URL.includes('agrohaven_test')) {
  throw new Error('Refusing to run tests against a database that is not agrohaven_test');
}
