import { SENSOR_LIMITS } from '../../config/constants';
import { sensorRepository } from '../../repositories/sensor.repository';

function asNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function metric(
  average: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
  unit: string,
) {
  return {
    average: asNumber(average),
    min: asNumber(min),
    max: asNumber(max),
    unit,
  };
}

export async function summarizeSensorPeriod(params: {
  farmingUnitId?: string;
  from: Date;
  to: Date;
}) {
  const rows = await sensorRepository.summarize(params);
  const row = rows[0];
  return {
    from: params.from,
    to: params.to,
    count: row ? Number(row.count) : 0,
    temperature: metric(
      row?.avgTemperature,
      row?.minTemperature,
      row?.maxTemperature,
      SENSOR_LIMITS.temperature.unit,
    ),
    humidity: metric(
      row?.avgHumidity,
      row?.minHumidity,
      row?.maxHumidity,
      SENSOR_LIMITS.humidity.unit,
    ),
    lightIntensity: metric(
      row?.avgLightIntensity,
      row?.minLightIntensity,
      row?.maxLightIntensity,
      SENSOR_LIMITS.lightIntensity.unit,
    ),
    airQuality: metric(
      row?.avgAirQuality,
      row?.minAirQuality,
      row?.maxAirQuality,
      SENSOR_LIMITS.airQuality.unit,
    ),
    waterLevel: metric(
      row?.avgWaterLevel,
      row?.minWaterLevel,
      row?.maxWaterLevel,
      SENSOR_LIMITS.waterLevel.unit,
    ),
  };
}
