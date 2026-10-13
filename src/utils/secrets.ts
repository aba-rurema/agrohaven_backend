import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function generateDeviceKey(): string {
  return randomBytes(32).toString('base64url');
}

export function hashDeviceKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

const DUMMY_DEVICE_KEY_HASH = hashDeviceKey('agrohaven-dummy-device-key');

export function verifyDeviceKey(key: string, hash: string | null): boolean {
  const actual = Buffer.from(hashDeviceKey(key), 'hex');
  const expected = Buffer.from(hash ?? DUMMY_DEVICE_KEY_HASH, 'hex');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function generateResetToken(): string {
  return randomBytes(32).toString('hex');
}
