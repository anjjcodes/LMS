import jwt from 'jsonwebtoken';
import type { AdminRole } from '@lms/shared';
import { env } from '../config/env';

const ISSUER = 'lms-api';
const AUDIENCE = 'lms-admin-ui';

export interface AdminTokenClaims {
  sub: string; // admin id
  org: string; // organization id
  role: AdminRole;
}

export function signAdminToken(claims: AdminTokenClaims): string {
  return jwt.sign({ org: claims.org, role: claims.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: claims.sub,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: env.JWT_EXPIRES_IN_SECONDS,
  });
}

/** Returns claims or null. Algorithm is pinned (blocks alg=none / alg-confusion attacks). */
export function verifyAdminToken(token: string): AdminTokenClaims | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (
      typeof payload === 'object' &&
      typeof payload.sub === 'string' &&
      typeof payload.org === 'string' &&
      (payload.role === 'ORG_ADMIN' || payload.role === 'ORG_VIEWER')
    ) {
      return { sub: payload.sub, org: payload.org, role: payload.role };
    }
    return null;
  } catch {
    return null;
  }
}
