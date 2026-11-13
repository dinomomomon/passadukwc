# ครูพัสดุ — ข้อกำหนด SaaS และสถานะรุ่นแรก
วันที่ 19 ตุลาคม 2569
สถานะ: เอกสารข้อกำหนดและต้นแบบสำหรับตรวจรับ ยังไม่ใช่ระบบ SaaS ที่เปิดให้ลูกค้าใช้งานจริง

## เป้าหมาย
หนึ่งผู้ให้บริการ (Super Admin) สร้างโรงเรียนได้หลายแห่ง (School Tenant) แต่ละโรงเรียนมี School Admin และผู้ใช้หลายคน ได้แก่ เจ้าหน้าที่พัสดุ หัวหน้าเจ้าหน้าที่พัสดุ เจ้าหน้าที่การเงิน ผู้ตรวจรับ และผู้อำนวยการ โดยการแต่งตั้งหน้าที่และอำนาจอนุมัติต้องตรงกับคำสั่งหรือการมอบอำนาจของหน่วยงาน

## ข้อกำหนดที่ต้องผ่านก่อนเปิด SaaS
1. **Data isolation**: ทุกตารางธุรกรรมมี school_id; ทุก query ฝั่ง server บังคับ school_id จาก session ปลอดภัย ห้ามเชื่อ school_id ที่ client ส่งมา; access files ต้องบังคับสิทธิ์เหมือนฐานข้อมูล; สร้าง integration test ที่ลองเข้าถึง school B ด้วย session ของ school A และต้องถูกปฏิเสธ
2. **Super Admin**: จัดการการเชิญโรงเรียน ตั้งแพ็กเกจ ระงับบัญชีและเก็บสถานะ โดยผู้ดูแลระบบส่วนกลางไม่ควรอ่านเอกสารโรงเรียนโดยปริยาย การเข้าอ่านเพื่อช่วยเหลือต้องมีเหตุผล/เวลา/บันทึกการเข้าถึง
3. **School Admin**: เชิญผู้ใช้ไม่จำกัดจำนวนตามแพ็กเกจ กำหนด role และสถานะ ป้องกันการยกระดับตนเองเป็น Super Admin
4. **Role**: purchaser, procurement_head, director, finance, inspector, school_admin; แยกอำนาจแสดงชื่อผู้ลงนาม อำนาจการเสนอ ความเห็น ตรวจรับ และอนุมัติ
5. **Numbering**: counter แยกโรงเรียน/ชนิดทะเบียน/ปีงบประมาณ, จองเลขใน transaction ในฐานข้อมูล, unique(school_id, series_id, fiscal_year, number), แก้ไขเลขต้องบังคับเหตุผลและ audit, ไม่ reuse เลขยกเลิก
6. **Document version**: มีทั้ง data version / rendered PDF version และสถานะ draft/review/approved/received/payment; เมื่อแก้ข้อมูลแล้วต้องสร้าง PDF เวอร์ชันใหม่แต่ยังเก็บเวอร์ชันเดิม
7. **Signatories**: ตั้งชื่อผู้อำนวยการ หัวหน้าพัสดุ เจ้าหน้าที่ ช่วงวันที่ดำรงตำแหน่งและคำสั่งแต่งตั้ง เอกสารที่ออกต้องเก็บ snapshot ชื่อ/ตำแหน่ง/สถานะในวันนั้น; ชื่อในแบบไม่ได้ถือเป็นลายเซ็นหรือการอนุมัติ
8. **Workflow**: รายงานขอซื้อ/ขอจ้าง -> รายละเอียดแนบท้าย -> รายงานผลและขออนุมัติ -> (หลักฐานการสั่งตามกรณี) -> ตรวจรับ -> เบิกจ่าย -> (ใบเบิกพัสดุเฉพาะเมื่อมีการเบิกวัสดุ)
9. **Storage**: ฐานข้อมูล SQL เก็บข้อมูลและรายการแนบแต่ละฉบับ; ไฟล์ PDF เก็บใน private storage หรือ Drive ของโรงเรียนที่เชื่อมด้วย OAuth; เก็บ provider/fileId/hash/created_at/version; ไม่เก็บ publicly writable URLs; ทดสอบการตัดสิทธิ์/ย้ายบัญชี Drive
10. **Retention**: ไม่ลบเอกสารอัตโนมัติเมื่อหมดอายุสมาชิก; ส่งออกข้อมูลทั้งโรงเรียนและสิทธิ์ดาวน์โหลดอย่างเป็นระบบ; ระยะการเก็บเอกสารราชการยึดหลักเกณฑ์ที่หน่วยงานใช้
11. **Security**: HTTPS, password hashing, CSRF, rotation of sessions, audit, backup/restore test, rate-limit, per-school permissions; ห้ามเก็บข้อมูลส่วนบุคคลเกินจำเป็น
12. **Legal basis**: ก่อนใช้งานจริงให้ผู้เชี่ยวชาญพัสดุตรวจแบบทุกฉบับ เทียบกฎหมาย/หนังสือเวียนที่มีผล ณ วันทำรายการ และเงื่อนไข e-GP รวมทั้งกรณีวงเงินเท่ากับ 5,000 บาท; วงเงินต่อรายการในแอปไม่ใช่เหตุอนุญาตให้แบ่งซื้อแบ่งจ้าง

