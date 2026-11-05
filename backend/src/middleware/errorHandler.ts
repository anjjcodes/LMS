import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ErrorBody } from '@lms/shared';
import { AppError } from '../errors/AppError';
import { logger } from '../lib/logger';

interface PgLikeError {
  code?: string;
  constraint?: string;
}

/** Translate infrastructure errors (Postgres, body-parser) into API errors. */
function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  const e = err as PgLikeError & { type?: string; status?: number; message?: string };

  // body-parser
  if (e.type === 'entity.too.large') return new AppError('PAYLOAD_TOO_LARGE', 'Request body is too large');
  if (e.type === 'entity.parse.failed') return new AppError('VALIDATION_ERROR', 'Request body is not valid JSON');

  switch (e.code) {
    case '23505': // unique_violation
      if (e.constraint === 'uq_active_seat_per_pool') {
        return new AppError('SEAT_ALREADY_ASSIGNED', 'This employee already holds an active seat in this pool');
      }
      return new AppError('INTERNAL_ERROR', 'An unexpected error occurred');
    case '40P01': // deadlock_detected (after retries)
    case '40001': // serialization_failure
    case '55P03': // lock_not_available (lock_timeout)
    case '57014': // query_canceled (statement_timeout)
      return new AppError('SERVICE_UNAVAILABLE', 'The service is busy, please retry');
  }
  // Connection-level failures: Postgres class 08 or Node socket errors.
  if (
    (typeof e.code === 'string' && e.code.startsWith('08')) ||
    ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', '57P01', '57P03'].includes(e.code ?? '') ||
    /timeout exceeded when trying to connect|Connection terminated/i.test(e.message ?? '')
  ) {
    return new AppError('SERVICE_UNAVAILABLE', 'The service is temporarily unavailable, please retry');
  }
  // 23514 (check_violation) and everything else: a bug, not a user error.
  return new AppError('INTERNAL_ERROR', 'An unexpected error occurred');
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError('NOT_FOUND', 'Route not found'));
};

/** The ONLY place errors become HTTP responses. Never leaks stack traces or SQL. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appErr = toAppError(err);

  if (appErr.status >= 500) {
    // Full detail goes to server logs only, correlated by requestId.
    logger.error({ err, requestId: req.requestId, path: req.path }, 'Request failed');
  }
  if (appErr.code === 'SERVICE_UNAVAILABLE' || appErr.code === 'RATE_LIMITED') {
    res.setHeader('Retry-After', '1');
  }

  const body: ErrorBody = {
    error: {
      code: appErr.code,
      message: appErr.message,
      ...(appErr.details ? { details: appErr.details } : {}),
      requestId: req.requestId,
    },
  };
  res.status(appErr.status).json(body);
};
