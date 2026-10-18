# นำระบบขึ้น Vercel + PostgreSQL

สถานะ: เชื่อมบัญชีและสร้างโปรเจกต์ Vercel `piyawats-projects-96892eb0/passadukwc` พร้อมเชื่อม GitHub แล้ว ตั้ง SESSION_SECRET ใน Production และตรวจ Vercel build สำเร็จ ฐานข้อมูล Supabase แผน Free (sin1) ยังรอเจ้าของบัญชียอมรับเงื่อนไข จึงยังไม่ได้สร้าง schema หรือ deploy แอปที่ใช้งานได้จริง

## 1. เชื่อม repository

หลังโค้ดอยู่ใน GitHub ให้เข้า https://vercel.com/new ลงชื่อเข้าใช้ด้วย GitHub เลือก `dinomomomon/passadukwc` และ root directory ของ repository ใช้ Node.js 24.x ไม่มีขั้นตอน build หน้าเว็บแยก ใช้ `vercel.json` และ entry `app.js` ซึ่ง export Express app ผ่าน native Express framework ไม่มี catch-all rewrite ไป /api/index; เมื่อ import จะไม่เปิด listener (เปิดเฉพาะ npm start)

## 2. ฐานข้อมูล Supabase

สร้าง Supabase project ในบัญชีของโรงเรียน เลือกตำแหน่งใกล้ผู้ใช้ (เช่น Singapore) เปิด Connect และเลือก **Transaction pooler** สำหรับ serverless คัดลอก connection string จากหน้า Connect โดยตรง อย่าสร้าง host หรือ username เอง และอย่าส่ง connection string ในแชต

ตั้ง `DATABASE_URL` ใน Vercel Project Settings → Environment Variables โดยใช้ pooler URL พร้อมการตรวจสอบ TLS เช่น `sslmode=verify-full` ถ้าบริการกำหนด CA เฉพาะให้ตั้ง trust ตามเอกสารทางการ ห้ามใช้ `rejectUnauthorized: false` หรือปิด TLS verification หากเครือข่ายเชื่อม transaction pooler ไม่ได้ ใช้ session pooler ที่ผู้ให้บริการรองรับแทนตามเอกสาร

แอปใช้ parameterized query แบบไม่มีชื่อ prepared statement และทำ transaction ผ่าน connection เดียว มี PostgreSQL transaction advisory lock ป้องกันเลขซ้ำข้าม instance ล็อกแยกตามประเภทและปีงบประมาณ เลขที่แก้ย้อนหลังไม่ทำให้ counter ลดลง

ห้ามใช้ Supabase `anon key` หรือ service role API key แทน database connection string อย่าเปิดตารางแอปให้ browser เรียก Supabase Data API โดยตรง ฐานข้อมูลนี้ออกแบบให้ Express เข้าถึงฝั่ง server เท่านั้น migration สร้าง schema `kawila` แยกจาก `public` โดยแอปอ้างชื่อตารางพร้อม schema ทุกครั้ง ไม่ต้องเพิ่ม `kawila` ใน exposed schemas ของ Supabase Data API และต้องจำกัดสิทธิ์ตามนโยบายโรงเรียน

## 3. ตั้งค่าลับใน Vercel

ตั้งค่าผ่านหน้าจอ Vercel โดยไม่ใส่ใน repository:

- `DATABASE_URL`: PostgreSQL URL จาก Supabase Connect
- `SESSION_SECRET`: สุ่มอย่างน้อย 32 ตัวอักษร ใช้ค่าเดิมข้าม deployment ที่ต้องการใช้ session ร่วมกัน
- `SETUP_TOKEN`: ค่าสุ่มแยกจาก session secret ใช้เปิดหน้าสร้างผู้ดูแลครั้งแรก

Vercel กำหนด `VERCEL` ให้เอง แอปจะใช้ secure cookie และ trust proxy บนแพลตฟอร์มนี้ `DB_PATH` ไม่ใช้บน Vercel และแอปจะปฏิเสธการใช้ SQLite บน Vercel แทนการเก็บฐานข้อมูลใน `/tmp`

