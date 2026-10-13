# AgroHaven API

AgroHaven is an affordable IoT aeroponic farming system for communities in Rwanda and other African communities. This service is the production REST API used by the mobile application and by farming-unit hardware.

The API stores users, farming units, device identity, sensor history, equipment commands, automation rules, crops, harvests, recorded water use, and alerts. It does not pretend that a pump changed state when the device is offline, and it does not invent water-saving claims from unrecorded baselines.

## Technologies

- Node.js and Express
- TypeScript in strict mode
- PostgreSQL and Prisma
- JWT access tokens
- bcrypt password hashing
- Zod request validation
- Swagger UI / OpenAPI
- Helmet, CORS, and express-rate-limit
- Morgan and structured JSON logs
- Jest and Supertest

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL 15 or newer

Docker is optional. A `docker-compose.yml` file is included for machines that use Docker. This workspace was developed against a local PostgreSQL 17 service.

## Installation

```bash
npm install
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env` before starting the API. `JWT_SECRET` must be at least 32 characters. Do not commit `.env`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `TEST_DATABASE_URL` | For tests | Separate database that tests are allowed to empty |
| `JWT_SECRET` | Yes | HMAC secret for access tokens, minimum 32 characters |
| `JWT_EXPIRES_IN` | No | Token lifetime, default `1d` |
| `PORT` | No | HTTP port, default `3000` |
| `NODE_ENV` | No | `development`, `test`, or `production` |
| `CORS_ORIGIN` | No | Comma-separated allowed origins, or `*` |
| `DEVICE_OFFLINE_AFTER_MINUTES` | No | How long after `lastSeen` a device is treated as offline |
| `BCRYPT_SALT_ROUNDS` | No | Between 10 and 15, default 12 |
| `ALERT_DEDUPE_MINUTES` | No | Suppress repeated alerts of the same type |
| `TIMEZONE` | No | Calendar boundaries for statistics, default `Africa/Kigali` |
| `RUN_BACKGROUND_JOBS` | No | `true` runs the in-process scheduler |
| `PASSWORD_RESET_MINUTES` | No | Reset token lifetime |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | No | When set, forgot-password sends email |

## PostgreSQL setup

Create a role and two databases. Use a password you choose, then put that password in `DATABASE_URL` and `TEST_DATABASE_URL`.

```sql
CREATE USER agrohaven WITH PASSWORD 'agrohaven';
CREATE DATABASE agrohaven OWNER agrohaven;
CREATE DATABASE agrohaven_test OWNER agrohaven;
GRANT ALL PRIVILEGES ON DATABASE agrohaven TO agrohaven;
GRANT ALL PRIVILEGES ON DATABASE agrohaven_test TO agrohaven;
```

If PostgreSQL is already installed as a Windows service, connect with `psql` as an administrator and run those statements. The example password above is for local development only.

With Docker:

```bash
docker compose up -d
```

The compose file creates the `agrohaven` database. Create `agrohaven_test` the same way before running tests:

```bash
docker compose exec postgres psql -U agrohaven -d agrohaven -c "CREATE DATABASE agrohaven_test OWNER agrohaven;"
```

## Prisma setup

Prisma Client is generated from `prisma/schema.prisma`.

```bash
npm run db:generate
```

`npm install` also runs `prisma generate`.

## Database migration

Development:

```bash
npx prisma migrate dev
```

Production and the test database:

```bash
npx prisma migrate deploy
```

Apply the same migrations to the test database:

```bash
# PowerShell
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npx prisma migrate deploy
```

Set `DATABASE_URL` back to the application database before seeding or starting the server.

## Seed database

```bash
npm run db:seed
```

The seed is idempotent and is for development. It prints these accounts:

- `admin@agrohaven.local` / `AdminPass1`
- `customer@agrohaven.local` / `CustomerPass1`
- `technician@agrohaven.local` / `TechPass123`

The seeded device identifier is `AH-UNIT-001`. Its development API key is `dev-agrohaven-device-key`. Replace both before any shared or production deployment.

## Running the development server

```bash
npm run dev
```

The process listens on `PORT` and starts a one-minute in-process job that:

- marks devices offline when `lastSeen` is stale
- evaluates schedule automations
- deletes expired revoked tokens

Run only one API instance with `RUN_BACKGROUND_JOBS=true` if you scale horizontally. The other instances should set it to `false` until a dedicated worker owns those jobs.

## Running the production server

```bash
npm run build
npm start
```

Set `NODE_ENV=production`, a long random `JWT_SECRET`, and a locked-down `CORS_ORIGIN`. Configure SMTP if password reset email should be delivered. The reset token is emailed only when SMTP is configured. It is not written to logs or API responses.

## Swagger documentation

