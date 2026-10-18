const { DatabaseSync, backup } = require("node:sqlite");
const path = require("node:path");
const fs = require("node:fs");
(async () => {
  if (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.VERCEL
  )
    throw Error(
      "PostgreSQL requires provider backups or pg_dump; this command only backs up SQLite",
    );
  const source =
    process.env.DB_PATH || path.join(__dirname, "../data/school.db");
  const target = process.argv[2];
  if (!target) throw Error("Usage: npm run backup -- /secure/path/backup.db");
  if (fs.existsSync(target))
    throw Error("Refusing to overwrite existing backup");
  fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    await backup(db, target);
    console.log("Backup completed");
  } finally {
    db.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
