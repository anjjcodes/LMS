# License Management System (LMS)

B2B license pools: admins assign/revoke seats within a purchased capacity and date window; a SaaS app verifies whether an employee holds an active license.

**Stack:** React + TypeScript + Vite (MUI, React Router, TanStack Query) · Node.js + Express 5 + TypeScript (raw `pg`) · PostgreSQL 16 (Docker Compose) · npm workspaces.

## Run it

Prerequisites: Node 20+, Docker Desktop running.

```bash
npm install
cp backend/.env.example backend/.env   # then set JWT_SECRET to a random 32+ char string
npm run db:up        # Postgres 16 on :5432 (also creates lms_test)
npm run db:migrate   # apply SQL migrations
npm run db:seed      # demo tenants, admins, API key, pools
npm run dev          # API on :4000, web on http://localhost:5173
```

| Login | Password | Role |
|---|---|---|
| admin@lms.com | Admin@12345 | ORG_ADMIN (Acme) |
| viewer@acme.com | Viewer@12345 | ORG_VIEWER (Acme, read-only) |
| admin@globex.com | Admin@12345 | ORG_ADMIN (second tenant) |

SaaS API key for Acme: `SEED_API_KEY` in `backend/.env` (use it on the **Verify** page or as `X-API-Key`).

## Verify end-to-end

With `npm run dev` running:

```bash
npm run smoke    # 26 checks incl. 20 concurrent admins racing for the last 2 seats
```

Other scripts: `npm run typecheck`, `npm run build`, `npm run db:reset` (wipe + migrate + seed).

## Layout

```
shared/    error-code catalog + API DTO types (used by both apps)
backend/   db/migrations (SQL), db/seed.ts, src/{config,db,middleware,modules/{auth,pools,seats,audit,verify}}
frontend/  src/{api,auth,components,pages}
scripts/   smoke.mjs (E2E against a running stack)
```

## API

| Method | Path | Auth |
|---|---|---|
| POST | /api/v1/auth/login | public |
| POST / GET | /api/v1/pools | JWT (create: ORG_ADMIN) |
| GET | /api/v1/pools/:poolId | JWT |
| POST / GET | /api/v1/pools/:poolId/seats | JWT (assign: ORG_ADMIN) |
| POST | /api/v1/pools/:poolId/seats/:seatId/revoke | JWT · ORG_ADMIN |
| GET | /api/v1/pools/:poolId/audit | JWT |
| POST | /api/v1/licenses/verify | X-API-Key |
| GET | /health/live, /health/ready | public |
