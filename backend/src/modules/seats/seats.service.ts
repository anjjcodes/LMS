import type { SeatMutationResponse } from '@lms/shared';
import { db, withTransaction } from '../../db/pool';
import { AppError } from '../../errors/AppError';
import { auditRepository } from '../audit/audit.repository';
import { poolsRepository } from '../pools/pools.repository';
import { seatsRepository, toSeatDto } from './seats.repository';

interface Actor {
  adminId: string;
  organizationId: string;
  requestId: string;
}

const isActiveSeatConflict = (err: unknown) =>
  (err as { code?: string }).code === '23505' &&
  (err as { constraint?: string }).constraint === 'uq_active_seat_per_pool';

/**
 * Assign a seat. One transaction:
 *   ① atomic conditional reserve on the pool row (capacity + date window)  → serializes racers
 *   ② insert seat (partial unique index blocks duplicate active seats)
 *   ③ insert audit row
 * Any failure rolls back all three — no orphaned increments, no unaudited assigns.
 */
export async function assignSeat(actor: Actor, poolId: string, email: string): Promise<SeatMutationResponse> {
  try {
    return await withTransaction(async (c) => {
      const pool = await poolsRepository.reserveSeat(c, actor.organizationId, poolId);
      if (!pool) throw await explainReserveFailure(c, actor.organizationId, poolId, email);

      const seat = await seatsRepository.insert(c, poolId, email, actor.adminId);
      await auditRepository.insert(c, {
        poolId,
        seatId: seat.id,
        action: 'SEAT_ASSIGNED',
        actorAdminId: actor.adminId,
        employeeEmail: email,
        requestId: actor.requestId,
      });
      return { ...toSeatDto(seat), pool };
    });
  } catch (err) {
    if (isActiveSeatConflict(err)) {
      // The transaction (including the counter increment) has already rolled back.
      const existing = await seatsRepository.findActiveByEmail(db, poolId, email);
      throw new AppError('SEAT_ALREADY_ASSIGNED', 'This employee already holds an active seat in this pool', {
        seatId: existing?.id ?? null,
      });
    }
    throw err;
  }
}

async function explainReserveFailure(
  c: Parameters<typeof poolsRepository.diagnose>[0],
  organizationId: string,
  poolId: string,
  email: string,
): Promise<AppError> {
  const p = await poolsRepository.diagnose(c, organizationId, poolId);
  if (!p) return new AppError('POOL_NOT_FOUND', 'License pool not found');
  if (p.not_started) {
    return new AppError('POOL_NOT_ACTIVE', `License pool is not active until ${p.start_date}`, {
      reason: 'NOT_STARTED',
      startDate: p.start_date,
    });
  }
  if (p.expired) {
    return new AppError('POOL_NOT_ACTIVE', `License pool expired on ${p.end_date}`, {
      reason: 'EXPIRED',
      endDate: p.end_date,
    });
  }
  const existing = await seatsRepository.findActiveByEmail(c, poolId, email);
  if (existing) {
    return new AppError('SEAT_ALREADY_ASSIGNED', 'This employee already holds an active seat in this pool', {
      seatId: existing.id,
    });
  }
  return new AppError('POOL_FULL', `License pool has no available seats (${p.active_seats}/${p.capacity} in use)`, {
    poolId,
    capacity: p.capacity,
    activeSeats: p.active_seats,
  });
}

/**
 * Revoke a seat. Lock order matches assign (POOL row first, then seat) to prevent deadlocks.
 * Allowed even after the pool has expired, so admins can still clean up.
 */
export async function revokeSeat(
  actor: Actor,
  poolId: string,
  seatId: string,
  reason?: string,
): Promise<SeatMutationResponse> {
  return withTransaction(async (c) => {
    if (!(await poolsRepository.lockForUpdate(c, actor.organizationId, poolId))) {
      throw new AppError('POOL_NOT_FOUND', 'License pool not found');
    }
    const seat = await seatsRepository.revoke(c, poolId, seatId, actor.adminId);
    if (!seat) {
      const exists = await seatsRepository.findInPool(c, poolId, seatId);
      throw exists
        ? new AppError('SEAT_NOT_ACTIVE', 'Seat has already been revoked')
        : new AppError('SEAT_NOT_FOUND', 'Seat not found in this pool');
    }
    const pool = await poolsRepository.releaseSeat(c, poolId);
    await auditRepository.insert(c, {
      poolId,
      seatId,
      action: 'SEAT_REVOKED',
      actorAdminId: actor.adminId,
      employeeEmail: seat.employee_email,
      requestId: actor.requestId,
      metadata: reason ? { reason } : {},
    });
    return { ...toSeatDto(seat), pool };
  });
}
