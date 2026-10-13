# Architecture

AgroHaven keeps HTTP, business rules, and database access separate.

- Routes validate input with Zod and call controllers.
- Controllers translate HTTP into service calls and a consistent JSON envelope.
- Services enforce ownership, role rules, device presence, and automation.
- Repositories are the only place that should query Prisma, except transactions that pass the transaction client into a repository method.
- `src/modules` holds behavior that is shared across services: the automation engine, offline detection, sensor and water calculations, password-reset delivery, and the scheduler.

Passwords are bcrypt hashes. Device API keys are high-entropy random values stored as SHA-256 hashes. JWT access tokens include a `jti` and a `tokenVersion`. Logout revokes the `jti`. Password changes increment `tokenVersion`.

Sensor readings keep the current metrics as columns and an `extra` JSON object for later sensor types. Statistics aggregate stored rows. They do not fill gaps with estimates.

Equipment power changes are queued as `DeviceCommand` rows only when `isDeviceOnline` is true. `POST /api/v1/equipment/control` targets every unit of one type, including the water pump, mist pump, LED grow lights, and fan. An offline device returns `DEVICE_OFFLINE` and does not change `powerState`.

ESP32 and NodeMCU boards submit readings to `POST /api/v1/devices/telemetry` with `X-Device-Id` and `X-Device-Key`. That call stores the reading, sets `lastSeen`, and returns pending commands. Heartbeat uses the same credentials and also updates `lastSeen`. Built-in threshold alerts use `LOW_WATER_PERCENT` and `HIGH_TEMPERATURE_CELSIUS`. A device can override those values, or add rules for later sensors, in `configuration.alertThresholds`. A device that was online and then misses `DEVICE_OFFLINE_AFTER_MINUTES` is marked offline and creates a `DEVICE_OFFLINE` alert.

The scheduler in `src/modules/jobs/scheduler.ts` is in-process. It is appropriate for a single API instance. For more than one instance, enable it on one node only.
