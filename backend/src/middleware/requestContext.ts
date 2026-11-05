import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { AppError } from '../errors/AppError';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

/** Assigns a correlation id (accepting a well-formed upstream one) and echoes it back. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get('x-request-id');
  req.requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : `req_${randomUUID()}`;
  req.valid = {};
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

/** Writes with a body must be JSON (415 otherwise) — avoids silently ignoring form posts. */
export const requireJsonBody: RequestHandler = (req, _res, next) => {
  const hasBody = Number(req.get('content-length') ?? 0) > 0 || req.get('transfer-encoding') !== undefined;
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && hasBody && !req.is('application/json')) {
    return next(new AppError('UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json'));
  }
  next();
};