Interactive docs are served at [http://localhost:3000/api/docs](http://localhost:3000/api/docs).

The OpenAPI document is also available at `/api/docs/openapi.json`.

Authorize with a bearer token from login. Device endpoints use the `X-Device-Id` and `X-Device-Key` headers.

## API structure

Versioned routes live under `/api/v1`. Successful JSON has `success`, `message`, and usually `data`. Lists add `meta` with `page`, `limit`, `total`, and `totalPages`.

Errors use:

```json
{
  "success": false,
  "message": "Something went wrong",
  "error": {
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

| Area | Base path |
| --- | --- |
| Health | `GET /api/health` |
| Auth | `/api/v1/auth` |
| Users | `/api/v1/users` |
| Farming units | `/api/v1/farming-units` |
| Devices | `/api/v1/devices` |
| Sensors | `/api/v1/sensors` |
| Equipment | `/api/v1/equipment` |
| Automations | `/api/v1/automations` |
| Crops | `/api/v1/crops` |
| Harvests | `/api/v1/harvests` |
| Water usage | `/api/v1/water-usage` |
| Alerts | `/api/v1/alerts` |
| Dashboard | `GET /api/v1/dashboard` |
| Admin | `/api/v1/admin` |

`FarmingUnit.deviceId` is the hardware serial. `Device.id` and `SensorReading.deviceId` are the device record UUID. `Device.deviceIdentifier` matches the hardware serial.

Sensor columns are temperature (°C), humidity (%), light intensity (lux), air quality (the value reported by the sensor), and water level (%). Additional channels can be sent in `extra` without a migration.

Water totals are grouped by the recorded unit. A comparison is returned only when the client sends `baselineAmount`. That difference is baseline minus recorded usage. It is not a built-in scientific model.

## Authentication

Public registration creates a `CUSTOMER`. Admins create `ADMIN` and `TECHNICIAN` accounts through `/api/v1/admin/users`.

Send the access token as `Authorization: Bearer <token>`. Logout stores the token id until it expires. Changing or resetting a password increments `tokenVersion`, which invalidates older tokens.

Roles:

- `CUSTOMER` manages owned farming units, crops, and harvests, and operates equipment on those units.
- `TECHNICIAN` can read units and operate devices, equipment, sensors, and automations. Technicians cannot delete a unit or reassign its owner.
- `ADMIN` can assign units, activate or deactivate users, and call `/api/v1/admin`.

Devices authenticate with `X-Device-Id` and `X-Device-Key`. The raw key is returned once at registration or rotation. Only its SHA-256 hash is stored. A device is online only after a heartbeat or a device-authenticated reading inside `DEVICE_OFFLINE_AFTER_MINUTES`. User requests to turn equipment on or off return `409 DEVICE_OFFLINE` when that check fails, and the stored power state is left unchanged.

`POST /api/v1/devices/telemetry` is the endpoint for an ESP32 or NodeMCU. It accepts device credentials only, stores the reading, sets `lastSeen` to the time the API received the payload, and returns pending commands. `POST /api/v1/devices/heartbeat` updates presence when there is no new reading. `POST /api/v1/equipment/control` sets `WATER_PUMP`, `MIST_PUMP`, `LED_GROW_LIGHT`, or `FAN` power for a farming unit.

Water level below `LOW_WATER_PERCENT` creates `LOW_WATER`. Temperature above `HIGH_TEMPERATURE_CELSIUS` creates `HIGH_TEMPERATURE`. A device that stops communicating creates `DEVICE_OFFLINE`. Store overrides on the device as `configuration.alertThresholds`, for example `{ "waterLevel": { "value": 10 }, "additional": [...] }`. `additional` rules can use the core metrics or numeric keys in `extra`. Set `enabled` to false on `waterLevel` or `temperature` to turn that default off.

## Testing

Tests run against `agrohaven_test` and delete rows in that database. They refuse to run if the URL does not contain `agrohaven_test`.

```bash
npm test
```

Covered flows: registration, login, a protected route, farming-unit creation, sensor submission and validation, alert retrieval through an automation rule, device telemetry, equipment control, and offline and threshold alerts.

## Example API requests

Register:

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"fullName\":\"Aline Uwase\",\"email\":\"aline@example.com\",\"password\":\"Password1\",\"location\":\"Kigali\"}"
```

Login:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"customer@agrohaven.local\",\"password\":\"CustomerPass1\"}"
```

Create a farming unit:

```bash
curl -X POST http://localhost:3000/api/v1/farming-units \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Kacyiru Tower\",\"location\":\"Kacyiru, Kigali\"}"
```

Submit a reading from a device:

```bash
curl -X POST http://localhost:3000/api/v1/devices/telemetry \
  -H "X-Device-Id: AH-UNIT-001" \
  -H "X-Device-Key: dev-agrohaven-device-key" \
  -H "Content-Type: application/json" \
  -d "{\"temperature\":24.2,\"humidity\":60,\"waterLevel\":40}"
```

Turn the water pump on:

```bash
curl -X POST http://localhost:3000/api/v1/equipment/control \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"farmingUnitId\":\"UNIT_ID\",\"type\":\"WATER_PUMP\",\"powerState\":\"ON\"}"
```

Dashboard:

```bash
curl http://localhost:3000/api/v1/dashboard \
  -H "Authorization: Bearer TOKEN"
```

Health:

```bash
curl http://localhost:3000/api/health
```

## Project layout

```text
src/
  config/         environment, Prisma, OpenAPI
  controllers/    HTTP adapters
  middleware/     auth, validation, errors, rate limits
  routes/         /api/v1 routers
  services/       business rules and authorization
  repositories/   Prisma queries
  validators/     Zod schemas
  utils/          tokens, passwords, time, responses
  modules/        automation, device presence, statistics, mail, scheduler
  app.ts
  server.ts
prisma/
  schema.prisma
  seed.ts
tests/
docs/
```

More detail is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
