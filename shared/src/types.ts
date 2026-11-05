/** API DTOs — the wire contract between backend and frontend. */

export type AdminRole = 'ORG_ADMIN' | 'ORG_VIEWER';
export type PoolStatus = 'SCHEDULED' | 'ACTIVE' | 'EXPIRED';
export type SeatStatus = 'ACTIVE' | 'REVOKED';
export type AuditAction = 'POOL_CREATED' | 'SEAT_ASSIGNED' | 'SEAT_REVOKED';

export interface AdminDto {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  organizationId: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  admin: AdminDto;
}

export interface PoolDto {
  id: string;
  name: string;
  capacity: number;
  activeSeats: number;
  availableSeats: number;
  startDate: string; // YYYY-MM-DD (UTC)
  endDate: string; // YYYY-MM-DD (UTC, inclusive)
  status: PoolStatus;
  createdBy: string;
  createdAt: string;
}

export interface PoolUsageDto {
  capacity: number;
  activeSeats: number;
  availableSeats: number;
}

export interface SeatDto {
  id: string;
  poolId: string;
  employeeEmail: string;
  status: SeatStatus;
  assignedBy: string;
  assignedAt: string;
  revokedBy: string | null;
  revokedAt: string | null;
}

export interface SeatMutationResponse extends SeatDto {
  pool: PoolUsageDto;
}

export interface AuditEntryDto {
  id: number;
  action: AuditAction;
  employeeEmail: string | null;
  seatId: string | null;
  actor: { id: string; email: string };
  occurredAt: string;
  requestId: string | null;
  metadata: Record<string, unknown>;
}

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

export type VerifyResponse =
  | { email: string; licensed: true; poolId: string; validUntil: string; checkedAt: string }
  | { email: string; licensed: false; reason: 'NO_ACTIVE_LICENSE'; checkedAt: string };

export interface CreatePoolRequest {
  name: string;
  capacity: number;
  startDate: string;
  endDate: string;
}
