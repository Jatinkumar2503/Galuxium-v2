import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

if (process.argv.length > 2) {
  console.warn('[local-ci-replay] Notice: Command-line arguments are intentionally ignored to prevent passwords leaking into shell history.');
  console.warn('[local-ci-replay] Set PGPASSWORD environment variable or enter it at the prompt.\n');
}

async function getPassword() {
  if (process.env.PGPASSWORD) {
    return process.env.PGPASSWORD;
  }
  if (!process.stdin.isTTY) {
    return 'postgres';
  }
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Enter password for postgres user [default: postgres]: ', (answer) => {
      rl.close();
      resolve(answer.trim() || 'postgres');
    });
  });
}

const pgUser = process.env.PGUSER || 'postgres';
const pgPassword = await getPassword();
const pgHost = process.env.PGHOST || 'localhost';
const pgPort = process.env.PGPORT || '5432';
const dbName = 'ci_scratch';

if (pgHost !== 'localhost' && pgHost !== '127.0.0.1') {
  console.error(`[local-ci-replay] SAFETY ABORT: Replay script is strictly restricted to localhost. Refusing host: ${pgHost}`);
  process.exit(1);
}

if (dbName !== 'ci_scratch') {
  console.error(`[local-ci-replay] SAFETY ABORT: Target database must be 'ci_scratch'. Refusing database: ${dbName}`);
  process.exit(1);
}

console.log(`[local-ci-replay] Connecting to local PostgreSQL at ${pgHost}:${pgPort} as ${pgUser}...`);

const psqlBaseArgs = ['-h', pgHost, '-p', pgPort, '-U', pgUser, '-v', 'ON_ERROR_STOP=1'];
const env = { ...process.env, PGPASSWORD: pgPassword };

function runPsql(args, desc) {
  console.log(`[local-ci-replay] ${desc}...`);
  try {
    execFileSync('psql', args, { env, stdio: 'inherit' });
  } catch (err) {
    console.error(`[local-ci-replay] ERROR during: ${desc}`);
    process.exit(1);
  }
}

// 1. Drop and recreate ci_scratch
runPsql([...psqlBaseArgs, '-d', 'postgres', '-c', `DROP DATABASE IF EXISTS ${dbName}; CREATE DATABASE ${dbName};`], 'Drop & Recreate Database');

// 2. Run ci/auth_stub.sql
runPsql([...psqlBaseArgs, '-d', dbName, '-f', 'ci/auth_stub.sql'], 'Execute ci/auth_stub.sql');

// 3. Run all migrations in alphanumeric filename order
const migrationsDir = path.resolve('supabase/migrations');
const migrationFiles = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

for (const file of migrationFiles) {
  const filePath = path.join(migrationsDir, file);
  runPsql([...psqlBaseArgs, '-d', dbName, '-f', filePath], `Execute migration: ${file}`);
}

// 4. Run supabase/seed.sql
runPsql([...psqlBaseArgs, '-d', dbName, '-f', 'supabase/seed.sql'], 'Execute supabase/seed.sql');

console.log('\n[local-ci-replay] Database schema & seed successfully applied with ON_ERROR_STOP=1!');
console.log('[local-ci-replay] Running test suite against local ci_scratch database...\n');

// 5. Run npm test with CI=true and DATABASE_URL
const databaseUrl = `postgresql://${pgUser}:${encodeURIComponent(pgPassword)}@${pgHost}:${pgPort}/${dbName}`;
try {
  execFileSync('npm', ['test'], {
    env: {
      ...process.env,
      CI: 'true',
      DATABASE_URL: databaseUrl,
    },
    stdio: 'inherit',
  });
  console.log('\n[local-ci-replay] All tests PASSED against real PostgreSQL!');
} catch (err) {
  console.error('\n[local-ci-replay] Test suite failed against real PostgreSQL.');
  process.exit(1);
}
