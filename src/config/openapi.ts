const bearer = [{ bearerAuth: [] }];
const device = [{ deviceId: [], deviceKey: [] }];

const errorSchema = { $ref: '#/components/schemas/ErrorResponse' };

function jsonBody(schema: Record<string, unknown>, example?: unknown) {
  return {
    required: true,
    content: {
      'application/json': {
        schema,
        ...(example ? { example } : {}),
      },
    },
  };
}

function ok(description: string, schema?: Record<string, unknown>) {
  return {
    description,
    content: {
      'application/json': {
        schema: schema ?? { $ref: '#/components/schemas/SuccessResponse' },
      },
    },
  };
}

function errors(...codes: string[]) {
  const map: Record<string, unknown> = {};
  const descriptions: Record<string, string> = {
    '400': 'Validation or bad request',
    '401': 'Missing or invalid authentication',
    '403': 'Authenticated but not allowed',
    '404': 'Record or route not found',
    '409': 'Conflict, including an offline device',
    '429': 'Rate limit exceeded',
    '500': 'Unexpected server error',
  };
  for (const code of codes) {
    map[code] = {
      description: descriptions[code] ?? 'Error',
      content: { 'application/json': { schema: errorSchema } },
    };
  }
  return map;
}

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

const paging = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  {
    name: 'limit',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
];

function sortParams(fields: string[], defaultSort: string, defaultOrder = 'desc') {
  return [
    { name: 'sort', in: 'query', schema: { type: 'string', enum: fields, default: defaultSort } },
    {
      name: 'order',
      in: 'query',
      schema: { type: 'string', enum: ['asc', 'desc'], default: defaultOrder },
    },
  ];
}

