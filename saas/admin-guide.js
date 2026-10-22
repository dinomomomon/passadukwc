/* Private school-admin guide: illustrated mock-ups only. No user data is accessed.
 * Actual navigation into settings is delegated to app.js and its existing role gate. */
const escape=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const adminGuideTopics=[
 {id:'school',icon:'🏫',title:'ตั้งค่าระบบและข้อมูลโรงเรียน',subtitle:'ข้อมูลพื้นฐาน โลโก้โรงเรียน รหัสหนังสือ และข้อมูลที่อยู่',action:'settings',target:'ข้อมูลโรงเรียน',
 steps:[
  {heading:'เปิดเมนูข้อมูลโรงเรียน',desc:'เลือก “ข้อมูลโรงเรียน” จากแถบเมนูด้านซ้าย (เข้าสู่ระบบด้วยบัญชีแอดมินโรงเรียนก่อน)',focus:'ข้อมูลโรงเรียน',fields:[['เมนูที่ใช้','ข้อมูลโรงเรียน'],['สิทธิ์ที่ต้องมี','แอดมินโรงเรียน']],button:'เปิดหน้าตั้งค่า'},
  {heading:'กรอกข้อมูลสถานศึกษา',desc:'กรอกชื่อโรงเรียน อำเภอ จังหวัด และที่อยู่สำหรับออกเอกสารให้ตรงข้อมูลจริง',focus:'ชื่อโรงเรียน',fields:[['ชื่อโรงเรียน','โรงเรียนตัวอย่าง'],['อำเภอ','เมือง'],['จังหวัด','เชียงใหม่'],['ที่อยู่โรงเรียนสำหรับเอกสาร','ตามที่อยู่จริง']],button:'บันทึกข้อมูลโรงเรียน'},
  {heading:'ตั้งรหัสหนังสือและโลโก้',desc:'รหัสหนังสือใส่เฉพาะคำย่อ เช่น พว. ไม่รวมเลข 1/2569 และไฟล์โลโก้ใช้ที่หน้าเว็บเท่านั้น',focus:'รหัสหนังสือ',fields:[['รหัสหนังสือเท่านั้น','พว.'],['โลโก้โรงเรียน','อัปโหลด PNG / JPG / WEBP'],['ข้อจำกัดไฟล์','ไม่เกิน 1 MB']],button:'อัปโหลดโลโก้โรงเรียน'},
  {heading:'บันทึกและตรวจทาน',desc:'กดบันทึกข้อมูลโรงเรียน แล้วตรวจชื่อและรหัสที่หัวเอกสารตัวอย่าง ก่อนใช้งานจริง',focus:'บันทึกข้อมูลโรงเรียน',fields:[['ข้อมูลสถานศึกษา','ตรวจสอบครบแล้ว'],['รหัสหนังสือ','พว.'],['ตรวจตัวอย่าง','เปิดดู A4']],button:'บันทึกข้อมูลโรงเรียน'}],
 note:'การแก้ข้อมูลโรงเรียนไม่ได้หมายความว่าเอกสารราชการที่ออกไปแล้วได้รับการแก้ไขหรืออนุมัติย้อนหลัง'},
 {id:'signers',icon:'✍️',title:'ตั้งค่าผู้ลงนาม',subtitle:'กำหนดชื่อผู้เกี่ยวข้องให้แสดงบนแบบฟอร์มโดยอัตโนมัติ',action:'settings',target:'ข้อมูลโรงเรียน',
 steps:[
  {heading:'เข้าหน้าข้อมูลโรงเรียน',desc:'ในเมนูข้อมูลโรงเรียน เลื่อนลงมาที่ส่วน “ชื่อผู้ลงนาม”',focus:'ชื่อผู้ลงนาม',fields:[['เมนู','ข้อมูลโรงเรียน'],['ส่วนของฟอร์ม','ชื่อผู้ลงนาม']],button:'เลื่อนมายังผู้ลงนาม'},
  {heading:'ใส่ชื่อเจ้าหน้าที่และหัวหน้า',desc:'กรอกชื่อ–นามสกุลของเจ้าหน้าที่พัสดุและหัวหน้าเจ้าหน้าที่ตามคำสั่งมอบหมาย',focus:'เจ้าหน้าที่พัสดุ',fields:[['เจ้าหน้าที่พัสดุ','นายเจ้าหน้าที่ ตัวอย่าง'],['หัวหน้าเจ้าหน้าที่พัสดุ','นางสาวหัวหน้า ตัวอย่าง']],button:'ตรวจชื่อให้ถูกต้อง'},
  {heading:'ใส่ชื่อผู้อำนวยการและการเงิน',desc:'กรอกชื่อผู้อำนวยการสถานศึกษาและเจ้าหน้าที่การเงิน หากมีการเปลี่ยนตัวบุคคลให้แก้ข้อมูลก่อนสร้างรายการใหม่',focus:'ผู้อำนวยการสถานศึกษา',fields:[['ผู้อำนวยการสถานศึกษา','นางสาวผู้อำนวยการ ตัวอย่าง'],['เจ้าหน้าที่การเงิน','นางสาวการเงิน ตัวอย่าง']],button:'บันทึกข้อมูลโรงเรียน'},
  {heading:'ตรวจชื่อใต้บล็อกลายเซ็น',desc:'เปิดรายการตัวอย่างหรือฉบับร่าง และดูหน้า A4 ตรวจชื่อและตำแหน่งทุกตำแหน่งอีกครั้ง',focus:'บล็อกลายเซ็น',fields:[['ลงชื่อ','..............................'],['ชื่อผู้ลงนาม','(นางสาวหัวหน้า ตัวอย่าง)'],['ตำแหน่ง','หัวหน้าเจ้าหน้าที่']],button:'ดูตัวอย่าง A4'}],
 note:'ชื่อที่ปรากฏเป็นข้อมูลประกอบแบบฟอร์ม ไม่ใช่ลายมือชื่อจริง และไม่ควรตีความว่าได้รับอนุมัติแล้ว'},
 {id:'numbers',icon:'#️⃣',title:'ตั้งค่าเลขทะเบียนคุม',subtitle:'เลขเริ่มต้น ปีงบประมาณ และลำดับอัตโนมัติของแต่ละทะเบียน',action:'registry',target:'ทะเบียนคุมเลขเอกสาร',
 steps:[
  {heading:'เปิดทะเบียนคุมเลข',desc:'คลิก “ทะเบียนคุมเลขเอกสาร” ที่เมนูด้านซ้าย แล้วเปิดส่วน “กำหนดเลขถัดไปอัตโนมัติ (แอดมินโรงเรียน)”',focus:'กำหนดเลขถัดไปอัตโนมัติ',fields:[['เมนู','ทะเบียนคุมเลขเอกสาร'],['สิทธิ์','แอดมินโรงเรียน']],button:'กำหนดเลขถัดไปอัตโนมัติ'},
  {heading:'เลือกปี พ.ศ.',desc:'กรอกปี พ.ศ. ของทะเบียนที่ต้องการ เช่น 2570 แล้วกด “ดูเลขของปีนี้” เพื่ออ่านเลขสูงสุดที่เคยออก',focus:'ปี พ.ศ.',fields:[['ปี พ.ศ.','2570'],['เลขที่ใช้แล้ว','ตรวจสอบก่อนตั้งต้น']],button:'ดูเลขของปีนี้'},
  {heading:'กำหนดเลขถัดไปตามประเภท',desc:'ระบบมี 4 ทะเบียน: คำขอ (พว./พค. ใช้ลำดับร่วมกัน), หนังสือทั่วไป (รายงานผล/เบิกจ่าย), ใบตรวจรับ (ร.) และใบเบิก (จ.) ไม่ได้ตั้ง พว. กับ พค. แยกเลขเริ่มต้น',focus:'เลขถัดไป',fields:[['คำขอ พว. / พค.','เช่น 15'],['หนังสือทั่วไป','เช่น 21'],['ใบตรวจรับ ร.','เช่น 8'],['ใบเบิก จ.','เช่น 4']],button:'บันทึกเลขถัดไป'},
  {heading:'ยืนยันและตรวจเลขทะเบียน',desc:'ตรวจเลขก่อนกดยืนยัน ระบบไม่ยอมให้ตั้งเลขย้อนกลับหรือนำเลขที่ใช้แล้วกลับมาใช้ซ้ำ',focus:'บันทึกเลขถัดไป',fields:[['เลขถัดไป','ต้องมากกว่าเลขที่จัดสรรแล้ว'],['สถานะทะเบียน','ใช้แล้ว / จองเลข / ยกเลิก']],button:'ยืนยันการตั้งค่า'}],
 note:'พว. และ พค. เป็นรหัสบนหัวรายงานตามหมวดรายการ แต่ใช้ตัวนับคำขอร่วมกัน เลขหนังสือทั่วไปของรายงานผลกับบันทึกเบิกจ่ายก็ใช้ทะเบียนร่วมกัน'},
 {id:'templates',icon:'📄',title:'แก้ไขแม่แบบเอกสาร',subtitle:'เลือกแบบฟอร์ม ปรับข้อความ จัดวางบล็อก ทดสอบ และประกาศใช้',action:'templates',target:'แม่แบบเอกสาร',
 steps:[
  {heading:'เปิดเมนูแม่แบบเอกสาร',desc:'คลิก “แม่แบบเอกสาร” แล้วเลือกแท็บเอกสารหนึ่งใน 6 ประเภทที่ต้องการปรับ',focus:'เลือกประเภทเอกสาร',fields:[['แท็บเอกสาร','รายงานขอซื้อ / ขอจ้าง'],['เอกสารอื่น','แนบท้าย / พิจารณา / ตรวจรับ / เบิกจ่าย']],button:'เลือกแม่แบบ'},
  {heading:'ปรับบล็อกที่แก้ไขได้',desc:'เลือกบล็อกด้านซ้ายหรือข้อความในหน้า A4 จากนั้นใช้เครื่องมือปรับตัวหนา การจัดข้อความ ขนาด และตำแหน่งตามส่วนที่อนุญาต',focus:'บล็อกเอกสาร',fields:[['บล็อกเอกสาร','ลาก / ขึ้น / ลง'],['จัดรูปแบบ','B · ซ้าย · กลาง · ขวา'],['ขนาดตัวอักษร','16 pt']],button:'แก้ข้อความ'},
  {heading:'บันทึกฉบับร่าง',desc:'กด “บันทึกฉบับร่าง” เพื่อเก็บการแก้ไขไว้เฉพาะโรงเรียน โดยยังไม่เปลี่ยนแม่แบบที่ใช้งานจริง',focus:'บันทึกฉบับร่าง',fields:[['สถานะ','ฉบับร่าง'],['ตัวอย่าง A4','ตรวจข้อความและบล็อกผู้ลงนาม']],button:'💾 บันทึกฉบับร่าง'},
  {heading:'ตรวจและประกาศใช้',desc:'ตรวจตัวอย่าง A4 และทดลองพิมพ์ PDF หากตรงตามแบบแล้วจึงกด “ประกาศใช้แม่แบบนี้” หากไม่ตรงให้คืนเวอร์ชันหรือคืนค่าแบบกลาง',focus:'ประกาศใช้แม่แบบนี้',fields:[['ตรวจ PDF','A4 / ข้อความ / ลายเซ็น'],['ประวัติ','ประวัติ / คืนเวอร์ชัน'],['คืนค่า','คืนค่าแบบกลาง']],button:'ประกาศใช้แม่แบบนี้'}],
 note:'ชื่อบุคคล ตำแหน่ง เลขเอกสาร วันที่ และยอดเงินที่ดึงจากระบบเป็นฟิลด์ล็อก ไม่ควรพิมพ์ทับในแม่แบบ เพราะทำให้เอกสารคลาดเคลื่อน'},
 {id:'users',icon:'👥',title:'จัดการผู้ใช้งานและสิทธิ์',subtitle:'เพิ่มบัญชี แก้ข้อมูล กำหนดบทบาท ปิดสิทธิ์ และลบผู้ใช้',action:'members',target:'จัดการผู้ใช้งาน',
 steps:[
  {heading:'เปิดจัดการผู้ใช้งาน',desc:'คลิก “จัดการผู้ใช้งาน” ระบบจะแสดงรายชื่อบุคลากรของโรงเรียนนี้และแบบฟอร์มเพิ่มเจ้าหน้าที่',focus:'เพิ่มเจ้าหน้าที่โรงเรียน',fields:[['เมนู','จัดการผู้ใช้งาน'],['สมาชิก','เฉพาะโรงเรียนปัจจุบัน']],button:'เพิ่มเจ้าหน้าที่โรงเรียน'},
  {heading:'กรอกชื่อ อีเมล และรหัสผ่าน',desc:'กรอกข้อมูลบัญชีใหม่ให้ครบ โดยรหัสผ่านต้องอย่างน้อย 6 ตัวอักษร พร้อมยืนยันรหัสผ่านอีกครั้ง',focus:'อีเมลสำหรับเข้าสู่ระบบ',fields:[['ชื่อ–นามสกุล','นางสาวตัวอย่าง ผู้ใช้งาน'],['อีเมลสำหรับเข้าสู่ระบบ','staff@example.org'],['กำหนดรหัสผ่าน','••••••••'],['ยืนยันรหัสผ่าน','••••••••']],button:'ตรวจข้อมูลบัญชี'},
  {heading:'เลือกบทบาทผู้ใช้งาน',desc:'กำหนดหน้าที่ในระบบให้ตรงงาน เช่น แอดมินโรงเรียน เจ้าหน้าที่พัสดุ หัวหน้าเจ้าหน้าที่ ผู้อำนวยการ การเงิน หรือผู้ตรวจรับ',focus:'หน้าที่ในระบบ',fields:[['หน้าที่ในระบบ','เจ้าหน้าที่พัสดุ'],['สิทธิ์อื่น','แอดมิน / หัวหน้า / ผอ. / การเงิน / ตรวจรับ']],button:'+ สร้างบัญชีและให้สิทธิ์ใช้งาน'},
  {heading:'แก้ไข เปลี่ยนรหัส หรือปิดสิทธิ์',desc:'ในตารางสมาชิกกด แก้ไข เปลี่ยนรหัสผ่าน ปิดสิทธิ์/เปิดสิทธิ์ หรือลบตามความจำเป็น ระบบไม่อนุญาตให้ลบหรือปิดสิทธิ์บัญชีตนเอง',focus:'จัดการ',fields:[['รายชื่อผู้ใช้','นางสาวตัวอย่าง ผู้ใช้งาน'],['สถานะ','ใช้งานได้'],['จัดการ','แก้ไข · เปลี่ยนรหัสผ่าน · ปิดสิทธิ์ · ลบ']],button:'บันทึกการแก้ไข'}],
 note:'ลบบัญชีเป็นการถอนสิทธิ์ออกจากโรงเรียน ไม่ได้ลบประวัติเอกสารราชการ ควรส่งรหัสผ่านผ่านช่องทางส่วนตัวและให้ผู้ใช้เปลี่ยนรหัสหลังเข้าใช้'}
];
export const adminGuideIds=adminGuideTopics.map(t=>t.id);
const iconMark='◉';
const graphic=(step,topic,stepNo)=>'<figure class="kp-ag-graphic" role="group" aria-label="ภาพอธิบายขั้นตอนที่ '+stepNo+' '+escape(step.heading)+'">'+
 '<div class="kp-ag-window"><div class="kp-ag-browser"><span class="kp-ag-dots">● ● ●</span><b>ครูพัสดุ · ภาพจำลองหน้าจอ</b><span class="kp-ag-window-k">สาธิต</span></div>'+
 '<div class="kp-ag-window-body"><aside class="kp-ag-mini-sidebar"><strong>ครูพัสดุ</strong><span>ภาพรวม</span><span>ทะเบียนจัดซื้อจัดจ้าง</span><span class="'+(topic.target.includes('เลข')?'kp-ag-side-selected':'')+'">ทะเบียนคุมเลขเอกสาร</span><span class="'+(topic.target==='จัดการผู้ใช้งาน'?'kp-ag-side-selected':'')+'">จัดการผู้ใช้งาน</span><span class="'+(topic.target==='แม่แบบเอกสาร'?'kp-ag-side-selected':'')+'">แม่แบบเอกสาร</span><span class="'+(topic.target==='ข้อมูลโรงเรียน'?'kp-ag-side-selected':'')+'">ข้อมูลโรงเรียน</span></aside>'+
 '<div class="kp-ag-mini-main"><div class="kp-ag-mini-heading">'+escape(topic.target)+'<span class="kp-ag-mini-chip">ตัวอย่าง</span></div>'+
 '<div class="kp-ag-mini-rows">'+step.fields.map(([label,value])=>'<div class="kp-ag-mini-row '+(label===(step.fields.some(x=>x[0]===step.focus)?step.focus:step.fields[0][0])?'kp-ag-highlight':'')+'"><div><small>'+escape(label)+'</small><span>'+escape(value)+'</span></div>'+(label===(step.fields.some(x=>x[0]===step.focus)?step.focus:step.fields[0][0])?'<b class="kp-ag-orange-pin">'+stepNo+'</b>':'')+'</div>').join('')+'</div>'+
 '<div class="kp-ag-mini-bottom"><span>ตรวจข้อมูลก่อนดำเนินการจริง</span><span class="kp-ag-illustrated-button '+(step.focus===step.button?'kp-ag-highlight-button':'')+'">'+escape(step.button)+'</span></div></div></div></div>'+
 '<figcaption>ภาพประกอบจำลองจากหน้าฟอร์มระบบ ไม่ใช่ข้อมูลผู้ใช้จริง</figcaption></figure>';
