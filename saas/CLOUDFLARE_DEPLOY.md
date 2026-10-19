# Cloudflare Workers — ครูพัสดุ (แพลตฟอร์ม SaaS)

## สาเหตุ Deploy Failed ครั้งแรก (19 ต.ค. 2569)
Cloudflare Worker ชื่อ `passadukwc` แต่รัน `npx wrangler deploy` จากโฟลเดอร์หลักที่เป็นระบบ Node/Express เก่า ไม่ใช่เว็บไซต์ `saas/`.
Log มี `npm clean-install` ตามด้วย `Executing user deploy command: npx wrangler deploy` โดยไม่มี `npm run build` และขึ้น `Could not detect a directory containing static files`.
จึงต้องตั้งค่า Root directory และ Build command ให้ครบ

## Cloudflare Dashboard → Workers & Pages → passadukwc → Settings → Build

ค่าที่ต้องตั้ง **สำหรับโปรเจกต์เดิม**:

| Setting | Value |
| --- | --- |
| Connected Git repository | `dinomomomon/passadukwc` |
| Production branch | `feature/kru-pasadu-v01` |
| Root directory | `saas` (ไม่มี / นำหน้า) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Wrangler config file | `saas/wrangler.jsonc` (ค้นหาอัตโนมัติเมื่อ Root directory=saas) |
| Worker name | `passadukwc` (ต้องตรงกับ Cloudflare ที่สร้างไว้) |
| Static assets output | `saas/dist` (Wrangler ใช้ `./dist` เมื่อทำงานจาก saas) |

หลังบันทึก Settings ให้ไป **Deployments** → Retry failed build หาก retry ใช้ค่าใหม่ หรือ trigger commit ใหม่ใน production branch

## ขั้นตอนตรวจว่าถูกต้อง
Cloudflare Build Log ควรมี:
1. Installing dependencies ใน `saas` / ติดตั้ง `esbuild` และ `@supabase/supabase-js`
2. `npm run build`
3. `Built self-hosted Kru Pasadu browser app ...`
4. `npx wrangler deploy` → `Uploading ... assets` → Deploy success

ถ้ายังเห็น `npm clean-install` ติดตั้งแพ็กเกจ Express/pg จาก Repository root แสดงว่า Root directory ยังไม่ถูกเปลี่ยน

## ทดสอบก่อนเปิดจริง
- ใช้ URL ที่ Cloudflare ให้ เช่น `https://passadukwc.<บัญชี>.workers.dev`
- เพิ่ม URL จริงนี้ใน **Supabase → Authentication → URL Configuration → Redirect URLs** โดยยังไม่เปลี่ยน Site URL หลักของ Vercel
- ทดสอบ Login, Super Admin, สมัครโรงเรียน, ทดลองใช้ฟรี 15 วัน/10 ชุด, รายการจัดซื้อ-จัดจ้าง และ PDF
- ตรวจ Console และ Mobile responsive
- อย่าเก็บรหัสผ่าน, Supabase `service_role` key, หรือ Cloudflare API Token ใน Source Code

## CLI บนคอมพิวเตอร์ (ตัวเลือก)
```bash
cd saas
npm install
npm run build
npx wrangler deploy
```

Cloudflare Static Assets ยังใช้ฐานข้อมูล Supabase เดิม ไม่ย้ายหรือแก้ข้อมูล Vercel

หาก Worker เดิมชื่ออื่น ให้ปรับ `name` ใน `saas/wrangler.jsonc` ให้ตรงกับชื่อจริงก่อน deploy อีกครั้ง

## ตรวจสอบการเชื่อม GitHub ก่อน Deploy (19 ตุลาคม 2569)
หน้าตั้งค่า Cloudflare ยืนยันว่าไม่มีแจ้งเตือน Git disconnected แล้ว โดย Production branch ตั้งเป็น `feature/kru-pasadu-v01`, Root directory `saas`, Build command `npm run build`, Deploy command `npx wrangler deploy` และ Worker `passadukwc`.
การอัปเดตบันทึกนี้สร้าง Commit ใหม่บน Branch ที่ถูกต้องเพื่อกระตุ้น Cloudflare Workers Builds โดยไม่แตะฐานข้อมูลหรือแอปผู้ใช้.