const unitQuery = {
  name: 'farmingUnitId',
  in: 'query',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'AgroHaven API',
    version: '1.0.0',
    description:
      'REST API for AgroHaven aeroponic farming units, IoT devices, sensor history, equipment control, automation, crops, harvests, water usage, and alerts.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Users' },
    { name: 'Farming units' },
    { name: 'Devices' },
    { name: 'Sensors' },
    { name: 'Equipment' },
    { name: 'Automations' },
    { name: 'Crops' },
    { name: 'Harvests' },
    { name: 'Water usage' },
    { name: 'Alerts' },
    { name: 'Dashboard' },
    { name: 'Admin' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      deviceId: { type: 'apiKey', in: 'header', name: 'X-Device-Id' },
      deviceKey: { type: 'apiKey', in: 'header', name: 'X-Device-Key' },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['success', 'message', 'error'],
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              details: {
                type: 'object',
                description:
                  'Validation errors include issues[].field, issues[].message, and issues[].code. Use field "form" when the error is not tied to one input.',
                additionalProperties: true,
              },
            },
          },
        },
      },
      SuccessResponse: {
        type: 'object',
        required: ['success', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {},
          meta: { $ref: '#/components/schemas/PageMeta' },
        },
      },
      PageMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer', description: 'Zero means the list is empty.' },
          totalPages: { type: 'integer' },
          hasNextPage: { type: 'boolean' },
          hasPreviousPage: { type: 'boolean' },
          sort: { type: 'string' },
          order: { type: 'string', enum: ['asc', 'desc'] },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['fullName', 'email', 'password'],
        properties: {
          fullName: { type: 'string', example: 'Aline Uwase' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string', example: '+250788000000' },
          password: { type: 'string', format: 'password', minLength: 8 },
          location: { type: 'string', example: 'Kigali' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password' },
        },
      },
      SensorReadingRequest: {
        type: 'object',
        properties: {
          farmingUnitId: { type: 'string', format: 'uuid' },
          temperature: { type: 'number', minimum: -40, maximum: 80, description: 'Celsius' },
          humidity: { type: 'number', minimum: 0, maximum: 100, description: 'Percent' },
          lightIntensity: { type: 'number', minimum: 0, maximum: 100000, description: 'Lux' },
          airQuality: {
            type: 'number',
            minimum: 0,
            maximum: 10000,
            description: 'Sensor-reported value',
          },
          waterLevel: { type: 'number', minimum: 0, maximum: 100, description: 'Percent' },
          timestamp: { type: 'string', format: 'date-time' },
          extra: {
            type: 'object',
            additionalProperties: true,
            description: 'Future sensor channels that are not first-class columns',
          },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Confirms the API process is running. It does not require authentication.',
        responses: { '200': ok('API is running'), ...errors('500') },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a customer',
        description:
          'Creates a CUSTOMER account and returns a JWT. Passwords are hashed with bcrypt and never returned.',
        requestBody: jsonBody({ $ref: '#/components/schemas/RegisterRequest' }),
        responses: { '201': ok('Account created'), ...errors('400', '409', '429', '500') },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in',
        description:
          'Returns accessToken, tokenType Bearer, expiresIn, and the public user. Invalid credentials use 401 INVALID_CREDENTIALS. A deactivated account uses 403 ACCOUNT_DISABLED.',
        requestBody: jsonBody({ $ref: '#/components/schemas/LoginRequest' }),
        responses: { '200': ok('Login successful'), ...errors('400', '401', '403', '429', '500') },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Log out',
        description: 'Revokes the current JWT until it expires.',
        security: bearer,
        responses: { '200': ok('Logged out'), ...errors('401', '500') },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get the current user',
        security: bearer,
        responses: { '200': ok('Current user'), ...errors('401', '403', '500') },
      },
    },
    '/api/v1/auth/profile': {
      patch: {
        tags: ['Auth'],
        summary: 'Update profile',
        description:
          'Updates full name, phone, location, or profile image URL. Role and password are not accepted.',
        security: bearer,
        requestBody: jsonBody({ type: 'object', additionalProperties: true }),
        responses: { '200': ok('Profile updated'), ...errors('400', '401', '500') },
      },
    },
    '/api/v1/auth/change-password': {
      post: {
        tags: ['Auth'],
        summary: 'Change password',
        description:
          'Checks the current password, stores a new hash, and returns sessionEnded true. The previous access token is no longer accepted.',
        security: bearer,
        requestBody: jsonBody({
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string' },
            newPassword: { type: 'string' },
          },
        }),
        responses: { '200': ok('Password changed'), ...errors('400', '401', '500') },
      },
    },
    '/api/v1/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request a password reset',
        description:
          'Stores a hashed reset token. When SMTP is configured, the token is emailed. The response does not reveal whether the email exists.',
        requestBody: jsonBody({
          type: 'object',
          required: ['email'],
          properties: { email: { type: 'string', format: 'email' } },
        }),
        responses: {
          '200': ok('Reset instructions created when the account exists'),
          ...errors('400', '429', '500'),
        },
      },
    },
    '/api/v1/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Reset password',
        description: 'Consumes a valid reset token and sets a new password.',
        requestBody: jsonBody({
          type: 'object',
          required: ['token', 'password'],
          properties: { token: { type: 'string' }, password: { type: 'string' } },
        }),
        responses: { '200': ok('Password reset'), ...errors('400', '429', '500') },
      },
    },
    '/api/v1/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Get the current user',
        security: bearer,
        responses: { '200': ok('Current user'), ...errors('401', '500') },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update the current user profile',
        security: bearer,
        requestBody: jsonBody({ type: 'object', additionalProperties: true }),
        responses: { '200': ok('Profile updated'), ...errors('400', '401', '500') },
      },
    },
    '/api/v1/users/me/settings': {
      get: {
        tags: ['Users'],
        summary: 'Settings screen',
        description:
          'Profile plus the server timezone, offline window, and configured sensor thresholds. Thresholds are operator settings.',
        security: bearer,
        responses: { '200': ok('Settings'), ...errors('401', '500') },
      },
    },
    '/api/v1/farming-units': {
      post: {
        tags: ['Farming units'],
        summary: 'Create a farming unit',
        description:
          'Customers create a unit they own. Technicians must set ownerId. Admins may set ownerId.',
        security: bearer,
        requestBody: jsonBody({
          type: 'object',
          required: ['name', 'location'],
          properties: {
            name: { type: 'string' },
            location: { type: 'string' },
            deviceId: { type: 'string', description: 'Hardware serial, not the Device UUID' },
            installationDate: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'OFFLINE', 'MAINTENANCE'] },
            ownerId: { type: 'string', format: 'uuid' },
          },
        }),
        responses: { '201': ok('Created'), ...errors('400', '401', '403', '404', '500') },
      },
      get: {
        tags: ['Farming units'],
        summary: 'List farming units',
        description:
          'Customers see their units. Technicians and admins see every unit. Each item includes device presence when a device is registered. An empty page has data [] and meta.total 0.',
        security: bearer,
        parameters: [
          ...paging,
          ...sortParams(['createdAt', 'name', 'status'], 'createdAt'),
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': ok('List'), ...errors('401', '500') },
      },
    },
    '/api/v1/farming-units/{id}/overview': {
      get: {
        tags: ['Farming units'],
        summary: 'Farming unit detail screen',
        description:
          'Unit, device presence, latest reading, equipment, the first page of crops, and unread alerts in one response.',
        security: bearer,
        parameters: [idParam],
        responses: { '200': ok('Overview'), ...errors('401', '403', '404', '500') },
      },
    },
    '/api/v1/farming-units/{id}': {
      get: {
        tags: ['Farming units'],
        summary: 'Get one farming unit',
        security: bearer,
        parameters: [idParam],
        responses: { '200': ok('Farming unit'), ...errors('401', '403', '404', '500') },
      },
      patch: {
        tags: ['Farming units'],
        summary: 'Update a farming unit',
        security: bearer,
        parameters: [idParam],
        requestBody: jsonBody({ type: 'object', additionalProperties: true }),
        responses: { '200': ok('Updated'), ...errors('400', '401', '403', '404', '409', '500') },
      },
      delete: {
        tags: ['Farming units'],
        summary: 'Delete a farming unit',
        security: bearer,
        parameters: [idParam],
        responses: { '200': ok('Deleted'), ...errors('401', '403', '404', '500') },
      },
    },
    '/api/v1/farming-units/{id}/assign': {
      patch: {
        tags: ['Farming units'],
        summary: 'Assign a farming unit to a user',
        description: 'Admin only.',
        security: bearer,
        parameters: [idParam],
        requestBody: jsonBody({
          type: 'object',
          required: ['userId'],
          properties: { userId: { type: 'string', format: 'uuid' } },
        }),
        responses: { '200': ok('Assigned'), ...errors('400', '401', '403', '404', '500') },
      },
    },
    '/api/v1/farming-units/{id}/status': {
      patch: {
        tags: ['Farming units'],
        summary: 'Change farming unit status',
        description:
          'Owners, technicians, and admins can change status. MAINTENANCE creates an alert for the owner.',
        security: bearer,
        parameters: [idParam],
        requestBody: jsonBody({
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'OFFLINE', 'MAINTENANCE'] },
          },
        }),
        responses: { '200': ok('Status updated'), ...errors('400', '401', '403', '404', '500') },
      },
    },
    '/api/v1/devices/register': {
      post: {
        tags: ['Devices'],
        summary: 'Register a device',
        description: 'Links a hardware identifier to a farming unit and returns an API key once.',
        security: bearer,
        requestBody: jsonBody({
          type: 'object',
          required: ['farmingUnitId', 'deviceIdentifier'],
          properties: {
            farmingUnitId: { type: 'string', format: 'uuid' },
            deviceIdentifier: { type: 'string' },
            firmwareVersion: { type: 'string' },
            configuration: { type: 'object', additionalProperties: true },
          },
        }),
        responses: { '201': ok('Registered'), ...errors('400', '401', '403', '409', '500') },
      },
    },
    '/api/v1/devices': {
      get: {
        tags: ['Devices'],
        summary: 'List devices',
        security: bearer,
        parameters: [
          ...paging,
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { ...unitQuery, required: false },
        ],
        responses: { '200': ok('Devices'), ...errors('401', '403', '500') },
      },
    },
    '/api/v1/devices/{id}': {
      get: {
        tags: ['Devices'],
        summary: 'Get a device',
        security: bearer,
        parameters: [idParam],
        responses: { '200': ok('Device'), ...errors('401', '403', '404', '500') },
      },
      patch: {
        tags: ['Devices'],
        summary: 'Update device configuration',
        description:
          'Users cannot mark a device ONLINE. Presence comes from heartbeat or device-authenticated readings.',
        security: bearer,
        parameters: [idParam],
        requestBody: jsonBody({ type: 'object', additionalProperties: true }),
        responses: { '200': ok('Updated'), ...errors('400', '401', '403', '404', '500') },
      },
    },
    '/api/v1/devices/{id}/rotate-key': {
      post: {
        tags: ['Devices'],
        summary: 'Rotate a device API key',
        security: bearer,
        parameters: [idParam],
        responses: { '200': ok('Key rotated'), ...errors('401', '403', '404', '500') },
      },
    },
    '/api/v1/devices/telemetry': {
      post: {
        tags: ['Devices'],
        summary: 'Submit sensor telemetry from a device',
        description:
          'Device credentials only. Stores the reading, sets lastSeen to the time the API received it, marks the device ONLINE, checks configured thresholds, and returns pending equipment commands.',
        security: device,
        requestBody: jsonBody({
          type: 'object',
          properties: {
            temperature: { type: 'number' },
            humidity: { type: 'number' },
            lightIntensity: { type: 'number' },
            airQuality: { type: 'number' },
            waterLevel: { type: 'number' },
            timestamp: { type: 'string', format: 'date-time' },
            extra: {
              type: 'object',
              additionalProperties: true,
              description: 'Later sensor channels. Numeric values can have alertThresholds.additional rules.',
            },
          },
        }),
        responses: { '201': ok('Telemetry accepted'), ...errors('400', '401', '409', '429', '500') },
      },
    },
    '/api/v1/devices/heartbeat': {
      post: {
        tags: ['Devices'],
        summary: 'Device heartbeat',
        description:
          'Requires X-Device-Id and X-Device-Key. Updates lastSeen, firmware, health, and status.',
        security: device,
        requestBody: jsonBody({
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ONLINE', 'OFFLINE', 'ERROR', 'MAINTENANCE'] },
            firmwareVersion: { type: 'string' },
            health: { type: 'object', additionalProperties: true },
          },
        }),
        responses: { '200': ok('Heartbeat stored'), ...errors('400', '401', '500') },
      },
    },
    '/api/v1/devices/commands': {
      get: {
        tags: ['Devices'],
        summary: 'List pending commands',
        description: 'Devices poll this endpoint for power and configuration commands.',
        security: device,
        responses: { '200': ok('Pending commands'), ...errors('401', '500') },
      },
    },
    '/api/v1/devices/commands/{commandId}/ack': {
      post: {
        tags: ['Devices'],
        summary: 'Acknowledge a command',
        security: device,
        parameters: [
          {
            name: 'commandId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: jsonBody({
          type: 'object',
          required: ['status'],
          properties: { status: { type: 'string', enum: ['ACKNOWLEDGED', 'FAILED'] } },
        }),
        responses: { '200': ok('Acknowledged'), ...errors('400', '401', '404', '409', '500') },
      },
    },
    '/api/v1/sensors/readings': {
      post: {
        tags: ['Sensors'],
        summary: 'Upload a sensor reading',
        description:
          'Accepts a user JWT or device credentials. At least one metric is required. Values outside the sensor ranges are rejected. Device-authenticated uploads refresh presence. Every stored reading runs automations and the configured threshold checks. ESP32 devices should use POST /api/v1/devices/telemetry so the response includes pending commands.',
        security: [{ bearerAuth: [] }, { deviceId: [], deviceKey: [] }],
        requestBody: jsonBody({ $ref: '#/components/schemas/SensorReadingRequest' }),
        responses: { '201': ok('Stored'), ...errors('400', '401', '403', '409', '429', '500') },
      },
      get: {
        tags: ['Sensors'],
        summary: 'Sensor history',
        description: 'Filter with from and to timestamps. Default sort is timestamp descending.',
        security: bearer,
        parameters: [
          ...paging,
          ...sortParams(['timestamp'], 'timestamp'),
          unitQuery,
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { '200': ok('History'), ...errors('400', '401', '403', '500') },
      },
    },
    '/api/v1/sensors/readings/latest': {
      get: {
        tags: ['Sensors'],
        summary: 'Latest sensor reading',
        description:
          'data is the reading, or null when none exists. meta.deviceOnline, meta.deviceStatus, and meta.lastSeen describe the linked device.',
        security: bearer,
        parameters: [unitQuery],
        responses: { '200': ok('Latest reading, or null'), ...errors('401', '403', '404', '500') },
      },
    },
    '/api/v1/sensors/metrics': {
      get: {
        tags: ['Sensors'],
        summary: 'Sensor metric ranges',
        description: 'Labels and accepted ranges for the monitoring screen.',
        security: bearer,
        responses: { '200': ok('Metric catalog'), ...errors('401', '500') },
      },
    },
    '/api/v1/sensors/statistics/daily': {
      get: {
        tags: ['Sensors'],
        summary: 'Daily sensor statistics',
        description:
          'Average, minimum, and maximum for one calendar day in the configured timezone.',
        security: bearer,
        parameters: [
          unitQuery,
          { name: 'date', in: 'query', schema: { type: 'string', example: '2026-10-07' } },
        ],
        responses: { '200': ok('Daily statistics'), ...errors('400', '401', '403', '500') },
      },
    },
    '/api/v1/sensors/statistics/weekly': {
      get: {
        tags: ['Sensors'],
        summary: 'Weekly sensor statistics',
        description: 'Monday-Sunday week in the configured timezone that contains the given date.',
        security: bearer,
        parameters: [unitQuery, { name: 'date', in: 'query', schema: { type: 'string' } }],
        responses: { '200': ok('Weekly statistics'), ...errors('400', '401', '403', '500') },
      },
    },
    '/api/v1/sensors/statistics/monthly': {
      get: {
        tags: ['Sensors'],
        summary: 'Monthly sensor statistics',
        security: bearer,
        parameters: [
          unitQuery,
          { name: 'year', in: 'query', schema: { type: 'integer' } },
          { name: 'month', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { '200': ok('Monthly statistics'), ...errors('400', '401', '403', '500') },
      },
    },
    '/api/v1/equipment': {
      post: {
        tags: ['Equipment'],
        summary: 'Create equipment',
        description:
          'Creating equipment in the ON state requires an online device. Otherwise the API returns DEVICE_OFFLINE and does not save the command.',
        security: bearer,
        requestBody: jsonBody({
          type: 'object',
          required: ['farmingUnitId', 'name', 'type'],
          properties: {
            farmingUnitId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            type: {
              type: 'string',
              enum: ['WATER_PUMP', 'MIST_PUMP', 'LED_GROW_LIGHT', 'FAN', 'OTHER'],
            },
            status: { type: 'string', enum: ['ONLINE', 'OFFLINE', 'ERROR'] },
            powerState: { type: 'string', enum: ['ON', 'OFF'] },
            configuration: { type: 'object', additionalProperties: true },
          },
        }),
        responses: { '201': ok('Created'), ...errors('400', '401', '403', '409', '500') },
      },
      get: {
        tags: ['Equipment'],
        summary: 'List equipment',
        description:
          'Each item includes deviceOnline. meta.deviceOnline repeats it for the screen header. Default sort is name ascending. Power commands still return 409 DEVICE_OFFLINE when the device is offline.',
        security: bearer,
        parameters: [
          ...paging,
          ...sortParams(['name', 'type', 'createdAt'], 'name', 'asc'),
          unitQuery,
          {
            name: 'type',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['WATER_PUMP', 'MIST_PUMP', 'LED_GROW_LIGHT', 'FAN', 'OTHER'],
            },
          },
        ],
        responses: { '200': ok('Equipment'), ...errors('401', '403', '404', '500') },
      },
    },
    '/api/v1/equipment/control': {
      post: {
        tags: ['Equipment'],
        summary: 'Set power for every unit of one equipment type',
        description:
          'Controls WATER_PUMP, MIST_PUMP, LED_GROW_LIGHT, FAN, or another registered type. Returns 409 DEVICE_OFFLINE and leaves powerState unchanged when the device is offline. Returns 404 when that type is not registered.',
        security: bearer,
        requestBody: jsonBody({
          type: 'object',
          required: ['farmingUnitId', 'type', 'powerState'],
          properties: {
            farmingUnitId: { type: 'string', format: 'uuid' },
            type: {
              type: 'string',
              enum: ['WATER_PUMP', 'MIST_PUMP', 'LED_GROW_LIGHT', 'FAN', 'OTHER'],
            },
            powerState: { type: 'string', enum: ['ON', 'OFF'] },
          },
        }),
        responses: { '200': ok('Command queued'), ...errors('400', '401', '403', '404', '409', '500') },
      },
    },
    '/api/v1/equipment/{id}': {
      get: {
        tags: ['Equipment'],
        summary: 'Get equipment',
        security: bearer,
        parameters: [idParam],
        responses: { '200': ok('Equipment'), ...errors('401', '403', '404', '500') },
      },
      patch: {
        tags: ['Equipment'],
        summary: 'Update equipment configuration',
        description:
          'Configuration is saved even if the device is offline. The response delivered flag is false when the command could not be queued.',
        security: bearer,
        parameters: [idParam],
        requestBody: jsonBody({ type: 'object', additionalProperties: true }),
        responses: { '200': ok('Updated'), ...errors('400', '401', '403', '404', '500') },
      },
    },
    '/api/v1/equipment/{id}/status': {
      get: {
        tags: ['Equipment'],
        summary: 'Get equipment status',
        security: bearer,
        parameters: [idParam],
        responses: { '200': ok('Status'), ...errors('401', '403', '404', '500') },
      },
    },
    '/api/v1/equipment/{id}/on': {
      post: {
        tags: ['Equipment'],
        summary: 'Turn equipment on',
        description:
          'Returns 409 DEVICE_OFFLINE when the device is not currently reachable. Power state is not changed in that case.',
        security: bearer,
        parameters: [idParam],
        responses: { '200': ok('Command queued'), ...errors('401', '403', '404', '409', '500') },
      },
    },
    '/api/v1/equipment/{id}/off': {
      post: {
        tags: ['Equipment'],
        summary: 'Turn equipment off',
        description:
          'Returns 409 DEVICE_OFFLINE when the device is not currently reachable. Power state is not changed in that case.',
        security: bearer,
        parameters: [idParam],
        responses: { '200': ok('Command queued'), ...errors('401', '403', '404', '409', '500') },
      },
    },
    '/api/v1/automations': {
      post: {
        tags: ['Automations'],
        summary: 'Create an automation',
        description:
          'THRESHOLD rules compare a sensor metric. SCHEDULE rules apply an equipment power state during a local time window and the opposite state outside it. ALERT rules create an alert when the condition matches.',
        security: bearer,
        requestBody: jsonBody({
          type: 'object',
          required: ['farmingUnitId', 'name', 'type', 'condition', 'action'],
          properties: {
            farmingUnitId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            type: { type: 'string', enum: ['THRESHOLD', 'SCHEDULE', 'ALERT'] },
            condition: { type: 'object', additionalProperties: true },
            action: { type: 'object', additionalProperties: true },
            enabled: { type: 'boolean' },
          },
        }),
        responses: { '201': ok('Created'), ...errors('400', '401', '403', '404', '500') },
      },
      get: {
        tags: ['Automations'],
        summary: 'List automations',
        security: bearer,
        parameters: [unitQuery],
        responses: { '200': ok('Automations'), ...errors('401', '403', '404', '500') },
      },
    },
    '/api/v1/automations/{id}': {
      get: {
        tags: ['Automations'],
        summary: 'Get an automation',
        security: bearer,
        parameters: [idParam],
        responses: { '200': ok('Automation'), ...errors('401', '403', '404', '500') },
      },
      patch: {
        tags: ['Automations'],
        summary: 'Update an automation',
        security: bearer,
        parameters: [idParam],
        requestBody: jsonBody({ type: 'object', additionalProperties: true }),
        responses: { '200': ok('Updated'), ...errors('400', '401', '403', '404', '500') },
      },
      delete: {
        tags: ['Automations'],
        summary: 'Delete an automation',
        security: bearer,
        parameters: [idParam],
        responses: { '200': ok('Deleted'), ...errors('401', '403', '404', '500') },
      },
    },
    '/api/v1/automations/{id}/enabled': {
      patch: {
        tags: ['Automations'],
        summary: 'Enable or disable an automation',
        security: bearer,
        parameters: [idParam],
        requestBody: jsonBody({
          type: 'object',
          required: ['enabled'],
          properties: { enabled: { type: 'boolean' } },
        }),
        responses: { '200': ok('Updated'), ...errors('400', '401', '403', '404', '500') },
      },
    },
    '/api/v1/crops': {
      post: {
        tags: ['Crops'],
        summary: 'Create a crop',
        security: bearer,
        requestBody: jsonBody({
          type: 'object',
          required: ['farmingUnitId', 'name', 'plantingDate'],
          properties: {
            farmingUnitId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            variety: { type: 'string' },
            plantingDate: { type: 'string', format: 'date-time' },
            expectedHarvestDate: { type: 'string', format: 'date-time' },
            status: {
              type: 'string',
              enum: ['PLANTED', 'GROWING', 'READY_FOR_HARVEST', 'HARVESTED', 'FAILED'],
            },
            notes: { type: 'string' },
          },
        }),
        responses: { '201': ok('Created'), ...errors('400', '401', '403', '404', '500') },
      },
      get: {
        tags: ['Crops'],
        summary: 'List crops',
        security: bearer,
        parameters: [
          ...paging,
          ...sortParams(['plantingDate', 'name', 'status', 'createdAt'], 'plantingDate'),
          unitQuery,
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': ok('Crops'), ...errors('401', '403', '500') },
      },
    },
    '/api/v1/crops/statistics': {
      get: {
        tags: ['Crops'],
        summary: 'Crop statistics',
        description:
          'Counts crops by status and sums recorded harvest quantities. It does not estimate yield.',
        security: bearer,
        parameters: [unitQuery],
        responses: { '200': ok('Statistics'), ...errors('401', '403', '404', '500') },
      },
    },
    '/api/v1/crops/{id}': {
      get: {
        tags: ['Crops'],
        summary: 'Get a crop',
        security: bearer,
        parameters: [idParam],
        responses: { '200': ok('Crop'), ...errors('401', '403', '404', '500') },
      },
      patch: {
        tags: ['Crops'],
        summary: 'Update a crop',
        security: bearer,
        parameters: [idParam],
        requestBody: jsonBody({ type: 'object', additionalProperties: true }),
        responses: { '200': ok('Updated'), ...errors('400', '401', '403', '404', '500') },
      },
      delete: {
        tags: ['Crops'],
        summary: 'Delete a crop',
        security: bearer,
        parameters: [idParam],
        responses: { '200': ok('Deleted'), ...errors('401', '403', '404', '500') },
      },
    },
    '/api/v1/harvests': {
      post: {
        tags: ['Harvests'],
        summary: 'Record a harvest',
        description:
          'Stores the quantity and unit supplied by the client. By default the crop is marked HARVESTED.',
        security: bearer,
        requestBody: jsonBody({
          type: 'object',
          required: ['cropId', 'quantity', 'unit', 'harvestDate'],
          properties: {
            cropId: { type: 'string', format: 'uuid' },
            quantity: { type: 'number' },
            unit: { type: 'string', example: 'kg' },
            harvestDate: { type: 'string', format: 'date-time' },
            quality: { type: 'string' },
            notes: { type: 'string' },
            markCropHarvested: { type: 'boolean' },
          },
        }),
        responses: { '201': ok('Recorded'), ...errors('400', '401', '403', '404', '500') },
      },
      get: {
        tags: ['Harvests'],
        summary: 'Harvest history',
        security: bearer,
        parameters: [
          ...paging,
          ...sortParams(['harvestDate', 'quantity', 'createdAt'], 'harvestDate'),
          { ...unitQuery, required: false },
          { name: 'cropId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { '200': ok('Harvests'), ...errors('400', '401', '403', '500') },
      },
    },
    '/api/v1/harvests/{id}': {
      get: {
        tags: ['Harvests'],
        summary: 'Get a harvest',
        security: bearer,
        parameters: [idParam],
        responses: { '200': ok('Harvest'), ...errors('401', '403', '404', '500') },
      },
    },
    '/api/v1/water-usage': {
      post: {
        tags: ['Water usage'],
        summary: 'Record water usage',
        description:
          'Stores the measured amount and unit. The API does not invent a comparison with soil farming.',
        security: bearer,
        requestBody: jsonBody({
          type: 'object',
          required: ['farmingUnitId', 'amountUsed'],
          properties: {
            farmingUnitId: { type: 'string', format: 'uuid' },
            amountUsed: { type: 'number' },
            unit: { type: 'string', example: 'liters' },
            recordedAt: { type: 'string', format: 'date-time' },
          },
        }),
        responses: { '201': ok('Recorded'), ...errors('400', '401', '403', '404', '500') },
      },
      get: {
        tags: ['Water usage'],
        summary: 'Water usage history',
        security: bearer,
        parameters: [
          ...paging,
          ...sortParams(['recordedAt', 'amountUsed'], 'recordedAt'),
          unitQuery,
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { '200': ok('History'), ...errors('400', '401', '403', '500') },
      },
    },
    '/api/v1/water-usage/daily': {
      get: {
        tags: ['Water usage'],
        summary: 'Daily water usage',
        security: bearer,
        parameters: [unitQuery, { name: 'date', in: 'query', schema: { type: 'string' } }],
        responses: { '200': ok('Daily totals'), ...errors('401', '403', '500') },
      },
    },
    '/api/v1/water-usage/monthly': {
      get: {
        tags: ['Water usage'],
        summary: 'Monthly water usage',
        security: bearer,
        parameters: [
          unitQuery,
          { name: 'year', in: 'query', schema: { type: 'integer' } },
          { name: 'month', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { '200': ok('Monthly totals'), ...errors('401', '403', '500') },
      },
    },
    '/api/v1/water-usage/total': {
      get: {
        tags: ['Water usage'],
        summary: 'Total recorded water usage',
        description: 'Sums are grouped by unit and are never mixed.',
        security: bearer,
        parameters: [
          unitQuery,
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { '200': ok('Totals'), ...errors('400', '401', '403', '500') },
      },
    },
    '/api/v1/water-usage/statistics': {
      get: {
        tags: ['Water usage'],
        summary: 'Water usage statistics',
        description:
          'Returns recorded totals and a daily average. A savings difference is calculated only when the caller supplies baselineAmount. That difference is arithmetic, not a scientific claim.',
        security: bearer,
        parameters: [
          unitQuery,
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'baselineAmount', in: 'query', schema: { type: 'number' } },
          { name: 'baselineUnit', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': ok('Statistics'), ...errors('400', '401', '403', '500') },
      },
    },
    '/api/v1/alerts': {
      get: {
        tags: ['Alerts'],
        summary: 'List alerts',
        description:
          'Customers and technicians see their own alerts. Admins see all alerts. Filter isRead=true or isRead=false. An empty list is data [] with meta.total 0.',
        security: bearer,
        parameters: [
          ...paging,
          ...sortParams(['createdAt', 'severity'], 'createdAt'),
          { ...unitQuery, required: false },
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'severity', in: 'query', schema: { type: 'string' } },
          { name: 'isRead', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
        ],
        responses: { '200': ok('Alerts'), ...errors('401', '500') },
      },
    },
    '/api/v1/alerts/summary': {
      get: {
        tags: ['Alerts'],
        summary: 'Unread alert counts',
        description: 'Badge counts for the alerts screen: unread total and counts by severity.',
        security: bearer,
        responses: { '200': ok('Summary'), ...errors('401', '500') },
      },
    },
    '/api/v1/alerts/unread': {
      get: {
        tags: ['Alerts'],
        summary: 'List unread alerts',
        security: bearer,
        parameters: paging,
        responses: { '200': ok('Unread alerts'), ...errors('401', '500') },
      },
    },
    '/api/v1/alerts/read-all': {
      patch: {
        tags: ['Alerts'],
        summary: 'Mark all of the current user alerts as read',
        security: bearer,
        responses: { '200': ok('Updated'), ...errors('401', '500') },
      },
    },
    '/api/v1/alerts/{id}/read': {
      patch: {
        tags: ['Alerts'],
        summary: 'Mark one alert as read',
        security: bearer,
        parameters: [idParam],
        responses: { '200': ok('Updated'), ...errors('401', '403', '404', '500') },
      },
    },
    '/api/v1/alerts/{id}': {
      delete: {
        tags: ['Alerts'],
        summary: 'Delete an alert',
        security: bearer,
        parameters: [idParam],
        responses: { '200': ok('Deleted'), ...errors('401', '403', '404', '500') },
      },
    },
    '/api/v1/dashboard': {
      get: {
        tags: ['Dashboard'],
        summary: 'Mobile dashboard',
        description:
          'Home screen payload. cards has one entry per owned unit with presence, the latest reading, unread alerts, and equipment counts. The older summary fields remain on the same response.',
        security: bearer,
        parameters: [{ ...unitQuery, required: false }],
        responses: { '200': ok('Dashboard'), ...errors('401', '403', '404', '500') },
      },
    },
    '/api/v1/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'List users',
        description: 'Admin only.',
        security: bearer,
        parameters: [
          ...paging,
          { name: 'role', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'isActive', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: { '200': ok('Users'), ...errors('401', '403', '500') },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create a user',
        description: 'Admin provisioning for any role. The password is hashed and not returned.',
        security: bearer,
        requestBody: jsonBody({ type: 'object', additionalProperties: true }),
        responses: { '201': ok('Created'), ...errors('400', '401', '403', '409', '500') },
      },
    },
    '/api/v1/admin/users/{id}/activation': {
      patch: {
        tags: ['Admin'],
        summary: 'Activate or deactivate a user',
        security: bearer,
        parameters: [idParam],
        requestBody: jsonBody({
          type: 'object',
          required: ['isActive'],
          properties: { isActive: { type: 'boolean' } },
        }),
        responses: { '200': ok('Updated'), ...errors('400', '401', '403', '404', '409', '500') },
      },
    },
    '/api/v1/admin/farming-units': {
      get: {
        tags: ['Admin'],
        summary: 'List all farming units',
        security: bearer,
        parameters: paging,
        responses: { '200': ok('Farming units'), ...errors('401', '403', '500') },
      },
    },
    '/api/v1/admin/devices': {
      get: {
        tags: ['Admin'],
        summary: 'List all devices',
        security: bearer,
        parameters: paging,
        responses: { '200': ok('Devices'), ...errors('401', '403', '500') },
      },
    },
    '/api/v1/admin/alerts': {
      get: {
        tags: ['Admin'],
        summary: 'List system alerts',
        security: bearer,
        parameters: paging,
        responses: { '200': ok('Alerts'), ...errors('401', '403', '500') },
      },
    },
    '/api/v1/admin/sensors/statistics': {
      get: {
        tags: ['Admin'],
        summary: 'System sensor statistics',
        security: bearer,
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { '200': ok('Statistics'), ...errors('400', '401', '403', '500') },
      },
    },
    '/api/v1/admin/statistics': {
      get: {
        tags: ['Admin'],
        summary: 'System statistics',
        security: bearer,
        responses: { '200': ok('Statistics'), ...errors('401', '403', '500') },
      },
    },
  },
};
