import { Router } from 'express';
import { z } from 'zod';
import type { VerifyResponse } from '@lms/shared';
import { db } from '../../db/pool';
import { emailSchema } from '../../lib/validation';
import { apiClientAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

const VerifyBody = z.strictObject({ email: emailSchema });

/**
 * Licensed ⇔ the email holds an ACTIVE seat in a pool of the caller's organization whose
 * date window contains today (DB clock). Expiry needs no cron job — it's evaluated per request.
 * Uses the partial index idx_seat_verify, then a PK lookup on the pool.
 */
export async function verifyLicense(organizationId: string, email: string): Promise<VerifyResponse> {
  const { rows } = await db.query<{ pool_id: string; end_date: string; checked_at: Date }>(
    `SELECT p.id AS pool_id, p.end_date, now() AS checked_at
       FROM seat_assignments s
       JOIN license_pools p ON p.id = s.pool_id
      WHERE s.employee_email  = $1
        AND s.status          = 'ACTIVE'
        AND p.organization_id = $2
        AND CURRENT_DATE BETWEEN p.start_date AND p.end_date
      ORDER BY p.end_date DESC
      LIMIT 1`,
    [email, organizationId],
  );
  const hit = rows[0];
  if (hit) {
    return { email, licensed: true, poolId: hit.pool_id, validUntil: hit.end_date, checkedAt: hit.checked_at.toISOString() };
  }
  return { email, licensed: false, reason: 'NO_ACTIVE_LICENSE', checkedAt: new Date().toISOString() };
}

export const verifyRouter = Router();

verifyRouter.post('/verify', validate({ body: VerifyBody }), async (req, res) => {
  const auth = apiClientAuth(req);
  const { email } = req.valid.body as z.infer<typeof VerifyBody>;
  res.setHeader('Cache-Control', 'no-store');
  // "Not licensed" is a valid answer → 200, never 404.
  res.status(200).json(await verifyLicense(auth.organizationId, email));
});
