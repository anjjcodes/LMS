import type { PoolDto, PoolStatus, PoolUsageDto } from '@lms/shared';
import type { DbClient, Queryable } from '../../db/pool';
import type { TimeIdCursor } from '../../lib/cursor';

interface PoolRow {
  id: string;
  name: string;
  capacity: number;
  active_seats: number;
  start_date: string;
  end_date: string;
  status: PoolStatus;
  created_by: string;
  created_at: Date;
  created_at_cursor: string;
}

// Status is derived from the DATABASE clock (single source of truth for "today", UTC).
const POOL_COLUMNS = `
  id, name, capacity, active_seats, start_date, end_date, created_by, created_at,
  created_at::text AS created_at_cursor,
  CASE WHEN CURRENT_DATE < start_date THEN 'SCHEDULED'
       WHEN CURRENT_DATE > end_date   THEN 'EXPIRED'
       ELSE 'ACTIVE' END AS status`;

const STATUS_FILTER: Record<PoolStatus, string> = {
  SCHEDULED: 'CURRENT_DATE < start_date',
  ACTIVE: 'CURRENT_DATE BETWEEN start_date AND end_date',
  EXPIRED: 'CURRENT_DATE > end_date',
};

export function toPoolDto(r: PoolRow): PoolDto {
  return {
    id: r.id,
    name: r.name,
    capacity: r.capacity,
    activeSeats: r.active_seats,
    availableSeats: r.capacity - r.active_seats,
    startDate: r.start_date,
    endDate: r.end_date,
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at.toISOString(),
  };
}

export const usage = (capacity: number, activeSeats: number): PoolUsageDto => ({
  capacity,
  activeSeats,
  availableSeats: capacity - activeSeats,
});

export const poolsRepository = {
  /** Inserts only if the pool has not already ended (checked against the DB clock). */
  async insert(
    c: DbClient,
    p: { organizationId: string; name: string; capacity: number; startDate: string; endDate: string; createdBy: string },
  ): Promise<PoolRow | null> {
    const { rows } = await c.query<PoolRow>(
      `INSERT INTO license_pools (organization_id, name, capacity, start_date, end_date, created_by)
       SELECT $1, $2, $3, $4::date, $5::date, $6
        WHERE $5::date >= CURRENT_DATE
       RETURNING ${POOL_COLUMNS}`,
      [p.organizationId, p.name, p.capacity, p.startDate, p.endDate, p.createdBy],
    );
    return rows[0] ?? null;
  },

  async findById(q: Queryable, organizationId: string, poolId: string): Promise<PoolRow | null> {
    const { rows } = await q.query<PoolRow>(
      `SELECT ${POOL_COLUMNS} FROM license_pools WHERE id = $1 AND organization_id = $2`,
      [poolId, organizationId],
    );
    return rows[0] ?? null;
  },

  async list(
    q: Queryable,
    organizationId: string,
    opts: { status?: PoolStatus; limit: number; cursor?: TimeIdCursor },
  ): Promise<PoolRow[]> {
    const params: unknown[] = [organizationId, opts.limit + 1];
    const where = ['organization_id = $1'];
    if (opts.status) where.push(STATUS_FILTER[opts.status]);
    if (opts.cursor) {
      params.push(opts.cursor.t, opts.cursor.id);
      where.push(`(created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
    }
    const { rows } = await q.query<PoolRow>(
      `SELECT ${POOL_COLUMNS} FROM license_pools
        WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC, id DESC
        LIMIT $2`,
      params,
    );
    return rows;
  },

  /**
   * ★ Atomic seat reservation — the heart of the concurrency guarantee.
   * One statement: takes the pool row lock, checks capacity AND date window, increments.
   * A concurrent transaction blocks on the row lock, then re-evaluates the WHERE against the
   * committed row (READ COMMITTED re-check) and matches 0 rows if the pool just became full.
   */
  async reserveSeat(c: DbClient, organizationId: string, poolId: string): Promise<PoolUsageDto | null> {
    const { rows } = await c.query<{ capacity: number; active_seats: number }>(
      `UPDATE license_pools
          SET active_seats = active_seats + 1, updated_at = now()
        WHERE id = $1
          AND organization_id = $2
          AND active_seats < capacity
          AND CURRENT_DATE BETWEEN start_date AND end_date
        RETURNING capacity, active_seats`,
      [poolId, organizationId],
    );
    const r = rows[0];
    return r ? usage(r.capacity, r.active_seats) : null;
  },

  /** Explains why reserveSeat matched 0 rows. Only chooses the error message; correctness is already decided. */
  async diagnose(
    c: DbClient,
    organizationId: string,
    poolId: string,
  ): Promise<{ capacity: number; active_seats: number; not_started: boolean; expired: boolean; start_date: string; end_date: string } | null> {
    const { rows } = await c.query(
      `SELECT capacity, active_seats, start_date, end_date,
              CURRENT_DATE < start_date AS not_started,
              CURRENT_DATE > end_date   AS expired
         FROM license_pools WHERE id = $1 AND organization_id = $2`,
      [poolId, organizationId],
    );
    return rows[0] ?? null;
  },

  /** Lock order rule: every write transaction locks the POOL row first, then seat rows. */
  async lockForUpdate(c: DbClient, organizationId: string, poolId: string): Promise<boolean> {
    const { rowCount } = await c.query(
      'SELECT 1 FROM license_pools WHERE id = $1 AND organization_id = $2 FOR UPDATE',
      [poolId, organizationId],
    );
    return rowCount === 1;
  },

  async releaseSeat(c: DbClient, poolId: string): Promise<PoolUsageDto> {
    const { rows } = await c.query<{ capacity: number; active_seats: number }>(
      `UPDATE license_pools
          SET active_seats = active_seats - 1, updated_at = now()
        WHERE id = $1
        RETURNING capacity, active_seats`,
      [poolId],
    );
    const r = rows[0]!;
    return usage(r.capacity, r.active_seats);
  },
};
