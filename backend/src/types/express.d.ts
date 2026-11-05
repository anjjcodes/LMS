import type { AdminRole } from '@lms/shared';

export type AuthContext =
  | { kind: 'admin'; adminId: string; organizationId: string; role: AdminRole }
  | { kind: 'apiClient'; clientId: string; organizationId: string };

declare global {
  namespace Express {
    interface Request {
      /** Correlation id, echoed as X-Request-Id and stored on audit rows. */
      requestId: string;
      /** Set by the authentication middleware. organizationId ALWAYS comes from here. */
      auth?: AuthContext;
      /** Zod-parsed request parts, set by the validate middleware. */
      valid: { params?: unknown; query?: unknown; body?: unknown };
    }
  }
}

export {};
