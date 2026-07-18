const fs = require('fs');
const path = require('path');
const { db } = require('../config/db');

const migrationsDir = __dirname;

const splitStatements = (sql) => sql
  .replace(/^\uFEFF/, '')
  .split(/;\s*(?:\r?\n|$)/)
  .map((statement) => statement.trim())
  .filter((statement) => statement && !statement.split(/\r?\n/).every((line) => line.trim().startsWith('--')));

async function migrate() {
  await db.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  const files = fs.readdirSync(migrationsDir)
    .filter((file) => /^\d{8}_.+\.sql$/.test(file))
    .sort();

  for (const file of files) {
    const [applied] = await db.query('SELECT 1 FROM schema_migrations WHERE migration_name = ? LIMIT 1', [file]);
    if (applied.length) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    for (const statement of splitStatements(sql)) {
      try {
        await db.query(statement);
      } catch (error) {
        // Allows an interrupted ALTER migration to be safely re-run.
        if (error.code !== 'ER_DUP_FIELDNAME') throw error;
      }
    }
    await db.query('INSERT INTO schema_migrations (migration_name) VALUES (?)', [file]);
    console.log(`Applied migration: ${file}`);
  }
}

migrate()
  .then(async () => { await db.end(); })
  .catch(async (error) => {
    console.error('Database migration failed:', error.message);
    await db.end();
    process.exitCode = 1;
  });
