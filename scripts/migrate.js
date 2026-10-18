const { Pool } = require("pg");
const fs = require("node:fs");
const path = require("node:path");
async function migrate(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('kawila-schema-v1'))",
    );
    await client.query(
      fs.readFileSync(path.join(__dirname, "schema.postgres.sql"), "utf8"),
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
if (require.main === module) {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.error("Set DATABASE_URL securely before running db:migrate");
    process.exitCode = 1;
  } else {
    const pool = new Pool({
      connectionString: url,
      connectionTimeoutMillis: 10000,
      max: 1,
    });
    migrate(pool)
      .then(() => console.log("PostgreSQL schema ready"))
      .catch((e) => {
        console.error("Migration failed:", e.code || e.name);
        process.exitCode = 1;
      })
      .finally(() => pool.end());
  }
}
module.exports = { migrate };
