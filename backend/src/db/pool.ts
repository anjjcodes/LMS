import pg from 'pg';
import { env } from '../config/env';
import { logger } from '../lib/logger';

// Return DATE columns as 'YYYY-MM-DD' strings. The default parser builds a JS Date in the
// server's local timezone, which silently shifts calendar dates.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
// BIGINT (audit ids, COUNT(*)) — values in this domain are far below 2^53.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

export const db = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  // The database clock is the single source of truth for "today" (date-window checks),
  // so every session runs in UTC regardless of server or container settings.
  options: '-c timezone=UTC -c statement_timeout=10000',
});

db.on('error', (err) => {
  // Errors on idle clients (e.g. DB restart). The pool discards the client; log and continue.
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

export type DbClient = pg.PoolClient;
export type Queryable = pg.Pool | pg.PoolClient;

/** Postgres SQLSTATE codes that are safe to retry the whole transaction for. */
const RETRYABLE = new Set(['40P01' /* deadlock_detected */, '40001' /* serialization_failure */]);

interface TxOptions {
  /** Max time to wait for a row lock before failing (→ 503). */
  lockTimeoutMs?: number;
  /** Max time for any single statement in the transaction. */
  statementTimeoutMs?: number;
  /** Retries on deadlock / serialization failure. */
  retries?: number;
}

/**
 * Runs `fn` inside a single transaction on one dedicated connection.
 * - COMMIT on success, ROLLBACK on any thrown error (including business errors).
 * - The connection is always released (no pool leaks).
 * - Deadlocks are retried a bounded number of times.
 */
export async function withTransaction<T>(
  fn: (client: DbClient) => Promise<T>,
  { lockTimeoutMs = 3_000, statementTimeoutMs = 5_000, retries = 1 }: TxOptions = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL lock_timeout = ${Math.trunc(lockTimeoutMs)}`);
      await client.query(`SET LOCAL statement_timeout = ${Math.trunc(statementTimeoutMs)}`);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      const code = (err as { code?: string }).code;
      if (code && RETRYABLE.has(code) && attempt < retries) {
        logger.warn({ code, attempt }, 'Retrying transaction after transient conflict');
        continue;
      }
      throw err;
    } finally {
      client.release();
    }
  }
}
