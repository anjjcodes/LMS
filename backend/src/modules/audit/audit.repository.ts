import type { AuditAction, AuditEntryDto } from '@lms/shared';
import type { DbClient, Queryable } from '../../db/pool';

export interface NewAuditEntry {
  poolId: string;
  seatId?: string | null;
  action: AuditAction;
  actorAdminId: string;
  employeeEmail?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
}

interface AuditRow {
  id: number;
  action: AuditAction;
  employee_email: string | null;
  seat_assignment_id: string | null;
  actor_admin_id: string;
  actor_email: string;
  occurred_at: Date;
  request_id: string | null;
  metadata: Record<string, unknown>;
}

const toDto = (r: AuditRow): AuditEntryDto => ({
  id: r.id,
  action: r.action,
  employeeEmail: r.employee_email,
  seatId: r.seat_assignment_id,
  actor: { id: r.actor_admin_id, email: r.actor_email },
  occurredAt: r.occurred_at.toISOString(),
  requestId: r.request_id,
  metadata: r.metadata,
});

export const auditRepository = {
  /** Always called with the SAME client as the business write → audit commits atomically with it. */
  async insert(c: DbClient, e: NewAuditEntry): Promise<void> {
    await c.query(
      `INSERT INTO audit_log (pool_id, seat_assignment_id, action, actor_admin_id, employee_email, request_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [e.poolId, e.seatId ?? null, e.action, e.actorAdminId, e.employeeEmail ?? null, e.requestId ?? null, e.metadata ?? {}],
    );
  },

  async listForPool(q: Queryable, poolId: string, limit: number, beforeId?: number): Promise<AuditEntryDto[]> {
    const { rows } = await q.query<AuditRow>(
      `SELECT a.id, a.action, a.employee_email, a.seat_assignment_id, a.actor_admin_id,
              ad.email AS actor_email, a.occurred_at, a.request_id, a.metadata
         FROM audit_log a
         JOIN admins ad ON ad.id = a.actor_admin_id
        WHERE a.pool_id = $1
          AND ($3::bigint IS NULL OR a.id < $3)
        ORDER BY a.id DESC
        LIMIT $2`,
      [poolId, limit + 1, beforeId ?? null],
    );
    return rows.map(toDto);
  },
};
