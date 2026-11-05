import { Router } from 'express';
import { z } from 'zod';
import { db, withTransaction } from '../../db/pool';
import { AppError } from '../../errors/AppError';
import { decodeCursor, isNumericIdCursor, isTimeIdCursor } from '../../lib/cursor';
import { toPage } from '../../lib/pagination';
import { cursorSchema, isoDateSchema, pageLimitSchema, uuidSchema } from '../../lib/validation';
import { adminAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { auditRepository } from '../audit/audit.repository';
import { seatsRouter } from '../seats/seats.routes';
import { poolsRepository, toPoolDto } from './pools.repository';

const CreatePoolBody = z
  .strictObject({
    name: z.string().trim().min(1, 'name is required').max(120),
    capacity: z.number().int().min(1).max(1_000_000),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
  })
  .refine((b) => b.endDate >= b.startDate, { path: ['endDate'], message: 'endDate must be on or after startDate' });

const PoolParams = z.object({ poolId: uuidSchema });
const ListPoolsQuery = z.object({
  limit: pageLimitSchema,
  cursor: cursorSchema,
  status: z.enum(['SCHEDULED', 'ACTIVE', 'EXPIRED']).optional(),
});
const AuditQuery = z.object({ limit: pageLimitSchema, cursor: cursorSchema });

export const poolsRouter = Router();
poolsRouter.use('/:poolId/seats', seatsRouter);

/** Create pool (ORG_ADMIN). Pool + POOL_CREATED audit row commit atomically. */
poolsRouter.post('/', requireRole('ORG_ADMIN'), validate({ body: CreatePoolBody }), async (req, res) => {
  const auth = adminAuth(req);
  const body = req.valid.body as z.infer<typeof CreatePoolBody>;

  const pool = await withTransaction(async (c) => {
    const row = await poolsRepository.insert(c, { ...body, organizationId: auth.organizationId, createdBy: auth.adminId });
    if (!row) {
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', {
        fields: [{ path: 'body.endDate', message: 'cannot create a pool that has already ended' }],
      });
    }
    await auditRepository.insert(c, {
      poolId: row.id,
      action: 'POOL_CREATED',
      actorAdminId: auth.adminId,
      requestId: req.requestId,
      metadata: { name: row.name, capacity: row.capacity, startDate: row.start_date, endDate: row.end_date },
    });
    return toPoolDto(row);
  });

  res.status(201).location(`/api/v1/pools/${pool.id}`).json(pool);
});

poolsRouter.get('/', validate({ query: ListPoolsQuery }), async (req, res) => {
  const auth = adminAuth(req);
  const q = req.valid.query as z.infer<typeof ListPoolsQuery>;
  const cursor = decodeCursor(q.cursor, isTimeIdCursor);
  const rows = await poolsRepository.list(db, auth.organizationId, { status: q.status, limit: q.limit, cursor });
  res.json(toPage(rows, q.limit, toPoolDto, (r) => ({ t: r.created_at_cursor, id: r.id })));
});

poolsRouter.get('/:poolId', validate({ params: PoolParams }), async (req, res) => {
  const auth = adminAuth(req);
  const { poolId } = req.valid.params as z.infer<typeof PoolParams>;
  const row = await poolsRepository.findById(db, auth.organizationId, poolId);
  // Another tenant's pool is indistinguishable from a missing one (no existence leak).
  if (!row) throw new AppError('POOL_NOT_FOUND', 'License pool not found');
  res.json(toPoolDto(row));
});

poolsRouter.get('/:poolId/audit', validate({ params: PoolParams, query: AuditQuery }), async (req, res) => {
  const auth = adminAuth(req);
  const { poolId } = req.valid.params as z.infer<typeof PoolParams>;
  const q = req.valid.query as z.infer<typeof AuditQuery>;
  if (!(await poolsRepository.findById(db, auth.organizationId, poolId))) {
    throw new AppError('POOL_NOT_FOUND', 'License pool not found');
  }
  const cursor = decodeCursor(q.cursor, isNumericIdCursor);
  const rows = await auditRepository.listForPool(db, poolId, q.limit, cursor?.id);
  res.json(toPage(rows, q.limit, (r) => r, (r) => ({ id: r.id })));
});
