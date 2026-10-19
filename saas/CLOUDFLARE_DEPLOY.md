# Deploy ครูพัสดุบน Cloudflare Workers (Static Assets)

โครงสร้าง: เว็บที่ Cloudflare Workers Static Assets / บัญชีและฐานข้อมูลที่ Supabase / ซอร์สโค้ดที่ GitHub

## เชื่อม GitHub กับ Cloudflare Dashboard

1. เข้า https://dash.cloudflare.com/ > Workers & Pages > Create > Import a repository (ชื่อเมนูอาจต่างตามหน้าเว็บ)
2. เลือก repository `dinomomomon/passadukwc`
3. เลือก branch `feature/kru-pasadu-v01`
4. กำหนด Root directory: `saas`
5. ชื่อ Worker: `kru-pasadu` (ต้องตรงกับ `wrangler.jsonc`)
6. Build command: `npm run build`
7. Deploy command: `npx wrangler deploy`
8. ตรวจสอบ URL ที่ Cloudflare แสดงหลัง Deploy สำเร็จ (ยังไม่เปลี่ยนโดเมน Vercel)

คำสั่งทดสอบบนเครื่องที่ติดตั้ง Node.js:
```sh
cd saas
npm install
npm run build
npx wrangler deploy
```

## ก่อนทดลองบัญชีจริง
- นำ URL `https://<ชื่อ-worker>.<subdomain>.workers.dev` ที่ Cloudflare ออกให้ไปเพิ่มใน Supabase Auth → URL Configuration → Redirect URLs
- อย่าเปลี่ยน Supabase Site URL หลักออกจาก Vercel จนกว่าจะทดลอง Cloudflare ผ่าน
- ทดสอบเข้าสู่ระบบ, Super Admin, การสร้างรายการ, ตรวจสิทธิ์ 15 วัน/10 ชุด, ต่ออายุ และพิมพ์ PDF
- ตรวจ Console ของ Chrome ว่าไม่มี JS errors
- ไม่ใส่ service_role key หรือ Cloudflare API Token ลง GitHub; `config.js` ฝั่งเว็บอนุญาตเฉพาะ publishable/anon key

หมายเหตุ: Workers Builds แผนฟรีมีโควตานาที Build ต่อเดือน ไม่ใช่ Deploy ได้ไม่จำกัดโดยปราศจากขีดจำกัดทั้งหมด
