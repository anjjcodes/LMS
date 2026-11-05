import { runMigrations } from '../src/db/migrator';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

runMigrations(url, (m) => console.log(`[migrate] ${m}`))
  .then(() => console.log('[migrate] database is up to date'))
  .catch((err) => {
    console.error(`[migrate] ${err.message}`);
    process.exit(1);
  });
