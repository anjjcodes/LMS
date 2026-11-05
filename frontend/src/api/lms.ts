import type {
  AuditEntryDto,
  CreatePoolRequest,
  LoginResponse,
  Page,
  PoolDto,
  PoolStatus,
  SeatDto,
  SeatMutationResponse,
  SeatStatus,
  VerifyResponse,
} from '@lms/shared';
import { request } from './client';

const qs = (params: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
};

export const lmsApi = {
  login: (email: string, password: string) =>
    request<LoginResponse>('POST', '/auth/login', { body: { email, password } }),

  listPools: (p: { status?: PoolStatus; cursor?: string; limit?: number } = {}) =>
    request<Page<PoolDto>>('GET', `/pools${qs(p)}`),
  getPool: (poolId: string) => request<PoolDto>('GET', `/pools/${poolId}`),
  createPool: (body: CreatePoolRequest) => request<PoolDto>('POST', '/pools', { body }),

  listSeats: (poolId: string, p: { status?: SeatStatus; cursor?: string; limit?: number } = {}) =>
    request<Page<SeatDto>>('GET', `/pools/${poolId}/seats${qs(p)}`),
  assignSeat: (poolId: string, email: string) =>
    request<SeatMutationResponse>('POST', `/pools/${poolId}/seats`, { body: { email } }),
  revokeSeat: (poolId: string, seatId: string, reason?: string) =>
    request<SeatMutationResponse>('POST', `/pools/${poolId}/seats/${seatId}/revoke`, {
      body: reason ? { reason } : {},
    }),

  listAudit: (poolId: string, p: { cursor?: string; limit?: number } = {}) =>
    request<Page<AuditEntryDto>>('GET', `/pools/${poolId}/audit${qs(p)}`),

  verify: (apiKey: string, email: string) =>
    request<VerifyResponse>('POST', '/licenses/verify', { apiKey, body: { email } }),
};
