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
  '<div class="kp-ug-pending" role="status"><span class="kp-ug-pending-icon" aria-hidden="true">📖</span>'+
  '<h3>เตรียมพื้นที่สำหรับคู่มือหัวข้อนี้แล้ว</h3>'+
  '<p>รายละเอียด ขั้นตอน และภาพประกอบจะเพิ่มเติมตามข้อมูลที่ผู้ดูแลระบบกำหนด</p>'+
  '<p class="kp-ug-pending-note">ขณะนี้ยังไม่มีภาพประกอบหรือขั้นตอนการใช้งานในหัวข้อนี้</p></div>'+
  '<div class="kp-ag-lesson-actions">'+
  '<button type="button" data-action="user-guide-section" data-section="create">กลับหัวข้อแรก</button>'+open+'</div></article>';
 return '<div class="kp-admin-guide kp-user-guide">'+subnav+'<section class="kp-ag-body">'+detail+'</section></div>';
}
