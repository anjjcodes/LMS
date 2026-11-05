import { ApiError } from '../api/client';

/** User-facing message for an error, keyed off the stable backend error code. */
export function errorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.';
  switch (err.code) {
    case 'VALIDATION_ERROR': {
      const fields = err.details?.fields as { path: string; message: string }[] | undefined;
      if (fields?.length) {
        return fields.map((f) => `${f.path.replace(/^(body|query|params)\./, '')}: ${f.message}`).join(' · ');
      }
      return err.message;
    }
    case 'POOL_FULL':
      return 'This pool is full. Revoke a seat before assigning a new one.';
    case 'SEAT_ALREADY_ASSIGNED':
      return 'This employee already holds an active seat in this pool.';
    case 'SEAT_NOT_ACTIVE':
      return 'This seat was already revoked (possibly by another administrator).';
    case 'FORBIDDEN':
      return 'Your role does not allow this action.';
    case 'SERVICE_UNAVAILABLE':
      return 'The service is busy. Please retry in a moment.';
    case 'INTERNAL_ERROR':
      return `Unexpected server error${err.requestId ? ` (ref ${err.requestId})` : ''}.`;
    default:
      return err.message;
  }
}

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** YYYY-MM-DD in UTC (matches the backend's calendar-date semantics). */
export const utcToday = () => new Date().toISOString().slice(0, 10);
export const utcDatePlusDays = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
