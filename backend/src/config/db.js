const { Pool, types } = require('pg');
const path = require('path');
const { translate, loadMetadata } = require('./postgresDialect');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Preserve mysql2's numeric boolean and count return values for API compatibility.
types.setTypeParser(16, value => value === 't' ? 1 : 0);
types.setTypeParser(20, value => {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : value;
});
types.setTypeParser(1082, value => value);

// Timestamps are "timestamp without time zone", stored as local wall-clock time
// exactly as MySQL did (mysql2's default "local" timezone). node-postgres reads
// them as the Node process's local time, so the session must use the same zone:
// with UTC, NOW() and inserted dates were stored 5h30 behind and read back wrong.
// DB_TIMEZONE pins it explicitly (an IANA name such as Asia/Colombo).
const DB_TIMEZONE = process.env.DB_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
if (!/^[A-Za-z0-9_+\-/]+$/.test(DB_TIMEZONE)) throw new Error(`Invalid DB_TIMEZONE: ${DB_TIMEZONE}`);
const processTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
if (process.env.DB_TIMEZONE && processTimezone && process.env.DB_TIMEZONE !== processTimezone) {
  console.warn(`DB_TIMEZONE (${process.env.DB_TIMEZONE}) differs from the server timezone (${processTimezone}). Timestamps will be read with the server timezone; set TZ=${process.env.DB_TIMEZONE} for the Node process as well.`);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DATABASE_URL ? undefined : (process.env.DB_HOST || '127.0.0.1'),
  port: process.env.DATABASE_URL ? undefined : Number(process.env.DB_PORT || 5432),
  user: process.env.DATABASE_URL ? undefined : process.env.DB_USER,
  password: process.env.DATABASE_URL ? undefined : process.env.DB_PASSWORD,
  database: process.env.DATABASE_URL ? undefined : process.env.DB_NAME,
  max: Number(process.env.DB_POOL_SIZE || 10),
  application_name: 'audito_backend',
  options: `-c timezone=${DB_TIMEZONE}`,
});

async function run(client, sql, params = []) {
  const converted = translate(sql, params, await loadMetadata(client));
  const result = await client.query(converted.text, converted.values);
  if (result.command === 'SELECT' || result.command === 'SHOW') return [result.rows, result.fields];
  return [{ affectedRows: result.rowCount || 0, changedRows: result.rowCount || 0,
    insertId: converted.isInsert ? result.rows[0]?.id || 0 : 0 }, result.fields];
}

function wrapClient(client) {
  let transactionOpen = false;
  return {
    query(sql, params) { return run(client, sql, params); },
    execute(sql, params) { return run(client, sql, params); },
    async beginTransaction() { await client.query('BEGIN'); transactionOpen = true; },
    async commit() { await client.query('COMMIT'); transactionOpen = false; },
    async rollback() { try { await client.query('ROLLBACK'); } finally { transactionOpen = false; } },
    release(force = false) { client.release(force || transactionOpen); },
  };
}

const db = {
  query(sql, params) { return run(pool, sql, params); },
  execute(sql, params) { return run(pool, sql, params); },
  async getConnection() { return wrapClient(await pool.connect()); },
  end() { return pool.end(); },
};

const connectDB = async () => {
  try {
    const connection = await db.getConnection();
    try {
      await connection.query('SELECT 1');
      const [access] = await connection.query("SELECT has_table_privilege(current_user, 'public.admins', 'SELECT') AS can_read_admins");
      if (!access[0]?.can_read_admins) {
        throw new Error('Database role cannot read public.admins. Grant the application role SELECT on public.admins as the database owner, then run npm run db:access.');
      }
    }
    finally { connection.release(); }
    console.log(`PostgreSQL Database Connected: ${process.env.DB_NAME || 'DATABASE_URL'}`);
  } catch (error) {
    console.error('PostgreSQL connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = { db, connectDB };
