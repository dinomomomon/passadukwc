const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { randomBytes } = require("node:crypto");
const { Pool } = require("pg");
const { createApp } = require("../application");
const { migrate } = require("../scripts/migrate");
test("PostgreSQL: multiple instances share sessions and safely allocate/edit numbers", async (t) => {
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  const root = await mkdtemp(path.join(os.tmpdir(), "kawila-pg-"));
  const probe = net.createServer();
  probe.listen(0, "127.0.0.1");
  await new Promise((r) => probe.once("listening", r));
  const port = probe.address().port;
  await new Promise((r) => probe.close(r));
  const password = randomBytes(24).toString("hex");
  const cluster = new EmbeddedPostgres({
    databaseDir: path.join(root, "db"),
    port,
    user: "postgres",
    password,
    persistent: false,
    initdbFlags: ["--locale=C", "--encoding=UTF8"],
    postgresFlags: ["-h", "127.0.0.1"],
    onLog: () => {},
    onError: () => {},
  });
  let started = false;
  const instances = [],
    servers = [],
    connectionEnds = [];
  let inspection;
  t.after(async () => {
    for (const s of servers) await new Promise((r) => s.close(r));
    for (const i of instances) await i.close();
    if (inspection) await inspection.end();
    await Promise.all(connectionEnds);
    if (started) await cluster.stop();
    await rm(root, { recursive: true, force: true });
  });
  await cluster.initialise();
  await cluster.start();
  started = true;
  const config = {
    host: "127.0.0.1",
    port,
    user: "postgres",
    password,
    database: "postgres",
    options: "-c search_path=kawila",
    max: 4,
  };
  const makePool = () => {
    const pool = new Pool(config);
    pool.on("connect", (client) =>
      connectionEnds.push(
        new Promise((resolve) => client.once("end", resolve)),
      ),
    );
    return pool;
  };
  inspection = makePool();
  await migrate(inspection);
  await migrate(inspection);
  for (let i = 0; i < 2; i++) {
    const instance = createApp({
      driver: makePool(),
      secret: "same-long-session-secret-for-both-instances",
    });
    instances.push(instance);
    const server = instance.app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    servers.push(server);
  }
  let cookie = "",
    csrf = "",
    index = 0;
  async function request(url, data) {
    const base = "http://127.0.0.1:" + servers[index++ % 2].address().port;
    const res = await fetch(base + url, {
      method: data ? "POST" : "GET",
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(data
          ? { "content-type": "application/x-www-form-urlencoded" }
          : {}),
      },
      body: data ? new URLSearchParams({ _csrf: csrf, ...data }) : undefined,
      redirect: "manual",
    });
    if (res.headers.get("set-cookie"))
      cookie = res.headers.get("set-cookie").split(";")[0];
    const html = await res.text();
    const match = html.match(/name="_csrf" value="([^"]+)"/);
    if (match) csrf = match[1];
    return { status: res.status, location: res.headers.get("location"), html };
  }
  const first = await request("/setup");
  assert.equal(first.status, 200);
  assert.equal(
    (
      await request("/setup", {
        name: "ผู้ดูแล",
        username: "admin",
        password: "good-password-123",
      })
    ).status,
    302,
  );
  await request("/login");
  assert.equal(
    (
      await request("/login", {
        username: "admin",
        password: "good-password-123",
      })
    ).status,
    302,
  );
  assert.equal((await request("/")).status, 200);
  assert.equal((await request("/admin")).status, 200);
  assert.equal(
    (
      await request("/admin/settings", {
        school: "กาวิละวิทยาลัย",
        head: "หัวหน้า",
        director: "ผู้อำนวยการ",
        officer: "เจ้าหน้าที่",
      })
    ).status,
    302,
  );
  const data = {
    kind: "purchase",
    year: "2570",
    title: "กระดาษ",
    date: "2026-10-18",
    reason: "การเรียน",
    vendor: "ร้านค้า",
    vendorAddress: "เชียงใหม่",
    budget: "อุดหนุน",
    method: "ร่าง",
    itemName: "กระดาษ",
    qty: "1",
    unit: "รีม",
    price: "100.50",
  };
  const results = await Promise.all(
    Array.from({ length: 12 }, () => request("/records", data)),
  );
  assert.ok(
    results.every((r) => r.status === 302),
    JSON.stringify(
      results.map((r) => ({ status: r.status, html: r.html.slice(0, 200) })),
    ),
  );
  assert.deepEqual(
    (
      await inspection.query("SELECT number FROM records ORDER BY number")
    ).rows.map((r) => r.number),
    Array.from({ length: 12 }, (_, i) => i + 1),
  );
  assert.equal(
    (await request("/records", { ...data, number: "1" })).status,
    400,
  );
  assert.equal(
    (await request("/records", { ...data, kind: "hire" })).status,
    302,
  );
  assert.equal(
    (await inspection.query("SELECT number FROM records WHERE kind='hire'"))
      .rows[0].number,
    1,
  );
  const record = (
    await inspection.query(
      "SELECT * FROM records WHERE kind='purchase' ORDER BY id LIMIT 1",
    )
  ).rows[0];
  const version = record.updatedat;
  const edits = await Promise.all(
    [20, 21].map((number) =>
      request("/records/" + record.id, {
        ...data,
        number: String(number),
        version,
      }),
    ),
  );
  assert.deepEqual(edits.map((r) => r.status).sort(), [302, 400]);
  assert.equal(
    (await inspection.query("SELECT count(*) FROM audit WHERE action='edit'"))
      .rows[0].count,
    "1",
  );
  assert.equal((await request("/records/" + record.id + "/edit")).status, 200);
  const printed = await request("/records/" + record.id + "/print");
  assert.equal(printed.status, 200);
  assert.ok(printed.html.includes("เชียงใหม่"));
  assert.ok(printed.html.includes("ฉบับร่าง"));
  await request("/records", data);
  const counter = (
    await inspection.query("SELECT value FROM counters WHERE kind='purchase'")
  ).rows[0].value;
  assert.ok(counter >= 21);
  // Another warm instance with the same database and secret must accept the existing session.
  const replacement = createApp({
    driver: makePool(),
    secret: "same-long-session-secret-for-both-instances",
  });
  instances.push(replacement);
  const replacementServer = replacement.app.listen(0, "127.0.0.1");
  await new Promise((r) => replacementServer.once("listening", r));
  servers.push(replacementServer);
  assert.equal(
    (
      await fetch(
        "http://127.0.0.1:" + replacementServer.address().port + "/admin",
        { headers: { cookie }, redirect: "manual" },
      )
    ).status,
    200,
  );
  await request("/account");
  assert.equal(
    (
      await request("/password", {
        current: "good-password-123",
        password: "replacement-password-123",
      })
    ).status,
    302,
  );
  assert.equal((await request("/")).location, "/login");
});
