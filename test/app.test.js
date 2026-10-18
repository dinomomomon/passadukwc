const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../server");
test("workflow: security, roles, central numbers, editing, printing and session revocation", async (t) => {
  const { app, db } = createApp({
    dbPath: ":memory:",
    secret: "test-session-secret-32-characters-minimum",
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(() => {
    server.close();
    db.close();
  });
  const base = "http://127.0.0.1:" + server.address().port;
  function client() {
    let cookie = "",
      csrf = "";
    return async (url, data) => {
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
      return {
        status: res.status,
        location: res.headers.get("location"),
        html,
      };
    };
  }
  const a = client();
  assert.equal((await a("/")).location, "/setup");
  assert.equal((await a("/setup")).status, 200);
  assert.equal(
    (
      await a("/setup", {
        name: "ผู้ดูแล",
        username: "admin",
        password: "good-password-123",
      })
    ).status,
    302,
  );
  await a("/login");
  assert.equal(
    (await a("/login", { username: "admin", password: "wrong" })).status,
    401,
  );
  assert.equal(
    (await a("/login", { username: "admin", password: "good-password-123" }))
      .status,
    302,
  );
  assert.equal((await a("/")).status, 200);
  await a("/admin");
  assert.equal(
    (
      await a("/admin/settings", {
        school: "โรงเรียนกาวิละวิทยาลัย",
        head: "หัวหน้าเดิม",
        director: "ผู้อำนวยการเดิม",
        officer: "เจ้าหน้าที่",
      })
    ).status,
    302,
  );
  for (let i = 1; i <= 3; i++)
    assert.equal(
      (
        await a("/admin/users", {
          name: "เจ้าหน้าที่ " + i,
          username: "staff" + i,
          password: "staff-password-123",
          role: "staff",
        })
      ).status,
      302,
    );
  const b = client();
  await b("/login");
  await b("/login", { username: "staff1", password: "staff-password-123" });
  await b("/");
  assert.equal((await b("/admin")).status, 403);
  assert.equal((await b("/records/new")).status, 200);
  const data = {
    kind: "purchase",
    year: "2570",
    title: "ซื้อกระดาษ <script>alert(1)</script>",
    date: "2026-10-18",
    reason: "ใช้ในการเรียน",
    vendor: "ร้านทดสอบ",
    vendorAddress: "เชียงใหม่",
    budget: "เงินอุดหนุน",
    method: "รอตรวจสอบฐานระเบียบ",
    itemName: "กระดาษ",
    qty: "2",
    unit: "รีม",
    price: "100.50",
  };
  assert.equal((await b("/records", { ...data, _csrf: "bad" })).status, 403);
  assert.equal((await b("/records", { ...data, price: "3000" })).status, 400);
  assert.equal((await b("/records", { ...data, qty: "1.5" })).status, 400);
  const results = await Promise.all(
    Array.from({ length: 8 }, () => b("/records", data)),
  );
  assert.ok(results.every((r) => r.status === 302));
  const numbers = db
    .prepare("SELECT number FROM records WHERE kind='purchase' ORDER BY number")
    .all()
    .map((r) => r.number);
  assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal((await b("/records", { ...data, number: "1" })).status, 400);
  assert.equal(
    db.prepare("SELECT value FROM counters WHERE kind='purchase'").get().value,
    8,
  );
  await b("/records", { ...data, kind: "hire" });
  assert.equal(
    db.prepare("SELECT number FROM records WHERE kind='hire'").get().number,
    1,
  );
  const detail = await b("/records/1");
  assert.equal(detail.status, 200);
  assert.ok(detail.html.includes("&lt;script&gt;"));
  assert.ok(!detail.html.includes("<script>alert"));
  let old = db.prepare("SELECT * FROM records WHERE id=1").get();
  await b("/records/1/edit");
  assert.equal(
    (await b("/records/1", { ...data, number: "20", version: old.updatedAt }))
      .status,
    302,
  );
  assert.equal(
    (await b("/records/1", { ...data, number: "21", version: old.updatedAt }))
      .status,
    400,
  );
  await b("/records", data);
  assert.equal(
    db.prepare("SELECT number FROM records ORDER BY id DESC LIMIT 1").get()
      .number,
    21,
  );
  assert.equal((await b("/records/1/print")).status, 200);
  assert.equal(
    (
      await a("/admin/settings", {
        school: "โรงเรียนกาวิละวิทยาลัย",
        head: "หัวหน้าใหม่",
        director: "ผู้อำนวยการใหม่",
        officer: "เจ้าหน้าที่ใหม่",
      })
    ).status,
    302,
  );
  assert.equal(
    db.prepare("SELECT head FROM records WHERE id=1").get().head,
    "หัวหน้าเดิม",
  );
  await b("/account");
  const staff = db
    .prepare("SELECT id FROM users WHERE username='staff1'")
    .get();
  assert.equal((await a("/admin/users/" + staff.id, {})).status, 302);
  assert.equal((await b("/")).location, "/login");
  assert.equal((await a("/admin")).status, 200);
  assert.ok(
    db.prepare("SELECT count(*) n FROM audit WHERE action='edit'").get().n ===
      1,
  );
  await a("/account");
  assert.equal(
    (
      await a("/password", {
        current: "good-password-123",
        password: "new-password-123",
      })
    ).status,
    302,
  );
  assert.equal((await a("/")).location, "/login");
});
