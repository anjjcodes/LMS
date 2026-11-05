import type { SeatDto, SeatStatus } from '@lms/shared';
import type { DbClient, Queryable } from '../../db/pool';
import type { TimeIdCursor } from '../../lib/cursor';

export interface SeatRow {
  id: string;
  pool_id: string;
  employee_email: string;
  status: SeatStatus;
  assigned_by: string;
  assigned_at: Date;
  assigned_at_cursor: string;
  revoked_by: string | null;
  revoked_at: Date | null;
}

const SEAT_COLUMNS = `id, pool_id, employee_email, status, assigned_by, assigned_at,
  assigned_at::text AS assigned_at_cursor, revoked_by, revoked_at`;

export const toSeatDto = (r: SeatRow): SeatDto => ({
  id: r.id,
  poolId: r.pool_id,
  employeeEmail: r.employee_email,
  status: r.status,
  assignedBy: r.assigned_by,
  assignedAt: r.assigned_at.toISOString(),
  revokedBy: r.revoked_by,
  revokedAt: r.revoked_at ? r.revoked_at.toISOString() : null,
});

export const seatsRepository = {
  /** Raises 23505 on uq_active_seat_per_pool if the email already holds an active seat in the pool. */
  async insert(c: DbClient, poolId: string, email: string, adminId: string): Promise<SeatRow> {
    const { rows } = await c.query<SeatRow>(
      `INSERT INTO seat_assignments (pool_id, employee_email, assigned_by)
       VALUES ($1, $2, $3)
       RETURNING ${SEAT_COLUMNS}`,
      [poolId, email, adminId],
    );
    return rows[0]!;
  },

  async findActiveByEmail(q: Queryable, poolId: string, email: string): Promise<SeatRow | null> {
    const { rows } = await q.query<SeatRow>(
      `SELECT ${SEAT_COLUMNS} FROM seat_assignments WHERE pool_id = $1 AND employee_email = $2 AND status = 'ACTIVE'`,
      [poolId, email],
    );
    return rows[0] ?? null;
  },

  async findInPool(q: Queryable, poolId: string, seatId: string): Promise<SeatRow | null> {
    const { rows } = await q.query<SeatRow>(
      `SELECT ${SEAT_COLUMNS} FROM seat_assignments WHERE id = $1 AND pool_id = $2`,
      [seatId, poolId],
    );
    return rows[0] ?? null;
  },

  /** Conditional state change: only an ACTIVE seat can be revoked (concurrent double-revoke → 0 rows). */
  async revoke(c: DbClient, poolId: string, seatId: string, adminId: string): Promise<SeatRow | null> {
    const { rows } = await c.query<SeatRow>(
      `UPDATE seat_assignments
          SET status = 'REVOKED', revoked_at = now(), revoked_by = $3
        WHERE id = $1 AND pool_id = $2 AND status = 'ACTIVE'
        RETURNING ${SEAT_COLUMNS}`,
      [seatId, poolId, adminId],
    );
    return rows[0] ?? null;
  },

  async list(
    q: Queryable,
    poolId: string,
    opts: { status?: SeatStatus; limit: number; cursor?: TimeIdCursor },
  ): Promise<SeatRow[]> {
    const params: unknown[] = [poolId, opts.limit + 1];
    const where = ['pool_id = $1'];
    if (opts.status) {
      params.push(opts.status);
      where.push(`status = $${params.length}`);
    }
    if (opts.cursor) {
      params.push(opts.cursor.t, opts.cursor.id);
      where.push(`(assigned_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
    }
    const { rows } = await q.query<SeatRow>(
      `SELECT ${SEAT_COLUMNS} FROM seat_assignments
        WHERE ${where.join(' AND ')}
        ORDER BY assigned_at DESC, id DESC
        LIMIT $2`,
      params,
    );
    return rows;
  },
};
