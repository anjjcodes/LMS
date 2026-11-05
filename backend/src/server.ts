import { createApp } from './app';
import { env } from './config/env';
import { db } from './db/pool';
import { logger } from './lib/logger';

const server = createApp().listen(env.PORT, () => {
  logger.info(`LMS API listening on http://localhost:${env.PORT}`);
});

// Graceful shutdown: stop accepting connections, finish in-flight requests, close the DB pool.
function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down');
  server.close(() => {
    db.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
