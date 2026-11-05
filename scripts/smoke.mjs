// End-to-end smoke test against a RUNNING stack (API + seeded DB). Includes a live race for the last seats.
// Usage: node scripts/smoke.mjs <SAAS_API_KEY> [baseUrl]
const BASE = process.argv[3] ?? 'http://localhost:4000';
const API_KEY = process.argv[2];
const RUN = Date.now();
let ok = 0, fail = 0;
const check = (name, cond, extra = '') => { cond ? ok++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${cond ? '' : extra}`); };

async function call(method, path, { token, key, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  if (key) headers['x-api-key'] = key;
  const r = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
}
const login = async (email, password) => (await call('POST', '/api/v1/auth/login', { body: { email, password } })).body.accessToken;

const ready = await call('GET', '/health/ready');
check('health ready', ready.status === 200);

const badLogin = await call('POST', '/api/v1/auth/login', { body: { email: 'admin@lms.com', password: 'nope' } });
check('bad login 401', badLogin.status === 401 && badLogin.body.error.code === 'INVALID_CREDENTIALS');

const admin = await login('admin@lms.com', 'Admin@12345');
const viewer = await login('viewer@acme.com', 'Viewer@12345');
const globex = await login('admin@globex.com', 'Admin@12345');
check('logins ok', admin && viewer && globex);

check('no token 401', (await call('GET', '/api/v1/pools')).status === 401);

const today = new Date().toISOString().slice(0, 10);
const nextYear = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
const created = await call('POST', '/api/v1/pools', { token: admin, body: { name: `Smoke ${Date.now()}`, capacity: 3, startDate: today, endDate: nextYear } });
check('create pool 201', created.status === 201, JSON.stringify(created.body));
const poolId = created.body.id;

const bad = await call('POST', '/api/v1/pools', { token: admin, body: { name: 'x', capacity: 0, startDate: '2026-02-30', endDate: today, extra: 1 } });
check('invalid pool 400', bad.status === 400 && bad.body.error.code === 'VALIDATION_ERROR', JSON.stringify(bad.body));

check('viewer cannot create 403', (await call('POST', '/api/v1/pools', { token: viewer, body: { name: 'v', capacity: 1, startDate: today, endDate: nextYear } })).status === 403);
check('cross-tenant 404', (await call('GET', `/api/v1/pools/${poolId}`, { token: globex })).status === 404);

const a1 = await call('POST', `/api/v1/pools/${poolId}/seats`, { token: admin, body: { email: `  Ravi.Kumar.${RUN}@Acme.com ` } });
check('assign 201 + normalized', a1.status === 201 && a1.body.employeeEmail === `ravi.kumar.${RUN}@acme.com`, JSON.stringify(a1.body));
const dup = await call('POST', `/api/v1/pools/${poolId}/seats`, { token: admin, body: { email: `ravi.kumar.${RUN}@acme.com` } });
check('duplicate 409', dup.status === 409 && dup.body.error.code === 'SEAT_ALREADY_ASSIGNED', JSON.stringify(dup.body));

const v1 = await call('POST', '/api/v1/licenses/verify', { key: API_KEY, body: { email: `RAVI.KUMAR.${RUN}@acme.com` } });
check('verify licensed', v1.status === 200 && v1.body.licensed === true, JSON.stringify(v1.body));
const v2 = await call('POST', '/api/v1/licenses/verify', { key: API_KEY, body: { email: 'nobody@acme.com' } });
check('verify unknown → 200 false', v2.status === 200 && v2.body.licensed === false);
check('verify bad key 401', (await call('POST', '/api/v1/licenses/verify', { key: 'lms_live_bogus', body: { email: 'a@b.com' } })).status === 401);
check('verify rejects admin JWT', (await call('POST', '/api/v1/licenses/verify', { token: admin, body: { email: 'a@b.com' } })).status === 401);

// ── Race: 1 seat already used of 3 → 20 admins race for the remaining 2 ──
const race = await Promise.all(Array.from({ length: 20 }, (_, i) =>
  call('POST', `/api/v1/pools/${poolId}/seats`, { token: admin, body: { email: `racer${i}.${RUN}@acme.com` } })));
const wins = race.filter((r) => r.status === 201).length;
const full = race.filter((r) => r.status === 409 && r.body.error.code === 'POOL_FULL').length;
check(`race: exactly 2 winners (got ${wins}), 18 POOL_FULL (got ${full})`, wins === 2 && full === 18);
const after = await call('GET', `/api/v1/pools/${poolId}`, { token: admin });
check('pool shows 3/3', after.body.activeSeats === 3 && after.body.availableSeats === 0, JSON.stringify(after.body));

// ── Revoke + concurrent double revoke ──
const revokes = await Promise.all([0, 1, 2].map(() =>
  call('POST', `/api/v1/pools/${poolId}/seats/${a1.body.id}/revoke`, { token: admin, body: { reason: 'left company' } })));
check('concurrent revoke: one 200, rest SEAT_NOT_ACTIVE',
  revokes.filter((r) => r.status === 200).length === 1 && revokes.filter((r) => r.body.error?.code === 'SEAT_NOT_ACTIVE').length === 2);
const v3 = await call('POST', '/api/v1/licenses/verify', { key: API_KEY, body: { email: `ravi.kumar.${RUN}@acme.com` } });
check('verify after revoke → false', v3.body.licensed === false);
const re = await call('POST', `/api/v1/pools/${poolId}/seats`, { token: admin, body: { email: `ravi.kumar.${RUN}@acme.com` } });
check('reassign after revoke 201', re.status === 201 && re.body.pool.activeSeats === 3);

const seats = await call('GET', `/api/v1/pools/${poolId}/seats?limit=2`, { token: viewer });
check('list seats paginated', seats.status === 200 && seats.body.data.length === 2 && seats.body.nextCursor);
const seats2 = await call('GET', `/api/v1/pools/${poolId}/seats?limit=2&cursor=${seats.body.nextCursor}`, { token: viewer });
check('page 2 no overlap', seats2.status === 200 && !seats2.body.data.some((s) => seats.body.data.find((x) => x.id === s.id)));

const audit = await call('GET', `/api/v1/pools/${poolId}/audit?limit=100`, { token: viewer });
const actions = audit.body.data.map((a) => a.action);
check('audit: 1 create, 4 assigns, 1 revoke', actions.filter((a) => a === 'POOL_CREATED').length === 1 &&
  actions.filter((a) => a === 'SEAT_ASSIGNED').length === 4 && actions.filter((a) => a === 'SEAT_REVOKED').length === 1, JSON.stringify(actions));
check('audit actor recorded', audit.body.data.every((a) => a.actor.email === 'admin@lms.com'));

// ── Not-yet-started pool (seeded) → 422 ──
const pools = await call('GET', '/api/v1/pools?status=SCHEDULED', { token: admin });
const sched = pools.body.data[0];
const ns = await call('POST', `/api/v1/pools/${sched.id}/seats`, { token: admin, body: { email: 'x@acme.com' } });
check('scheduled pool → 422 POOL_NOT_ACTIVE', ns.status === 422 && ns.body.error.details.reason === 'NOT_STARTED', JSON.stringify(ns.body));

check('unknown route 404', (await call('GET', '/api/v1/nope', { token: admin })).status === 404);
const notJson = await fetch(BASE + '/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'hi' });
check('non-JSON 415', notJson.status === 415);

console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
