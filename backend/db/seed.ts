/**
 * Idempotent development seed. Safe to re-run.
 *   Acme Corp   — admin@lms.com / Admin@12345 (ORG_ADMIN), viewer@acme.com / Viewer@12345 (ORG_VIEWER)
 *                 SaaS API key = $SEED_API_KEY
 *   Globex Inc  — admin@globex.com / Admin@12345 (second tenant, for isolation demos)
 */
import pg from 'pg';
import { hashApiKey, hashPassword } from '../src/lib/crypto';

const url = process.env.DATABASE_URL;
const apiKey = process.env.SEED_API_KEY;
if (!url || !apiKey) {
  console.error('DATABASE_URL and SEED_API_KEY must be set');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, options: '-c timezone=UTC' });

async function upsertOrg(name: string): Promise<string> {
  const found = await client.query<{ id: string }>('SELECT id FROM organizations WHERE name = $1', [name]);
  if (found.rows[0]) return found.rows[0].id;
  const { rows } = await client.query<{ id: string }>('INSERT INTO organizations (name) VALUES ($1) RETURNING id', [name]);
  return rows[0]!.id;
}

async function upsertAdmin(orgId: string, email: string, fullName: string, password: string, role: string) {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO admins (organization_id, email, full_name, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING id`,
    [orgId, email, fullName, await hashPassword(password), role],
  );
  return rows[0]!.id;
}

async function ensurePool(orgId: string, adminId: string, name: string, capacity: number, startOffset: number, endOffset: number) {
  const exists = await client.query('SELECT 1 FROM license_pools WHERE organization_id = $1 AND name = $2', [orgId, name]);
  if (exists.rowCount) return;
  await client.query('BEGIN');
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO license_pools (organization_id, name, capacity, start_date, end_date, created_by)
     VALUES ($1, $2, $3, CURRENT_DATE + $4::int, CURRENT_DATE + $5::int, $6) RETURNING id`,
    [orgId, name, capacity, startOffset, endOffset, adminId],
  );
  await client.query(
    `INSERT INTO audit_log (pool_id, action, actor_admin_id, metadata) VALUES ($1, 'POOL_CREATED', $2, $3)`,
    [rows[0]!.id, adminId, { name, capacity, seeded: true }],
  );
  await client.query('COMMIT');
}

async function main() {
  await client.connect();
  const acme = await upsertOrg('Acme Corp');
  const globex = await upsertOrg('Globex Inc');

  const acmeAdmin = await upsertAdmin(acme, 'admin@lms.com', 'Asha Kumar', 'Admin@12345', 'ORG_ADMIN');
  await upsertAdmin(acme, 'viewer@acme.com', 'Vikram Rao', 'Viewer@12345', 'ORG_VIEWER');
  const globexAdmin = await upsertAdmin(globex, 'admin@globex.com', 'Grace Lee', 'Admin@12345', 'ORG_ADMIN');

  await client.query(
    `INSERT INTO api_clients (organization_id, name, key_hash) VALUES ($1, 'Acme SaaS App', $2)
     ON CONFLICT (key_hash) DO NOTHING`,
    [acme, hashApiKey(apiKey!)],
  );

  await ensurePool(acme, acmeAdmin, 'Engineering FY27', 5, -30, 335);
  await ensurePool(acme, acmeAdmin, 'Design Team (starts next month)', 3, 30, 395);
  await ensurePool(globex, globexAdmin, 'Globex Platform', 10, -10, 355);

  console.log('[seed] done');
  console.log('  Admin   : admin@lms.com   / Admin@12345');
  console.log('  Viewer  : viewer@acme.com / Viewer@12345');
  console.log('  Tenant 2: admin@globex.com / Admin@12345');
  console.log('  SaaS API key (Acme): $SEED_API_KEY from backend/.env');
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