export function adminGuideHtml(selected='overview'){
 const current=adminGuideTopics.find(t=>t.id===selected);
 const subnav='<nav class="kp-ag-subnav" aria-label="เมนูย่อยคู่มือแอดมิน">'+
  '<button type="button" class="'+(!current?'is-active':'')+'" data-action="admin-guide-section" data-section="overview">⌂ ภาพรวมคู่มือ</button>'+
  adminGuideTopics.map((t,i)=>'<button type="button" class="'+(current?.id===t.id?'is-active':'')+'" data-action="admin-guide-section" data-section="'+t.id+'"><span>'+String(i+1).padStart(2,'0')+'</span>'+escape(t.title)+'</button>').join('')+'</nav>';
 const body=!current?
  '<div class="kp-ag-welcome"><span class="kp-ag-eyebrow">สำหรับบัญชีแอดมินโรงเรียนเท่านั้น</span><h2>ตั้งค่าครูพัสดุให้พร้อม<br><em>ก่อนเริ่มใช้งานจริง</em></h2><p>คู่มือภาพทีละขั้น ครบตั้งแต่ข้อมูลโรงเรียน ผู้ลงนาม เลขทะเบียน แม่แบบเอกสาร ไปจนถึงกำหนดสิทธิ์เจ้าหน้าที่</p>'+
   '<div class="kp-ag-progress"><span>5 หัวข้อหลัก</span><span>20 ขั้นตอนพร้อมภาพ</span><span>กดไปหน้าตั้งค่าจริงได้</span></div></div>'+
   '<div class="kp-ag-topic-grid">'+adminGuideTopics.map((t,i)=>'<button type="button" class="kp-ag-topic-card" data-action="admin-guide-section" data-section="'+t.id+'"><span class="kp-ag-topic-count">'+String(i+1).padStart(2,'0')+'</span><span class="kp-ag-topic-emoji" aria-hidden="true">'+t.icon+'</span><strong>'+escape(t.title)+'</strong><small>'+escape(t.subtitle)+'</small><span class="kp-ag-topic-open">ดูภาพทีละขั้น →</span></button>').join('')+'</div>':
  '<article class="kp-ag-lesson"><header class="kp-ag-lesson-head"><span class="kp-ag-lesson-icon" aria-hidden="true">'+current.icon+'</span><div><span class="kp-ag-eyebrow">คู่มือแอดมิน • '+String(adminGuideTopics.indexOf(current)+1).padStart(2,'0')+' / 05</span><h2>'+escape(current.title)+'</h2><p>'+escape(current.subtitle)+'</p></div>'+
   '<button type="button" data-action="admin-guide-open" data-target="'+current.action+'" class="kp-ag-live-button">ไปยังเมนูจริง ↗</button></header>'+
   '<div class="kp-ag-target"><span>คลิกในระบบจริงตามเส้นทาง</span><strong>เมนูด้านซ้าย → '+escape(current.target)+'</strong></div>'+
   '<div class="kp-ag-step-list">'+current.steps.map((step,i)=>'<section class="kp-ag-step"><div class="kp-ag-step-header"><span class="kp-ag-step-no">'+(i+1)+'</span><div><h3>'+escape(step.heading)+'</h3><p>'+escape(step.desc)+'</p></div></div>'+
   graphic(step,current,i+1)+'</section>').join('')+'</div>'+
   '<div class="kp-ag-important"><strong>ข้อควรระวัง</strong><p>'+escape(current.note)+'</p></div>'+
   '<div class="kp-ag-lesson-actions"><button type="button" data-action="admin-guide-section" data-section="overview">← กลับสารบัญ</button>'+
   '<button type="button" data-action="admin-guide-open" data-target="'+current.action+'">เปิดเมนูจริง ↗</button></div></article>';
 return '<div class="kp-admin-guide">'+subnav+'<section class="kp-ag-body">'+body+'</section></div>';
}
