import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';

export const app = createApp();

export async function resetDatabase(): Promise<void> {
  await prisma.deviceCommand.deleteMany();
  await prisma.harvest.deleteMany();
  await prisma.crop.deleteMany();
  await prisma.waterUsage.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.automation.deleteMany();
  await prisma.sensorReading.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.device.deleteMany();
  await prisma.farmingUnit.deleteMany();
  await prisma.revokedToken.deleteMany();
  await prisma.user.deleteMany();
}

export async function registerUser(email: string) {
  const password = 'Password1';
  const response = await request(app).post('/api/v1/auth/register').send({
    fullName: 'Test Farmer',
    email,
    password,
    phone: '+250788123456',
    location: 'Kigali',
  });

  return {
    response,
    password,
    token: response.body?.data?.accessToken as string | undefined,
  };
}

export { prisma };
