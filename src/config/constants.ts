export const SENSOR_LIMITS = {
  temperature: { min: -40, max: 80, unit: 'celsius' },
  humidity: { min: 0, max: 100, unit: 'percent' },
  lightIntensity: { min: 0, max: 100000, unit: 'lux' },
  airQuality: { min: 0, max: 10000, unit: 'sensor-reported' },
  waterLevel: { min: 0, max: 100, unit: 'percent' },
} as const;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;
