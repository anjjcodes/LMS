/**
 * Error code catalog shared by backend and frontend.
 * `code` is the stable machine-readable contract; messages are for humans and may change.
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  INVALID_API_KEY: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  POOL_NOT_FOUND: 404,
  SEAT_NOT_FOUND: 404,
  POOL_FULL: 409,
  SEAT_ALREADY_ASSIGNED: 409,
  SEAT_NOT_ACTIVE: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  POOL_NOT_ACTIVE: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

export interface FieldError {
  path: string;
  message: string;
}

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

export type PoolNotActiveReason = 'NOT_STARTED' | 'EXPIRED';
