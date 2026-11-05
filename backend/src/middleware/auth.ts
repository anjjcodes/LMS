import type { RequestHandler } from 'express';
import type { AdminRole } from '@lms/shared';
import { db } from '../db/pool';
import { AppError } from '../errors/AppError';
import { hashApiKey } from '../lib/crypto';
import { verifyAdminToken } from '../lib/jwt';

/** Admin routes: requires a valid `Authorization: Bearer <jwt>`. API keys are NOT accepted here. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  const header = req.get('authorization');
  const match = header?.match(/^Bearer\s+(.+)$/i);
  const claims = match?.[1] ? verifyAdminToken(match[1]) : null;
  if (!claims) {
    return next(new AppError('UNAUTHENTICATED', 'A valid admin access token is required'));
  }
  req.auth = { kind: 'admin', adminId: claims.sub, organizationId: claims.org, role: claims.role };
  next();
};

/** Role-based authorization. Must run after requireAdmin. */
export function requireRole(...roles: AdminRole[]): RequestHandler {
  return (req, _res, next) => {
    if (req.auth?.kind !== 'admin' || !roles.includes(req.auth.role)) {
      return next(new AppError('FORBIDDEN', 'You do not have permission to perform this action'));
    }
    next();
  };
}

/** SaaS routes: requires `X-API-Key`. Admin JWTs are NOT accepted here (least privilege). */
export const requireApiClient: RequestHandler = async (req, _res, next) => {
  const key = req.get('x-api-key');
  if (!key || key.length > 128) {
    return next(new AppError('INVALID_API_KEY', 'A valid API key is required'));
  }
  const { rows } = await db.query<{ id: string; organization_id: string }>(
    'SELECT id, organization_id FROM api_clients WHERE key_hash = $1 AND is_active',
    [hashApiKey(key)],
  );
  const client = rows[0];
  if (!client) {
    return next(new AppError('INVALID_API_KEY', 'A valid API key is required'));
  }
  req.auth = { kind: 'apiClient', clientId: client.id, organizationId: client.organization_id };
  next();
};

/** Narrowing helpers so handlers never touch an unauthenticated context. */
export function adminAuth(req: Express.Request) {
  if (req.auth?.kind !== 'admin') throw new AppError('UNAUTHENTICATED', 'Not authenticated');
  return req.auth;
}

export function apiClientAuth(req: Express.Request) {
  if (req.auth?.kind !== 'apiClient') throw new AppError('INVALID_API_KEY', 'Not authenticated');
  return req.auth;
}
