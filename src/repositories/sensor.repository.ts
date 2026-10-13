import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const sensorRepository = {
  create(data: Prisma.SensorReadingUncheckedCreateInput) {
    return prisma.sensorReading.create({ data });
  },

  latest(farmingUnitId: string) {
    return prisma.sensorReading.findFirst({
      where: { farmingUnitId },
      orderBy: { timestamp: 'desc' },
    });
  },

  latestGlobal() {
    return prisma.sensorReading.findFirst({ orderBy: { timestamp: 'desc' } });
  },

  latestForUnits(farmingUnitIds: string[]) {
    if (farmingUnitIds.length === 0) return Promise.resolve(null);
    return prisma.sensorReading.findFirst({
      where: { farmingUnitId: { in: farmingUnitIds } },
      orderBy: { timestamp: 'desc' },
    });
  },

  latestByUnits(farmingUnitIds: string[]) {
    if (farmingUnitIds.length === 0) return Promise.resolve([]);
    return prisma.$queryRaw<
      Array<{
        id: string;
        farmingUnitId: string;
        temperature: number | null;
        humidity: number | null;
        waterLevel: number | null;
        lightIntensity: number | null;
        airQuality: number | null;
        timestamp: Date;
      }>
    >(Prisma.sql`
      SELECT DISTINCT ON ("farmingUnitId")
        id,
        "farmingUnitId",
        temperature,
        humidity,
        "waterLevel",
        "lightIntensity",
        "airQuality",
        timestamp
      FROM "SensorReading"
      WHERE "farmingUnitId" IN (${Prisma.join(farmingUnitIds.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY "farmingUnitId", timestamp DESC
    `);
  },

  list(params: {
    farmingUnitId: string;
    from?: Date;
    to?: Date;
    sort?: 'timestamp';
    order?: 'asc' | 'desc';
    skip: number;
    take: number;
  }) {
    const where: Prisma.SensorReadingWhereInput = {
      farmingUnitId: params.farmingUnitId,
      ...(params.from || params.to
        ? {
            timestamp: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lt: params.to } : {}),
            },
          }
        : {}),
    };

    return prisma.$transaction([
      prisma.sensorReading.findMany({
        where,
        orderBy: { timestamp: params.order ?? 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      prisma.sensorReading.count({ where }),
    ]);
  },

  countSince(from: Date) {
    return prisma.sensorReading.count({ where: { timestamp: { gte: from } } });
  },

  summarize(params: { farmingUnitId?: string; from: Date; to: Date }) {
    const unitClause = params.farmingUnitId
      ? Prisma.sql`AND "farmingUnitId" = ${params.farmingUnitId}::uuid`
      : Prisma.empty;

    return prisma.$queryRaw<
      Array<{
        count: number;
        avgTemperature: number | null;
        minTemperature: number | null;
        maxTemperature: number | null;
        avgHumidity: number | null;
        minHumidity: number | null;
        maxHumidity: number | null;
        avgLightIntensity: number | null;
        minLightIntensity: number | null;
        maxLightIntensity: number | null;
        avgAirQuality: number | null;
        minAirQuality: number | null;
        maxAirQuality: number | null;
        avgWaterLevel: number | null;
        minWaterLevel: number | null;
        maxWaterLevel: number | null;
      }>
    >(Prisma.sql`
      SELECT
        COUNT(*)::int AS "count",
        AVG(temperature)::float8 AS "avgTemperature",
        MIN(temperature)::float8 AS "minTemperature",
        MAX(temperature)::float8 AS "maxTemperature",
        AVG(humidity)::float8 AS "avgHumidity",
        MIN(humidity)::float8 AS "minHumidity",
        MAX(humidity)::float8 AS "maxHumidity",
        AVG("lightIntensity")::float8 AS "avgLightIntensity",
        MIN("lightIntensity")::float8 AS "minLightIntensity",
        MAX("lightIntensity")::float8 AS "maxLightIntensity",
        AVG("airQuality")::float8 AS "avgAirQuality",
        MIN("airQuality")::float8 AS "minAirQuality",
        MAX("airQuality")::float8 AS "maxAirQuality",
        AVG("waterLevel")::float8 AS "avgWaterLevel",
        MIN("waterLevel")::float8 AS "minWaterLevel",
        MAX("waterLevel")::float8 AS "maxWaterLevel"
      FROM "SensorReading"
      WHERE timestamp >= ${params.from}
        AND timestamp < ${params.to}
        ${unitClause}
    `);
  },
};