## แม่แบบเอกสารเริ่มต้นจากภาพตัวอย่าง
- **จัดซื้อ (6)**: รายงานขอซื้อ; รายละเอียดพัสดุแนบท้าย; รายงานผลการพิจารณาและขออนุมัติสั่งซื้อ; ใบตรวจรับพัสดุ; บันทึกขออนุมัติเบิกจ่าย; ใบเบิกพัสดุ
- **จัดจ้าง (5)**: รายงานขอจ้าง; รายละเอียดงานจ้างแนบท้าย; รายงานผลการพิจารณาและขออนุมัติสั่งจ้าง; ใบตรวจรับงานจ้าง; บันทึกขออนุมัติเบิกจ่าย
- ผู้ตรวจรับเว้นชื่อ/พิมพ์เองได้; ข้อมูลส่งมอบ/เลขใบเสร็จ/ภาษี/วันที่ตรวจรับไม่ควรสร้างขึ้นเองก่อนมีหลักฐาน
- บันทึกเลือกเอกสารตามประเภทงานและข้อเท็จจริง; ใบเบิกพัสดุไม่ใช่เอกสารที่จำเป็นกับทุกการจ้าง

## โครงสร้างข้อมูล SaaS ที่เสนอ
- schools(id, name, province, active, fiscal_settings, package_id)
- users(id, account_credentials)
- memberships(user_id, school_id, role, active) [unique(user_id,school_id)]
- school_signers(id,school_id,person_name,position,from_date,to_date,appointment_ref)
- series(id,school_id,kind,code,start_number,reset_period)
- counters(school_id,series_id,fiscal_year,last_number) [primary key]
- records(id,school_id,kind,series_id,number,fiscal_year,title,reason,budget,method,amount_satang,vendor_id,stage,created_by,version)
- record_items(id,school_id,record_id,description,qty,unit,price_satang)
- record_signer_snapshots(record_id,role,name,position,appointment_ref)
- approvals(id,school_id,record_id,action,actor_id,action_date,evidence_file_id)
- document_versions(id,school_id,record_id,template_type,version,file_id,hash,generated_at)
- files(id,school_id,storage_provider,external_id,privacy,hash,mime,size)
- audit_logs(id,school_id,actor_id,action,object_type,object_id,old_value,new_value,reason,occurred_at)
- subscriptions(id,school_id,plan_id,status,renewal_date)

## เปลี่ยนจากแอปโรงเรียนเดียวเป็น SaaS
แอป Express รุ่นก่อนหน้าเก็บผู้ใช้และ settings แบบรวมโรงเรียนเดียว จึง **ยังไม่ปลอดภัยสำหรับ multi-tenant** หากนำไปขายหรือให้หลายโรงเรียนใช้ร่วมกันทันที ห้ามนำ schema ที่มีอยู่ไปเปิดให้หลายโรงเรียนใช้โดยเพิ่มแค่ dropdown เลือกโรงเรียน

ลำดับที่ปลอดภัย:
1. เก็บระบบ production เดิมไว้ไม่เปลี่ยนฐานข้อมูล
2. ตั้ง database staging ใหม่และเพิ่ม school_id / memberships / server-side authorization
3. เขียน integration tests school A/B ทุก endpoint (รวม print, attachments, search, audit)
4. เพิ่มระบบเชิญผู้ใช้, Super Admin, แพ็กเกจ, ผู้อำนวยการ และผู้ตรวจรับ
5. ตรวจแม่แบบเอกสารโดยงานพัสดุ/การเงินและสร้าง regression tests ของ PDF A4
6. เมื่อผ่านจึงย้ายข้อมูลเดิมด้วย migration ที่กำหนดโรงเรียนและ backup ให้ครบ
7. จึงเปิดใช้งาน pilot กับเจ้าหน้าที่ 3 คนพร้อมกัน แล้วค่อยเปิด SaaS

## สถานะ PR นี้
**เสร็จในสาขาพัฒนา:** รีแบรนด์ชื่อครูพัสดุ; UI styles; ปรับแม่แบบงานซื้อและงานจ้างตามเอกสาร 6/5 ชุด; เว้นชื่อผู้ตรวจรับ; พิมพ์และบันทึก PDF ผ่านเบราว์เซอร์

**ยังไม่เสร็จ:** SaaS multi-tenant; Super Admin; Google Drive OAuth; PDF generation server-side; ลายเซ็นอิเล็กทรอนิกส์; อนุมัติหลายขั้น; เก็บวันส่งมอบและเลขใบเสร็จแบบ field; การตรวจรับแบบราชการจริง; แบบเอกสารที่ผ่านการตรวจข้อกฎหมาย; ทดสอบพิมพ์ A4 กับครุฑ/ฟอนต์จริง

หมายเหตุ: การคลิกพิมพ์ใช้ browser print/save as PDF ยังไม่สร้างไฟล์ PDF ลง server/Drive โดยอัตโนมัติ
