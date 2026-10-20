import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const roles = new Set([
  "school_admin", "procurement_officer", "procurement_head",
  "director", "finance", "inspector"
]);

const allowedOrigins = new Set([
  "https://kru-pasadu.vercel.app",
  "https://passadukwc.primstore589.workers.dev"
]);

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

const uuidOk = (s: unknown) => typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const normEmail = (s: unknown) => String(s ?? "").trim().toLowerCase();
const fullName = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ");
const safeDetails = (obj: Record<string, unknown>) => obj;

Deno.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get("origin") || "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
  if (allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "authorization, x-client-info, apikey, content-type";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  }
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });

  if (request.method === "OPTIONS") return new Response(null, { status: allowedOrigins.has(origin) ? 204 : 403, headers });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  if (origin && !allowedOrigins.has(origin)) return json(403, { error: "Origin not allowed" });

  try {
    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) throw new HttpError(401, "กรุณาเข้าสู่ระบบอีกครั้ง");
    const identity = await admin.auth.getUser(token);
    if (identity.error || !identity.data.user) throw new HttpError(401, "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
    const actor = identity.data.user;
    const payload = await request.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new HttpError(400, "ข้อมูลไม่ถูกต้อง");
    const schoolId = payload.school_id;
    if (!uuidOk(schoolId)) throw new HttpError(400, "รหัสโรงเรียนไม่ถูกต้อง");
    const { data: membership, error: accessError } = await admin.from("memberships")
      .select("role").eq("school_id", schoolId).eq("user_id", actor.id)
      .eq("active", true).maybeSingle();
    if (accessError) throw new HttpError(500, "ตรวจสอบสิทธิ์ผู้ดูแลไม่สำเร็จ");
    if (membership?.role !== "school_admin") throw new HttpError(403, "เฉพาะแอดมินโรงเรียนนี้เท่านั้นที่จัดการผู้ใช้งานได้");
    const action = String(payload.action || "");
    if (!["create", "edit", "password", "toggle", "remove"].includes(action))
      throw new HttpError(400, "ไม่รองรับคำสั่งนี้");

    const audit = async (operation: string, targetId: string, details: Record<string, unknown>) => {
      const { error } = await admin.from("audit_logs").insert({
        school_id: schoolId, actor: actor.id, action: operation,
        entity_type: "member", entity_id: targetId, details: safeDetails(details)
      });
      if (error) console.error("Audit write failed", error.message);
    };

    if (action === "create") {
      const email = normEmail(payload.email);
      const name = fullName(payload.full_name);
      const password = String(payload.password || "");
      const role = String(payload.role || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
        throw new HttpError(400, "กรุณากรอกอีเมลให้ถูกต้อง");
      if (name.length < 3 || name.length > 200)
        throw new HttpError(400, "กรุณากรอกชื่อ–นามสกุล 3–200 ตัวอักษร");
      if (password.length < 10 || password.length > 128)
        throw new HttpError(400, "รหัสผ่านต้องมี 10–128 ตัวอักษร");
      if (!roles.has(role)) throw new HttpError(400, "บทบาทไม่ถูกต้อง");

      const created = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: name }
      });
      if (created.error || !created.data.user) {
        if (created.error?.code === "weak_password" || /password should|weak password/i.test(created.error?.message || ""))
          throw new HttpError(400, "Supabase ไม่ยอมรับรหัสผ่านนี้ กรุณาเพิ่มความยาวหรือความซับซ้อนตามนโยบายของระบบบัญชี");
        throw new HttpError(409, "สร้างบัญชีไม่สำเร็จ: อีเมลนี้อาจมีบัญชีอยู่แล้ว กรุณาใช้อีเมลใหม่หรือติดต่อผู้ดูแลแพลตฟอร์ม");
      }
      const uid = created.data.user.id;
      try {
        const p = await admin.from("profiles").upsert({ id: uid, full_name: name });
        if (p.error) throw new Error("บันทึกชื่อไม่สำเร็จ");
        const m = await admin.from("memberships").insert({
          school_id: schoolId, user_id: uid, role, active: true
        });
        if (m.error) throw new Error("บันทึกสิทธิ์โรงเรียนไม่สำเร็จ");
      } catch (err) {
        // Newly created account has no other data, so compensate on failure.
        const removed = await admin.auth.admin.deleteUser(uid);
        if (removed.error) console.error("Orphan auth user requires cleanup",uid,removed.error.message);
        throw new HttpError(500, String((err as Error).message || "สร้างบัญชีไม่สำเร็จ"));
      }
      await audit("school_staff_created", uid, { role, email });
      return json(200, { success: true, message: "สร้างบัญชีเจ้าหน้าที่เรียบร้อยแล้ว" });
    }

    const targetId = payload.user_id;
    if (!uuidOk(targetId)) throw new HttpError(400, "กรุณาเลือกผู้ใช้");
    const { data: target, error: targetError } = await admin.from("memberships")
      .select("role,active").eq("school_id", schoolId).eq("user_id", targetId)
      .maybeSingle();
    if (targetError || !target) throw new HttpError(404, "ไม่พบผู้ใช้ในโรงเรียนนี้");
    const protectedId = targetId === actor.id;
    const { data: globalAdmin, error: globalErr } = await admin.from("platform_admins")
      .select("user_id").eq("user_id", targetId).maybeSingle();
    if (globalErr) throw new HttpError(500, "ตรวจสอบบัญชีผู้ดูแลแพลตฟอร์มไม่สำเร็จ");
    if (globalAdmin) throw new HttpError(403, "ไม่สามารถแก้ไขบัญชีเจ้าของแพลตฟอร์มได้");

    const lastAdmin = async () => {
      const {count,error} = await admin.from("memberships")
        .select("user_id",{count:"exact",head:true})
        .eq("school_id",schoolId).eq("role","school_admin").eq("active",true);
      if (error) throw new HttpError(500, "ตรวจสอบจำนวนแอดมินไม่สำเร็จ");
      return (count ?? 0) <= 1;
    };

    if (action === "remove" || action === "toggle") {
      const nextActive = action === "toggle" ? payload.active === true : false;
      if (protectedId && !nextActive) throw new HttpError(400, "ไม่สามารถปิดสิทธิ์หรือลบบัญชีของตนเองได้");
      if (!nextActive && target.active && target.role === "school_admin" && await lastAdmin())
        throw new HttpError(400, "ต้องเหลือแอดมินที่ใช้งานได้อย่างน้อย 1 คน");
      // Delete only school membership. Auth user and historic procurement records are preserved.
      const mutation = action === "remove"
        ? await admin.from("memberships").delete().eq("school_id",schoolId).eq("user_id",targetId)
        : await admin.from("memberships").update({active:nextActive})
            .eq("school_id",schoolId).eq("user_id",targetId);
      if (mutation.error) throw new HttpError(500, "บันทึกการเปลี่ยนสิทธิ์ไม่สำเร็จ");
      await audit(action === "remove" ? "school_staff_removed" : "school_staff_active_changed",targetId,
        { old_role: target.role, active: nextActive });
      return json(200,{success:true,message: action === "remove" ? "ลบผู้ใช้ออกจากโรงเรียนแล้ว (เก็บประวัติเอกสารเดิมไว้)" : "เปลี่ยนสถานะการใช้งานแล้ว"});
    }

    if (action === "password") {
      const password = String(payload.password || "");
      if (password.length < 10 || password.length > 128) throw new HttpError(400,"รหัสผ่านต้องมี 10–128 ตัวอักษร");
      const cross = await admin.from("memberships").select("school_id").eq("user_id",targetId).neq("school_id",schoolId).limit(1);
      if (cross.error) throw new HttpError(500,"ตรวจสอบบัญชีร่วมไม่สำเร็จ");
      if ((cross.data||[]).length) throw new HttpError(403,"บัญชีนี้เชื่อมกับโรงเรียนอื่น กรุณาให้เจ้าของบัญชีเปลี่ยนรหัสผ่านด้วยตนเอง");
      const result = await admin.auth.admin.updateUserById(targetId,{password});
      if (result.error) {
        if (result.error.code === "weak_password" || /password should|weak password/i.test(result.error.message || ""))
          throw new HttpError(400,"Supabase ไม่ยอมรับรหัสผ่านนี้ กรุณาเพิ่มความยาวหรือความซับซ้อนตามนโยบายของระบบบัญชี");
        throw new HttpError(500,"ตั้งรหัสผ่านใหม่ไม่สำเร็จ");
      }
      await audit("school_staff_password_reset",targetId,{by_school_admin:true});
      return json(200,{success:true,message:"ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาแจ้งผู้ใช้ผ่านช่องทางส่วนตัว"});
    }

    // action === edit
    const role = String(payload.role || "");
    const name = fullName(payload.full_name);
    const email = normEmail(payload.email);
    if (!roles.has(role)) throw new HttpError(400,"บทบาทไม่ถูกต้อง");
    if (name.length < 3 || name.length > 200) throw new HttpError(400,"กรุณากรอกชื่อ–นามสกุล 3–200 ตัวอักษร");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      throw new HttpError(400,"อีเมลไม่ถูกต้อง");
    if (protectedId && role !== "school_admin") throw new HttpError(400,"ไม่สามารถลดสิทธิ์แอดมินของตนเองได้");
    if (target.active && target.role === "school_admin" && role !== "school_admin" && await lastAdmin())
      throw new HttpError(400,"ต้องเหลือแอดมินที่ใช้งานได้อย่างน้อย 1 คน");

    // Names, emails and passwords are global identities. A tenant admin may
    // change only the membership role of a user who belongs to other schools.
    const user = await admin.auth.admin.getUserById(targetId);
    if (user.error || !user.data.user) throw new HttpError(404,"ไม่พบบัญชีที่ต้องการแก้ไข");
    const {data: currentProfile, error: profileReadError} = await admin.from("profiles")
      .select("full_name").eq("id",targetId).maybeSingle();
    if (profileReadError) throw new HttpError(500,"ตรวจสอบชื่อบัญชีไม่สำเร็จ");
    const cross = await admin.from("memberships").select("school_id")
      .eq("user_id",targetId).neq("school_id",schoolId).limit(1);
    if (cross.error) throw new HttpError(500,"ตรวจสอบบัญชีร่วมไม่สำเร็จ");
    const emailChanged = normEmail(user.data.user.email) !== email;
    const nameChanged = fullName(currentProfile?.full_name) !== name;
    if ((cross.data||[]).length && (emailChanged || nameChanged))
      throw new HttpError(403,"บัญชีนี้ใช้งานหลายโรงเรียน จึงแก้ไขชื่อหรืออีเมลส่วนกลางไม่ได้ แต่เปลี่ยนบทบาทในโรงเรียนนี้ได้");
    if (emailChanged) {
      const changeEmail = await admin.auth.admin.updateUserById(targetId,{email,email_confirm:true});
      if (changeEmail.error) throw new HttpError(409,"เปลี่ยนอีเมลไม่สำเร็จ อีเมลใหม่อาจซ้ำกับบัญชีอื่น");
    }
    const changeProfile = await admin.from("profiles").upsert({id:targetId,full_name:name});
    if (changeProfile.error) throw new HttpError(500,"บันทึกชื่อไม่สำเร็จ");
    const changeRole = await admin.from("memberships").update({role})
      .eq("school_id",schoolId).eq("user_id",targetId);
    if (changeRole.error) throw new HttpError(500,"บันทึกบทบาทไม่สำเร็จ");
    await audit("school_staff_updated",targetId,{role,email,name_changed});
    return json(200,{success:true,message:"แก้ไขข้อมูลเจ้าหน้าที่เรียบร้อยแล้ว"});
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error("School staff request failed", err);
    return json(status,{error:err instanceof HttpError?err.message:"เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ กรุณาลองอีกครั้ง"});
  }
});
