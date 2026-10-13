import bcrypt from 'bcrypt';
import { env } from '../config/env';

const dummyPasswordHash = bcrypt.hashSync('agrohaven-timing-placeholder', env.BCRYPT_SALT_ROUNDS);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string | null,
): Promise<boolean> {
  const matches = await bcrypt.compare(password, passwordHash ?? dummyPasswordHash);
  return passwordHash !== null && matches;
}
