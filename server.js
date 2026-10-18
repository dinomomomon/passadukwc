const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const { randomBytes, timingSafeEqual } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
function createApp({
  dbPath = process.env.DB_PATH || path.join(__dirname, "data/school.db"),
  secret = process.env.SESSION_SECRET,
  driver,
} = {}) {
  if (
    (process.env.NODE_ENV === "production" || process.env.VERCEL) &&
    (!secret || secret.length < 32)
  )
    throw Error("SESSION_SECRET ต้องมีอย่างน้อย 32 ตัวอักษร");
  const { createDatabase } = require("./database");
  const db = createDatabase({
    dbPath,
    databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    driver,
  });
  class DatabaseStore extends session.Store {
    async get(sid, cb) {
      try {
        const row = await db
          .prepare("SELECT * FROM sessions WHERE sid=? AND expires>?")
          .get(sid, Date.now());
        cb(null, row ? JSON.parse(row.data) : null);
      } catch (e) {
        cb(e);
      }
    }
    async set(sid, data, cb = () => {}) {
      try {
        await db
          .prepare("DELETE FROM sessions WHERE expires<=?")
          .run(Date.now());
        await db
          .prepare(
            "INSERT INTO sessions VALUES(?,?,?) ON CONFLICT(sid) DO UPDATE SET data=excluded.data,expires=excluded.expires",
          )
          .run(
            sid,
            JSON.stringify(data),
            data.cookie.expires
              ? new Date(data.cookie.expires).getTime()
              : Date.now() + 28800000,
          );
        cb();
      } catch (e) {
        cb(e);
      }
    }
    async destroy(sid, cb = () => {}) {
      try {
        await db.prepare("DELETE FROM sessions WHERE sid=?").run(sid);
        cb();
      } catch (e) {
        cb(e);
      }
    }
  }
  const app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "1" || process.env.VERCEL)
    app.set("trust proxy", 1);
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.use(helmet());
  app.use(express.static(path.join(__dirname, "public")));
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));
  app.use(async (req, res, next) => {
    try {
      await db.ready;
      next();
    } catch (e) {
      console.error("Database unavailable:", e.code || e.name);
      res
        .status(503)
        .send("ฐานข้อมูลยังไม่พร้อม กรุณาตรวจสอบการตั้งค่าและ migration");
    }
  });
  app.use(
    session({
      store: new DatabaseStore(),
      secret: secret || randomBytes(48).toString("hex"),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production" || !!process.env.VERCEL,
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
  );
  app.use(async (req, res, next) => {
    req.user = req.session.uid
      ? await db
          .prepare(
            "SELECT id,username,name,role FROM users WHERE id=? AND active=1",
          )
          .get(req.session.uid)
      : null;
    res.locals.user = req.user;
    res.locals.csrf = req.session.csrf ||= randomBytes(32).toString("hex");
    res.locals.money = (n) =>
      (n / 100).toLocaleString("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    res.locals.kindName = (k) => (k === "purchase" ? "จัดซื้อ" : "จัดจ้าง");
    res.locals.dateTH = (d) =>
      new Date(d + "T00:00:00+07:00").toLocaleDateString("th-TH", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    res.locals.hasGaruda = fs.existsSync(
      path.join(__dirname, "public/garuda.png"),
    );
    res.locals.error = null;
    if (req.method === "POST") {
      const a = Buffer.from(req.body._csrf || "");
      const b = Buffer.from(res.locals.csrf);
      if (a.length !== b.length || !timingSafeEqual(a, b))
        return res
          .status(403)
          .render("message", {
            title: "คำขอหมดอายุ",
            message: "กรุณาเปิดหน้าใหม่แล้วลองอีกครั้ง",
          });
    }
    next();
  });
  const hasUsers = async () =>
    !!(await db.prepare("SELECT 1 FROM users LIMIT 1").get());
  const auth = async (req, res, next) =>
    req.user ? next() : res.redirect((await hasUsers()) ? "/login" : "/setup");
  const admin = async (req, res, next) =>
    req.user?.role === "admin"
      ? next()
      : res
          .status(403)
          .render("message", {
            title: "ไม่มีสิทธิ์",
            message: "เฉพาะผู้ดูแลระบบเท่านั้น",
          });
  const audit = async (req, action, recordId, detail) =>
    await db
      .prepare(
        "INSERT INTO audit(userId,action,recordId,detail) VALUES(?,?,?,?)",
      )
      .run(req.user?.id || null, action, recordId, detail);
  const tx = (fn) => db.transaction(fn);
  const text = (v, max = 500) =>
    String(v || "")
      .trim()
      .slice(0, max);
  const fail = (res, e) =>
    res
      .status(400)
      .render("message", {
        title: "บันทึกไม่สำเร็จ",
        message:
          e.code?.includes("CONSTRAINT") || e.code === "23505"
            ? "เลขเอกสารหรือชื่อผู้ใช้นี้มีอยู่แล้ว กรุณาเลือกใหม่"
            : e.message,
      });
  const loginLimit = rateLimit({
    ...db.rateLimitOptions(),
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: "ลองใหม่ในอีก 15 นาที",
  });
  app.get("/setup", async (req, res) =>
    (await hasUsers()) ? res.redirect("/login") : res.render("setup"),
  );
  app.post("/setup", loginLimit, async (req, res) => {
    try {
      if (await hasUsers()) return res.sendStatus(403);
      if (
        (process.env.NODE_ENV === "production" || process.env.VERCEL) &&
        !process.env.SETUP_TOKEN
      )
        throw Error("ผู้ติดตั้งต้องกำหนด SETUP_TOKEN ก่อนสร้างผู้ดูแล");
      if (process.env.SETUP_TOKEN && req.body.token !== process.env.SETUP_TOKEN)
        throw Error("รหัสเปิดใช้งานไม่ถูกต้อง");
      if (
        !/^[a-zA-Z0-9._-]{3,50}$/.test(req.body.username) ||
        String(req.body.password).length < 12 ||
        !text(req.body.name)
      )
        throw Error(
          "ชื่อผู้ใช้ 3–50 ตัวอักษรภาษาอังกฤษ และรหัสผ่านอย่างน้อย 12 ตัวอักษร",
        );
      await tx(async () => {
        await db.lock("initial-admin");
        if (await hasUsers()) throw Error("สร้างผู้ดูแลแล้ว");
        await db
          .prepare(
            "INSERT INTO users(username,name,password,role) VALUES(?,?,?,?)",
          )
          .run(
            req.body.username,
            text(req.body.name),
            await bcrypt.hash(req.body.password, 12),
            "admin",
          );
      });
      res.redirect("/login");
    } catch (e) {
      fail(res, e);
    }
  });
  app.get("/login", async (req, res) =>
    (await hasUsers()) ? res.render("login") : res.redirect("/setup"),
  );
  app.post("/login", loginLimit, async (req, res, next) => {
    const u = await db
      .prepare("SELECT * FROM users WHERE username=? AND active=1")
      .get(text(req.body.username));
    if (!u || !(await bcrypt.compare(req.body.password || "", u.password)))
      return res
        .status(401)
        .render("login", { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    req.session.regenerate((e) => {
      if (e) return next(e);
      req.session.uid = u.id;
      req.session.save((e) => (e ? next(e) : res.redirect("/")));
    });
  });
  app.post("/logout", async (req, res) =>
    req.session.destroy(() => res.redirect("/login")),
  );
  app.get("/", auth, async (req, res) => {
    const q = text(req.query.q, 100),
      kind = ["purchase", "hire"].includes(req.query.kind)
        ? req.query.kind
        : "";
    const rows = await db
      .prepare(
        "SELECT * FROM records WHERE (title LIKE ? OR vendor LIKE ? OR CAST(number AS TEXT) LIKE ?) AND (?='' OR kind=?) ORDER BY id DESC LIMIT 200",
      )
      .all("%" + q + "%", "%" + q + "%", "%" + q + "%", kind, kind);
    const stats = await db
      .prepare(
        "SELECT kind,count(*) count,sum(total) total FROM records GROUP BY kind",
      )
      .all();
    res.render("index", { rows, q, kind, stats });
  });
  const currentYear = () => {
    const d = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
    );
    return d.getFullYear() + 543 + (d.getMonth() >= 9 ? 1 : 0);
  };
  app.get("/records/new", auth, async (req, res) =>
    res.render("form", {
      record: null,
      settings: await db.prepare("SELECT * FROM settings").get(),
      year: currentYear(),
    }),
  );
  function parse(body) {
    const kind = body.kind;
    if (!["purchase", "hire"].includes(kind)) throw Error("เลือกประเภทงาน");
    const year = Number(body.year),
      number = body.number ? Number(body.number) : null;
    if (
      !Number.isInteger(year) ||
      year < 2500 ||
      year > 2700 ||
      (number !== null &&
        (!Number.isSafeInteger(number) || number < 1 || number > 9999999))
    )
      throw Error("ปีหรือเลขเอกสารไม่ถูกต้อง");
    const title = text(body.title),
      reason = text(body.reason, 4000),
      vendor = text(body.vendor),
      vendorAddress = text(body.vendorAddress, 2000),
      budget = text(body.budget),
      method = text(body.method);
    if (!title || !reason || !vendor || !budget || !method)
      throw Error("กรุณากรอกข้อมูลให้ครบ");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(body.date) ||
      isNaN(Date.parse(body.date)) ||
      new Date(body.date).toISOString().slice(0, 10) !== body.date
    )
      throw Error("วันที่ไม่ถูกต้อง");
    const names = [].concat(body.itemName || []),
      qty = [].concat(body.qty || []),
      prices = [].concat(body.price || []),
      units = [].concat(body.unit || []);
    const items = [];
    for (let i = 0; i < names.length; i++) {
      if (!text(names[i])) continue;
      const quantity = Number(qty[i]);
      if (
        !Number.isSafeInteger(quantity) ||
        quantity <= 0 ||
        quantity > 100000 ||
        !/^\d+(\.\d{1,2})?$/.test(String(prices[i]))
      )
        throw Error(
          "จำนวนต้องเป็นจำนวนเต็มบวก และราคามีทศนิยมได้ไม่เกิน 2 ตำแหน่ง",
        );
      const cents = Math.round(Number(prices[i]) * 100);
      if (!Number.isSafeInteger(cents) || cents <= 0)
        throw Error("ราคาต้องมากกว่า 0");
      items.push({
        name: text(names[i]),
        qty: quantity,
        price: cents,
        unit: text(units[i], 50) || "หน่วย",
      });
    }
    if (!items.length || items.length > 30)
      throw Error("กรอกอย่างน้อย 1 รายการ สูงสุด 30 รายการ");
    const total = items.reduce((s, i) => s + i.qty * i.price, 0);
    if (!Number.isSafeInteger(total) || total > 500000)
      throw Error(
        "ระบบนี้รองรับยอดรวมสุทธิไม่เกิน 5,000 บาท กรุณารวมภาษีและค่าใช้จ่ายทั้งหมดในราคา",
      );
    return {
      kind,
      year,
      number,
      title,
      date: body.date,
      reason,
      vendor,
      vendorAddress,
      items: JSON.stringify(items),
      total,
      budget,
      method,
    };
  }
  app.post("/records", auth, async (req, res) => {
    try {
      const v = parse(req.body),
        s = await db.prepare("SELECT * FROM settings").get();
      if (!s.head || !s.director || !s.officer)
        throw Error("ให้ผู้ดูแลตั้งค่าผู้ลงนามให้ครบก่อน");
      const id = await tx(async () => {
        const number = await db.nextNumber(v.kind, v.year, v.number);
        const row = await db
          .prepare(
            "INSERT INTO records(kind,year,number,title,date,reason,vendor,vendorAddress,items,total,budget,method,school,head,director,officer,createdBy) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
          )
          .get(
            v.kind,
            v.year,
            number,
            v.title,
            v.date,
            v.reason,
            v.vendor,
            v.vendorAddress,
            v.items,
            v.total,
            v.budget,
            v.method,
            s.school,
            s.head,
            s.director,
            s.officer,
            req.user.id,
          );
        const id = Number(row.id);
        await audit(
          req,
          "create",
          id,
          JSON.stringify({ number, year: v.year, kind: v.kind }),
        );
        return id;
      });
      res.redirect("/records/" + id);
    } catch (e) {
      fail(res, e);
    }
  });
  app.get("/records/:id", auth, async (req, res) => {
    const record = await db
      .prepare("SELECT * FROM records WHERE id=?")
      .get(req.params.id);
    if (!record) return res.sendStatus(404);
    res.render("detail", { record, items: JSON.parse(record.items) });
  });
  app.get("/records/:id/edit", auth, async (req, res) => {
    const record = await db
      .prepare("SELECT * FROM records WHERE id=?")
      .get(req.params.id);
    if (!record) return res.sendStatus(404);
    res.render("form", { record, settings: record, year: record.year });
  });
  app.post("/records/:id", auth, async (req, res) => {
    try {
      const v = parse(req.body);
      await tx(async () => {
        await db.lock("record:" + req.params.id);
        const old = await db
          .prepare("SELECT * FROM records WHERE id=?")
          .get(req.params.id);
        if (!old) throw Error("ไม่พบรายการ");
        if (!v.number) throw Error("กรอกเลขเอกสาร");
        if (v.kind !== old.kind || v.year !== old.year)
          throw Error("ไม่สามารถเปลี่ยนประเภทหรือปีของรายการเดิม");
        if (req.body.version !== old.updatedAt)
          throw Error("มีผู้อื่นแก้ไขข้อมูลแล้ว กรุณาเปิดรายการใหม่");
        await db
          .prepare(
            "UPDATE records SET number=?,title=?,date=?,reason=?,vendor=?,vendorAddress=?,items=?,total=?,budget=?,method=?,updatedAt=? WHERE id=?",
          )
          .run(
            v.number,
            v.title,
            v.date,
            v.reason,
            v.vendor,
            v.vendorAddress,
            v.items,
            v.total,
            v.budget,
            v.method,
            new Date().toISOString(),
            old.id,
          );
        await db.nextNumber(old.kind, old.year, v.number);
        await audit(
          req,
          "edit",
          old.id,
          JSON.stringify({ before: old, after: v }),
        );
      });
      res.redirect("/records/" + req.params.id);
    } catch (e) {
      fail(res, e);
    }
  });
  app.get("/records/:id/print", auth, async (req, res) => {
    const record = await db
      .prepare("SELECT * FROM records WHERE id=?")
      .get(req.params.id);
    if (!record) return res.sendStatus(404);
    res.render("print", { record, items: JSON.parse(record.items) });
  });
  app.get("/admin", auth, admin, async (req, res) =>
    res.render("admin", {
      settings: await db.prepare("SELECT * FROM settings").get(),
      users: await db
        .prepare("SELECT id,username,name,role,active FROM users")
        .all(),
      logs: await db
        .prepare(
          "SELECT audit.*,users.name FROM audit LEFT JOIN users ON users.id=audit.userId ORDER BY audit.id DESC LIMIT 50",
        )
        .all(),
    }),
  );
  app.post("/admin/settings", auth, admin, async (req, res) => {
    try {
      const values = ["school", "head", "director", "officer"].map((k) =>
        text(req.body[k]),
      );
      if (values.some((v) => !v))
        throw Error("กรอกชื่อโรงเรียนและผู้ลงนามให้ครบ");
      await tx(async () => {
        await db
          .prepare(
            "UPDATE settings SET school=?,head=?,director=?,officer=? WHERE id=1",
          )
          .run(...values);
        await audit(req, "settings", null, "แก้ไขการตั้งค่าผู้ลงนาม");
      });
      res.redirect("/admin");
    } catch (e) {
      fail(res, e);
    }
  });
  app.post("/admin/users", auth, admin, async (req, res) => {
    try {
      if (
        !/^[a-zA-Z0-9._-]{3,50}$/.test(req.body.username) ||
        !text(req.body.name) ||
        String(req.body.password).length < 12 ||
        !["admin", "staff"].includes(req.body.role)
      )
        throw Error("ตรวจสอบข้อมูลผู้ใช้และรหัสผ่านอย่างน้อย 12 ตัวอักษร");
      await tx(async () => {
        await db
          .prepare(
            "INSERT INTO users(username,name,password,role) VALUES(?,?,?,?)",
          )
          .run(
            req.body.username,
            text(req.body.name),
            await bcrypt.hash(req.body.password, 12),
            req.body.role,
          );
        await audit(req, "add_user", null, text(req.body.username));
      });
      res.redirect("/admin");
    } catch (e) {
      fail(res, e);
    }
  });
  app.post("/admin/users/:id", auth, admin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (id === req.user.id) throw Error("ไม่สามารถปิดบัญชีตัวเอง");
      await tx(async () => {
        await db.prepare("UPDATE users SET active=1-active WHERE id=?").run(id);
        await db
          .prepare("DELETE FROM sessions WHERE json_extract(data,'$.uid')=?")
          .run(id);
        await audit(req, "toggle_user", null, String(id));
      });
      res.redirect("/admin");
    } catch (e) {
      fail(res, e);
    }
  });
  app.post("/password", auth, async (req, res) => {
    try {
      const u = await db
        .prepare("SELECT * FROM users WHERE id=?")
        .get(req.user.id);
      if (
        !(await bcrypt.compare(req.body.current || "", u.password)) ||
        String(req.body.password).length < 12
      )
        throw Error("รหัสเดิมไม่ถูกต้อง หรือรหัสใหม่สั้นกว่า 12 ตัวอักษร");
      await tx(async () => {
        await db
          .prepare("UPDATE users SET password=? WHERE id=?")
          .run(await bcrypt.hash(req.body.password, 12), u.id);
        await db
          .prepare("DELETE FROM sessions WHERE json_extract(data,'$.uid')=?")
          .run(u.id);
        await audit(req, "password", null, "เปลี่ยนรหัสผ่าน");
      });
      req.session.destroy(() => res.redirect("/login"));
    } catch (e) {
      fail(res, e);
    }
  });
  app.get("/account", auth, async (req, res) => res.render("account"));
  app.use(async (req, res) =>
    res
      .status(404)
      .render("message", {
        title: "ไม่พบหน้า",
        message: "ตรวจสอบที่อยู่แล้วลองอีกครั้ง",
      }),
  );
  app.use((err, req, res, next) => {
    console.error(err.message);
    res
      .status(500)
      .render("message", {
        title: "เกิดข้อผิดพลาด",
        message: "ไม่สามารถดำเนินการได้ กรุณาลองใหม่หรือติดต่อผู้ดูแล",
      });
  });
  return { app, db: db.raw || db, close: () => db.close() };
}
if (require.main === module) {
  const { app } = createApp();
  app.listen(
    Number(process.env.PORT) || 3000,
    process.env.HOST || "127.0.0.1",
    () => console.log("Kawila procurement server started"),
  );
}
module.exports = { createApp };
