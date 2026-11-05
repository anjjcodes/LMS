import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/pool';
import { AppError } from '../../errors/AppError';
import { decodeCursor, isTimeIdCursor } from '../../lib/cursor';
import { toPage } from '../../lib/pagination';
import { cursorSchema, emailSchema, pageLimitSchema, uuidSchema } from '../../lib/validation';
import { adminAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { poolsRepository } from '../pools/pools.repository';
import { seatsRepository, toSeatDto } from './seats.repository';
import { assignSeat, revokeSeat } from './seats.service';

const PoolParams = z.object({ poolId: uuidSchema });
const SeatParams = z.object({ poolId: uuidSchema, seatId: uuidSchema });
const AssignBody = z.strictObject({ email: emailSchema });
const RevokeBody = z.strictObject({ reason: z.string().trim().max(500).optional() });
const ListSeatsQuery = z.object({
  limit: pageLimitSchema,
  cursor: cursorSchema,
  status: z.enum(['ACTIVE', 'REVOKED']).optional(),
});

// mergeParams: inherit :poolId from the parent mount path.
export const seatsRouter = Router({ mergeParams: true });

seatsRouter.post(
  '/',
  requireRole('ORG_ADMIN'),
  validate({ params: PoolParams, body: AssignBody }),
  async (req, res) => {
    const auth = adminAuth(req);
    const { poolId } = req.valid.params as z.infer<typeof PoolParams>;
    const { email } = req.valid.body as z.infer<typeof AssignBody>;
    const seat = await assignSeat({ ...auth, requestId: req.requestId }, poolId, email);
    res.status(201).location(`/api/v1/pools/${poolId}/seats/${seat.id}`).json(seat);
  },
);

seatsRouter.get('/', validate({ params: PoolParams, query: ListSeatsQuery }), async (req, res) => {
  const auth = adminAuth(req);
  const { poolId } = req.valid.params as z.infer<typeof PoolParams>;
  const q = req.valid.query as z.infer<typeof ListSeatsQuery>;
  if (!(await poolsRepository.findById(db, auth.organizationId, poolId))) {
    throw new AppError('POOL_NOT_FOUND', 'License pool not found');
  }
  const cursor = decodeCursor(q.cursor, isTimeIdCursor);
  const rows = await seatsRepository.list(db, poolId, { status: q.status, limit: q.limit, cursor });
  res.json(toPage(rows, q.limit, toSeatDto, (r) => ({ t: r.assigned_at_cursor, id: r.id })));
});

seatsRouter.post(
  '/:seatId/revoke',
  requireRole('ORG_ADMIN'),
  validate({ params: SeatParams, body: RevokeBody }),
  async (req, res) => {
    const auth = adminAuth(req);
    const { poolId, seatId } = req.valid.params as z.infer<typeof SeatParams>;
    const { reason } = req.valid.body as z.infer<typeof RevokeBody>;
    const seat = await revokeSeat({ ...auth, requestId: req.requestId }, poolId, seatId, reason);
    res.status(200).json(seat);
  },
);
