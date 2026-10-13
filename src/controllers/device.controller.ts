import { requireUser } from '../middleware/auth.middleware';
import { deviceService } from '../services/device.service';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import type {
  HeartbeatInput,
  ListDevicesQuery,
  RegisterDeviceInput,
  UpdateDeviceInput,
} from '../validators/device.validator';
import type { DeviceTelemetryInput } from '../validators/sensor.validator';

export const deviceController = {
  register: asyncHandler(async (req, res) => {
    const data = await deviceService.register(requireUser(req), req.body as RegisterDeviceInput);
    sendSuccess(res, {
      status: 201,
      message: 'Device registered. Store the API key now; it is not shown again.',
      data,
    });
  }),

  list: asyncHandler(async (req, res) => {
    const result = await deviceService.list(
      requireUser(req),
      req.query as unknown as ListDevicesQuery,
    );
    sendSuccess(res, { message: 'Devices retrieved', data: result.items, meta: result.meta });
  }),

  get: asyncHandler(async (req, res) => {
    const data = await deviceService.getById(requireUser(req), req.params.id);
    sendSuccess(res, { message: 'Device retrieved', data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await deviceService.update(
      requireUser(req),
      req.params.id,
      req.body as UpdateDeviceInput,
    );
    sendSuccess(res, { message: 'Device updated', data });
  }),

  rotateKey: asyncHandler(async (req, res) => {
    const data = await deviceService.rotateKey(requireUser(req), req.params.id);
    sendSuccess(res, { message: 'Device API key rotated. Store the new key now.', data });
  }),

  telemetry: asyncHandler(async (req, res) => {
    if (!req.device) throw new ApiError(401, 'UNAUTHORIZED', 'Device authentication required');
    const data = await deviceService.ingestTelemetry(req.device, req.body as DeviceTelemetryInput);
    sendSuccess(res, { status: 201, message: 'Telemetry accepted', data });
  }),

  heartbeat: asyncHandler(async (req, res) => {
    if (!req.device) throw new ApiError(401, 'UNAUTHORIZED', 'Device authentication required');
    const data = await deviceService.heartbeat(req.device, req.body as HeartbeatInput);
    sendSuccess(res, { message: 'Heartbeat recorded', data });
  }),

  commands: asyncHandler(async (req, res) => {
    if (!req.device) throw new ApiError(401, 'UNAUTHORIZED', 'Device authentication required');
    const data = await deviceService.pendingCommands(req.device);
    sendSuccess(res, { message: 'Pending commands retrieved', data });
  }),

  acknowledge: asyncHandler(async (req, res) => {
    if (!req.device) throw new ApiError(401, 'UNAUTHORIZED', 'Device authentication required');
    const body = req.body as { status: 'ACKNOWLEDGED' | 'FAILED' };
    const data = await deviceService.acknowledge(req.device, req.params.commandId, body.status);
    sendSuccess(res, { message: 'Command updated', data });
  }),
};
