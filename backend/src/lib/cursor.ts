import { AppError } from '../errors/AppError';

/**
 * Opaque keyset-pagination cursors. Encoded as base64url JSON so clients treat them as tokens,
 * and decoded defensively — a tampered cursor is a 400, never a 500.
 */
export function encodeCursor(value: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeCursor<T extends Record<string, unknown>>(
  cursor: string | undefined,
  isValid: (v: Record<string, unknown>) => v is T,
): T | undefined {
  if (!cursor) return undefined;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (parsed && typeof parsed === 'object' && isValid(parsed as Record<string, unknown>)) {
      return parsed as T;
    }
  } catch {
    /* fall through */
  }
  throw new AppError('VALIDATION_ERROR', 'Invalid pagination cursor', {
    fields: [{ path: 'cursor', message: 'is invalid' }],
  });
}

export interface TimeIdCursor extends Record<string, unknown> {
  t: string;
  id: string;
}

// `t` is the Postgres timestamptz text (microsecond precision). A JS Date would truncate to
// milliseconds and break keyset comparisons, so cursors carry the DB's own representation.
const PG_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(\+00|Z)?$/;

export const isTimeIdCursor = (v: Record<string, unknown>): v is TimeIdCursor =>
  typeof v.t === 'string' &&
  PG_TIMESTAMP.test(v.t) &&
  typeof v.id === 'string' &&
  /^[0-9a-f-]{36}$/i.test(v.id);

export interface NumericIdCursor extends Record<string, unknown> {
  id: number;
}

export const isNumericIdCursor = (v: Record<string, unknown>): v is NumericIdCursor =>
  typeof v.id === 'number' && Number.isSafeInteger(v.id) && v.id > 0;
