import type { DevicePrincipal, AuthUser } from './index';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      device?: DevicePrincipal;
    }
  }
}

export {};
