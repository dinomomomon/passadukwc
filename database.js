const fs = require("node:fs");
const path = require("node:path");
const { AsyncLocalStorage } = require("node:async_hooks");
const camel = {
  vendoraddress: "vendorAddress",
  createdby: "createdBy",
  createdat: "createdAt",
  updatedat: "updatedAt",
  userid: "userId",
  recordid: "recordId",
};
function normalize(row) {
  if (!row) return row;
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [camel[k] || k, v]),
  );
}
function postgresSQL(sql) {
  let index = 0;
  return sql
    .replace(
      /\b(FROM|JOIN|UPDATE|INTO)\s+(users|settings|counters|records|audit|sessions|login_limits)\b/gi,
      "$1 kawila.$2",
    )
    .replace(/\?/g, () => "$" + ++index)
    .replace(
      /json_extract\(data,'\$\.uid'\)/g,
      "(data::jsonb->>'uid')::integer",
    )
    .replace(
      /max\(value,excluded.value\)/g,
      "greatest(counters.value,excluded.value)",
    );
}
function secureConnectionString(value) {
  const url = new URL(value);
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) {
    url.searchParams.set("sslmode", "verify-full");
    url.searchParams.delete("uselibpqcompat");
    url.searchParams.delete("ssl");
    if (
      (url.hostname.endsWith(".pooler.supabase.com") ||
        url.hostname.endsWith(".supabase.co")) &&
      !url.searchParams.has("sslrootcert")
    ) {
      url.searchParams.set(
        "sslrootcert",
        path.join(__dirname, "certs/supabase-prod-ca-2021.crt"),
      );
    }
  }
  return url.toString();
}
function createDatabase({ dbPath, databaseUrl, driver } = {}) {
  const pg = !!(databaseUrl || driver);
  if (process.env.VERCEL && !pg)
    throw Error("DATABASE_URL is required on Vercel; SQLite is not persistent");
  const local = new AsyncLocalStorage();
  let queue = Promise.resolve();
  let raw, pool;
  if (pg) {
    pool =
      driver ||
      new (require("pg").Pool)({
        connectionString: secureConnectionString(databaseUrl),
        max: 3,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000,
        allowExitOnIdle: true,
      });
    pool.on?.("error", (e) =>
      console.error("Database pool:", e.code || e.name),
    );
  } else {
    if (dbPath !== ":memory:")
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    raw = new (require("node:sqlite").DatabaseSync)(dbPath);
    raw.exec(
      "PRAGMA journal_mode=WAL;PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000;",
    );
    raw.exec(
      fs.readFileSync(
        path.join(__dirname, "scripts/schema.sqlite.sql"),
        "utf8",
      ),
    );
  }
  function serial(fn) {
    if (local.getStore()) return Promise.resolve().then(fn);
    const result = queue.then(fn);
    queue = result.catch(() => {});
    return result;
  }
  async function query(sql, args = []) {
    if (pg)
      return (
        await (local.getStore() || pool).query(postgresSQL(sql), args)
      ).rows.map(normalize);
    return serial(() => {
      const statement = raw.prepare(sql);
      return /^(SELECT|WITH)|RETURNING /i.test(sql)
        ? statement.all(...args)
        : [statement.run(...args)];
    });
  }
  const api = {
    raw,
    ready: Promise.resolve(),
    prepare(sql) {
      return {
        get: async (...args) => (await query(sql, args))[0],
        all: (...args) => query(sql, args),
        run: async (...args) => (await query(sql, args))[0],
      };
    },
    async lock(key) {
      if (pg) {
        if (!local.getStore()) throw Error("Lock requires transaction");
        await local
          .getStore()
          .query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);
      }
    },
    async nextNumber(kind, year, requested) {
      await api.lock("counter:" + kind + ":" + year);
      const counter = await api
        .prepare("SELECT value FROM counters WHERE kind=? AND year=?")
        .get(kind, year);
      const n = requested || (counter?.value || 0) + 1;
      if (n > 9999999) throw Error("เลขเอกสารเกินขอบเขตที่รองรับ");
      await api
        .prepare(
          "INSERT INTO counters VALUES(?,?,?) ON CONFLICT(kind,year) DO UPDATE SET value=max(value,excluded.value)",
        )
        .run(kind, year, n);
      return n;
    },
    async transaction(fn) {
      if (local.getStore()) throw Error("Nested transactions unsupported");
      if (pg) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await local.run(client, fn);
          await client.query("COMMIT");
          return result;
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        } finally {
          client.release();
        }
      }
      return serial(async () => {
        raw.exec("BEGIN IMMEDIATE");
        try {
          const result = await local.run(true, fn);
          raw.exec("COMMIT");
          return result;
        } catch (e) {
          raw.exec("ROLLBACK");
          throw e;
        }
      });
    },
    rateLimitOptions() {
      if (!pg) return {};
      return {
        store: {
          localKeys: false,
          prefix: "auth",
          init(options) {
            this.windowMs = options.windowMs;
          },
          async increment(key) {
            const now = Date.now(),
              expires = now + this.windowMs;
            const result = await pool.query(
              `INSERT INTO kawila.login_limits(key,hits,expires) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN login_limits.expires<=$3 THEN 1 ELSE login_limits.hits+1 END,expires=CASE WHEN login_limits.expires<=$3 THEN $2 ELSE login_limits.expires END RETURNING hits,expires`,
              [key, expires, now],
            );
            const row = result.rows[0];
            return {
              totalHits: row.hits,
              resetTime: new Date(Number(row.expires)),
            };
          },
          async decrement(key) {
            await pool.query(
              "UPDATE kawila.login_limits SET hits=greatest(0,hits-1) WHERE key=$1",
              [key],
            );
          },
          async resetKey(key) {
            await pool.query("DELETE FROM kawila.login_limits WHERE key=$1", [
              key,
            ]);
          },
        },
      };
    },
    async close() {
      if (pg) await pool.end();
      else raw.close();
    },
  };
  return api;
}
module.exports = { createDatabase, postgresSQL, secureConnectionString };
