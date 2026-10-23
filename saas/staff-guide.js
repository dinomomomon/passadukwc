/* Staff-facing manual shell. Content is intentionally pending school-approved walkthroughs.
 * No sample forms, screenshots or generated procurement data are shown here. */
const escapeGuide=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const staffGuideTopics=[
 {id:'create',icon:'✚',title:'การสร้างรายการใหม่',action:'create'},
 {id:'records',icon:'▤',title:'ทะเบียนจัดซื้อจัดจ้าง',action:'records'},
 {id:'registry',icon:'№',title:'ทะเบียนคุมเลขเอกสาร',action:'registry'}
];
export const staffGuideIds=staffGuideTopics.map(t=>t.id);
export function staffGuideHtml(selected='create',{canOpenMenu=true}={}){
 const current=staffGuideTopics.find(t=>t.id===selected)||staffGuideTopics[0];
 const activeIndex=staffGuideTopics.indexOf(current)+1;
 const subnav='<nav class="kp-ag-subnav" aria-label="หัวข้อคู่มือผู้ใช้งาน">'+
  staffGuideTopics.map((topic,index)=>
   '<button type="button" class="'+(topic.id===current.id?'is-active':'')+'" data-action="user-guide-section" data-section="'+escapeGuide(topic.id)+'"'+
   ' aria-current="'+(topic.id===current.id?'page':'false')+'"><span>'+String(index+1).padStart(2,'0')+'</span>'+escapeGuide(topic.title)+'</button>').join('')+'</nav>';
 const open=canOpenMenu?'<button type="button" class="kp-ag-live-button" data-action="user-guide-open" data-target="'+escapeGuide(current.action)+'">เปิดเมนูจริง ↗</button>':'';
 const detail='<article class="kp-ag-lesson kp-ug-lesson"><header class="kp-ag-lesson-head">'+
  '<span class="kp-ag-lesson-icon" aria-hidden="true">'+current.icon+'</span><div>'+
  '<span class="kp-ag-eyebrow">คู่มือผู้ใช้งาน • '+String(activeIndex).padStart(2,'0')+' / 03</span>'+
  '<h2>'+escapeGuide(current.title)+'</h2><p>หัวข้อคู่มือสำหรับผู้ใช้งานระบบครูพัสดุ</p></div>'+open+'</header>'+
  (current.id==='create'?
    '<div class="kp-ug-infographics">'+
     '<p class="kp-ug-intro">คู่มือการสร้างรายการจัดซื้อจัดจ้าง มี 4 ขั้นตอน แบ่งภาพประกอบเป็น 2 ส่วน โดยยึดชื่อช่องกรอกจากระบบจริง</p>'+
     '<figure class="kp-ug-figure"><a href="/staff-guide-create-1.svg" class="kp-ag-infographic-link" target="_blank" rel="noopener noreferrer" title="เปิดภาพคู่มือขั้นที่ 1–2 ขนาดเต็ม">'+
      '<img src="/staff-guide-create-1.svg" width="1500" height="1290" loading="eager" alt="คู่มือการสร้างรายการใหม่ ขั้นที่ 1 ข้อมูลหลัก และขั้นที่ 2 รายการพัสดุ พร้อมภาพตัวอย่างหน้าจอและคำอธิบายภาษาไทย"></a>'+
      '<figcaption>ส่วนที่ 1 • ขั้นที่ 1–2 — ข้อมูลหลักและรายการพัสดุ • คลิกภาพเพื่อเปิดขนาดเต็ม</figcaption></figure>'+
     '<figure class="kp-ug-figure"><a href="/staff-guide-create-2.svg" class="kp-ag-infographic-link" target="_blank" rel="noopener noreferrer" title="เปิดภาพคู่มือขั้นที่ 3–4 ขนาดเต็ม">'+
      '<img src="/staff-guide-create-2.svg" width="1500" height="1290" loading="lazy" alt="คู่มือการสร้างรายการใหม่ ขั้นที่ 3 ผู้ขายและผู้ตรวจรับ และขั้นที่ 4 เลขที่หนังสือและตรวจสอบ พร้อมภาพตัวอย่างหน้าจอและคำอธิบายภาษาไทย"></a>'+
      '<figcaption>ส่วนที่ 2 • ขั้นที่ 3–4 — ผู้ขายและผู้ตรวจรับ เลขหนังสือและตรวจสอบ • คลิกภาพเพื่อเปิดขนาดเต็ม</figcaption></figure>'+
     '<p class="kp-ag-infographic-hint">หมายเหตุ: ภาพเป็นการจัดวางช่องกรอกตามหน้าจอระบบจริงโดยใช้ข้อมูลสมมติ รหัสหนังสือและหมวดพัสดุขึ้นอยู่กับการตั้งค่าของโรงเรียน และเลขหนังสือออกโดยทะเบียนคุมเลข</p>'+
    '</div>':current.id==='records'?
    '<div class="kp-ug-infographics">'+
     '<p class="kp-ug-intro">คู่มือทะเบียนจัดซื้อจัดจ้าง 2 ส่วน ครอบคลุมการค้นหา การเปิดดูรายการ และการพิมพ์หรือบันทึกเอกสาร PDF โดยใช้ข้อมูลสมมติประกอบ</p>'+
     '<figure class="kp-ug-figure"><a href="/staff-guide-records-1.svg" class="kp-ag-infographic-link" target="_blank" rel="noopener noreferrer" title="เปิดภาพคู่มือทะเบียนจัดซื้อจัดจ้าง ส่วนที่ 1 ขนาดเต็ม">'+
      '<img src="/staff-guide-records-1.svg" width="1540" height="1290" loading="eager" alt="คู่มือทะเบียนจัดซื้อจัดจ้าง ส่วนที่ 1 การค้นหารายการ เปิดดูรายละเอียด และตรวจสอบข้อมูลสรุป"></a>'+
      '<figcaption>ส่วนที่ 1 • ค้นหารายการและเปิดดูรายละเอียด • คลิกภาพเพื่อเปิดขนาดเต็ม</figcaption></figure>'+
     '<figure class="kp-ug-figure"><a href="/staff-guide-records-2.svg" class="kp-ag-infographic-link" target="_blank" rel="noopener noreferrer" title="เปิดภาพคู่มือทะเบียนจัดซื้อจัดจ้าง ส่วนที่ 2 ขนาดเต็ม">'+
      '<img src="/staff-guide-records-2.svg" width="1540" height="1290" loading="lazy" alt="คู่มือทะเบียนจัดซื้อจัดจ้าง ส่วนที่ 2 ตรวจสอบชุดเอกสารและบันทึกเป็นไฟล์ PDF"></a>'+
      '<figcaption>ส่วนที่ 2 • ตรวจสอบชุดเอกสาร พิมพ์ และบันทึก PDF • คลิกภาพเพื่อเปิดขนาดเต็ม</figcaption></figure>'+
     '<p class="kp-ag-infographic-hint">ตัวอย่างภาพประกอบเป็นข้อมูลสมมติ ปุ่มแก้ไขและลบจะแสดงตามสิทธิ์ของผู้ใช้งานและสถานะรายการ และการพิมพ์หรือบันทึก PDF ต้องตรวจสอบข้อมูลในเอกสารจริงก่อนทุกครั้ง</p>'+
    '</div>':
    '<div class="kp-ug-pending" role="status"><span class="kp-ug-pending-icon" aria-hidden="true">📖</span>'+
     '<h3>เตรียมพื้นที่สำหรับคู่มือหัวข้อนี้แล้ว</h3>'+
     '<p>รายละเอียด ขั้นตอน และภาพประกอบจะเพิ่มเติมตามข้อมูลที่ผู้ดูแลระบบกำหนด</p>'+
     '<p class="kp-ug-pending-note">ขณะนี้ยังไม่มีภาพประกอบหรือขั้นตอนการใช้งานในหัวข้อนี้</p></div>')+
  '<div class="kp-ag-lesson-actions">'+
  '<button type="button" data-action="user-guide-section" data-section="create">กลับหัวข้อแรก</button>'+open+'</div></article>';
 return '<div class="kp-admin-guide kp-user-guide">'+subnav+'<section class="kp-ag-body">'+detail+'</section></div>';
}