แยกฐานข้อมูลและค่าลับของ Preview ออกจาก Production เพื่อไม่ให้การทดสอบแก้ข้อมูลจริง หากเชื่อม Production อย่างเดียว ให้ปิดการใช้ Preview จนกว่าจะมีฐานข้อมูลทดสอบ

## 4. สร้าง schema ก่อนเปิดใช้งาน

วิธีที่ง่ายคือเปิด Supabase SQL Editor และรันเนื้อหา `scripts/schema.postgres.sql` ครั้งแรกในฐานข้อมูลว่างที่เตรียมสำหรับแอปนี้ หรือรันจากเครื่องที่เข้าฐานข้อมูลได้:

```sh
npm ci
# กำหนด DATABASE_URL ผ่าน secret/environment ของเครื่องก่อน
npm run db:migrate
```

คำสั่ง migration มี transaction และ advisory lock และรันซ้ำได้ ไม่ลบข้อมูลเดิม ไม่ต้องรัน migration ทุก cold start ใช้ migration เป็นงานแยกก่อน deploy ไม่บังคับให้ Vercel build ต่อฐานข้อมูล Production

SQLite เดิมไม่ถูกส่งขึ้น Supabase อัตโนมัติ หากเริ่มมีข้อมูลจริงแล้ว ต้องทำงานย้ายข้อมูลพร้อมสำรองและตรวจสอบเลขก่อนใช้งานต่อ

## 5. Deploy และตรวจรับ

กด Deploy ใน Vercel หลังสร้าง schema และตั้งค่าลับครบแล้ว หาก deploy ก่อนตั้งค่า ให้ Redeploy หลังตั้งค่าเสร็จ จากนั้นเปิด HTTPS URL ที่ Vercel ให้ เข้า `/setup` ใช้ SETUP_TOKEN สร้างผู้ดูแลของโรงเรียนด้วยชื่อผู้ใช้/รหัสผ่านที่ตั้งเอง เมื่อล็อกอินแล้วให้ตั้งผู้ลงนามและเพิ่มเจ้าหน้าที่ 3 คน

ตรวจล็อกอินและสร้างรายการทดสอบพร้อมกันจากหลาย browser ตรวจเลขซื้อ/จ้างแยกกัน การคง session หลัง refresh/redeploy และชุดพิมพ์ A4 ก่อนใช้ข้อมูลจริง ตรวจ Vercel logs โดยไม่บันทึก cookie หรือค่าลับ

อาจมีค่าใช้จ่ายหรือข้อจำกัดตามแผน Vercel/Supabase และฐานข้อมูลบางแผนอาจพักเมื่อไม่ได้ใช้งาน ตรวจเงื่อนไขบัญชีของโรงเรียนก่อนเลือกบริการ

## สำรองและข้อจำกัด

บน PostgreSQL ใช้ backup ของผู้ให้บริการหรือ `pg_dump` ผ่าน connection ที่ผู้ให้บริการแนะนำ ไม่ใช้ `npm run backup` ซึ่งสำหรับ SQLite เท่านั้น ควรตั้ง retention และทดสอบ restore แยกจากระบบจริง

session และ rate limiter สำหรับล็อกอินเก็บใน PostgreSQL ไม่ใช้หน่วยความจำของ function เป็นแหล่งข้อมูลกลาง `npm test` ทดสอบ SQLite และ PostgreSQL จริงแบบชั่วคราวในเครื่องพัฒนา รวมหลาย app instance, sessions, migrations, เลขรันและ concurrent edits การทดสอบนี้ยังไม่ใช่การตรวจ deployment บน Vercel

แบบเอกสารยังเป็นฉบับร่างตาม README และยังไม่มีตราครุฑที่โรงเรียนรับรอง การ deploy ไม่ใช่การรับรองรูปแบบเอกสารหรือระเบียบจัดซื้อจัดจ้าง
