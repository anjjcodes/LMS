import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { db } from './db/pool';
import { logger } from './lib/logger';
import { requireAdmin, requireApiClient } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestId, requireJsonBody } from './middleware/requestContext';
import { authRouter } from './modules/auth/auth.routes';
import { poolsRouter } from './modules/pools/pools.routes';
import { verifyRouter } from './modules/verify/verify.routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // ── cross-cutting middleware (order matters) ──
  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (req) => (req as express.Request).requestId }));
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(','), exposedHeaders: ['X-Request-Id', 'Location'] }));
  app.use(requireJsonBody);
  app.use(express.json({ limit: '10kb' }));

  // ── health ──
  app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  });

  // ── API v1 ──
  const api = Router();
  api.use('/auth', authRouter);
  // Admin surface: JWT only. SaaS surface: API key only. The two credential types never overlap.
  api.use('/pools', requireAdmin, poolsRouter);
  api.use('/licenses', requireApiClient, verifyRouter);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
