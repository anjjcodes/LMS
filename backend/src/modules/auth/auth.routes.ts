import { Router } from 'express';
import { z } from 'zod';
import type { LoginResponse } from '@lms/shared';
import { env } from '../../config/env';
import { db } from '../../db/pool';
import { AppError } from '../../errors/AppError';
import { DUMMY_PASSWORD_HASH, verifyPassword } from '../../lib/crypto';
import { signAdminToken } from '../../lib/jwt';
import { emailSchema } from '../../lib/validation';
import { validate } from '../../middleware/validate';

export const LoginBody = z.strictObject({
  email: emailSchema,
  // Upper bound guards bcrypt CPU cost and its 72-byte truncation.
  password: z.string().min(1, 'password is required').max(128),
});
type LoginBody = z.infer<typeof LoginBody>;

interface AdminRow {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  role: 'ORG_ADMIN' | 'ORG_VIEWER';
  password_hash: string;
}

export async function login({ email, password }: LoginBody): Promise<LoginResponse> {
  const { rows } = await db.query<AdminRow>(
    'SELECT id, organization_id, email, full_name, role, password_hash FROM admins WHERE email = $1',
    [email],
  );
  const admin = rows[0];
  // Always run bcrypt, even for unknown emails, so response timing doesn't reveal which emails exist.
  const ok = await verifyPassword(password, admin?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!admin || !ok) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password');
  }
  return {
    accessToken: signAdminToken({ sub: admin.id, org: admin.organization_id, role: admin.role }),
    tokenType: 'Bearer',
    expiresIn: env.JWT_EXPIRES_IN_SECONDS,
    admin: {
      id: admin.id,
      email: admin.email,
      fullName: admin.full_name,
      role: admin.role,
      organizationId: admin.organization_id,
    },
  };
}

export const authRouter = Router();

authRouter.post('/login', validate({ body: LoginBody }), async (req, res) => {
  const result = await login(req.valid.body as LoginBody);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(result);
});
