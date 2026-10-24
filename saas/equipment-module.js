import {depreciation,yearDepreciation,assetInput,cents,importHeaders,rowsToAssets} from './asset-engine.js';
import {readSpreadsheet,saveCsvFile} from './asset-import.js';
export function createEquipmentModule({db,state,shell,heading,e,notify,isSchoolAdmin,canWrite,printRoot}){
 const today=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
 const fiscal=()=>{const d=new Date(Date.now()+7*3600000);return d.getUTCFullYear()+543+(d.getUTCMonth()>=9?1:0);};
 const cash=n=>(Number(n||0)/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
 const st={active:'ใช้งานปกติ',repair:'ส่งซ่อม',transferred:'โอนย้าย',disposed:'จำหน่าย',lost:'สูญหาย'};
 const b=(name,action,cls='secondary',attrs='')=>'<button type="button" class="'+cls+'" data-action="'+action+'" '+attrs+'>'+name+'</button>';
 const f=(label,key,val='',type='text',attrs='')=>'<label class="eq-field"><span>'+e(label)+'</span><input class="input" name="'+key+'" type="'+type+'" value="'+e(String(val??''))+'" '+attrs+'></label>';
 const select=(label,key,opts,current='')=>'<label class="eq-field"><span>'+e(label)+'</span><select class="select" name="'+key+'">'+opts.map(([v,n])=>'<option value="'+e(String(v))+'" '+(String(v)===String(current)?'selected':'')+'>'+e(n)+'</option>').join('')+'</select></label>';
 const store={id:null,rows:[],cats:[],policy:{capitalization_threshold_satang:1000000,policy_confirmed:false},year:fiscal(),query:'',status:'all',editing:null,source:null,prefill:null,preview:[],errors:[],selected:null,editCategory:null};
 const can=()=>state.demo||canWrite();
 const category=x=>store.cats.find(c=>c.id===x.category_id)?.name||'ไม่ระบุประเภท';
 const flags=()=>!store.policy.policy_confirmed?'<div class="eq-caution">โปรดให้แอดมินยืนยันเกณฑ์รับรู้สินทรัพย์และอายุการใช้งานตามนโยบายบัญชีต้นสังกัดก่อนนำรายงานค่าเสื่อมไปใช้อ้างอิง</div>':'';
 const tabs=()=>'<nav class="eq-tabs">'+[['overview','ภาพรวม'],['registry','ทะเบียน'],['import','เพิ่ม / นำเข้า'],['depreciation','ค่าเสื่อม'],['report','รายงาน A4'],...(isSchoolAdmin()?[['settings','ตั้งค่า']]:[])].map(([s,l])=>b(l,'asset-section',state.assetSection===s?'eq-tab active':'eq-tab','data-section="'+s+'"')).join('')+'</nav>';
 const layout=(name,subtitle,html,actions='')=>shell(name,'ทะเบียนคุมครุภัณฑ์',heading(name,subtitle,actions)+tabs()+flags()+html);
 const demo=()=>[{id:'demo-equipment-1',school_id:'demo-school',asset_code:'คพ-001/2570',name:'เครื่องคอมพิวเตอร์ตัวอย่าง',cost_satang:2800000,salvage_satang:0,useful_life_months:60,acquired_on:'2026-10-01',placed_in_service_on:'2026-10-01',asset_status:'active',accounting_class:'capitalized',category_id:null,location:'ห้องตัวอย่าง',responsible_person:'ครูตัวอย่าง',serial_number:'',notes:'ข้อมูลสมมติ'}];
 async function load(){
  const sid=state.school?.id;if(!sid)throw Error('กรุณาเลือกโรงเรียนก่อน');
  if(store.id!==sid){store.id=sid;store.rows=[];store.cats=[];store.preview=[];store.editing=null;store.policy={capitalization_threshold_satang:1000000,policy_confirmed:false};}
  if(state.demo){if(!store.rows.length)store.rows=demo();return;}
  const [cat,policy]=await Promise.all([db.from('asset_categories').select('*').eq('school_id',sid).order('name'),db.from('asset_policies').select('*').eq('school_id',sid).maybeSingle()]);
  if(cat.error||policy.error)throw Error(cat.error?.message||policy.error?.message);
  store.cats=cat.data||[];store.policy=policy.data||{capitalization_threshold_satang:1000000,policy_confirmed:false};
  const rows=[];for(let start=0;start<10000;start+=500){
   const {data,error}=await db.from('equipment_assets').select('*').eq('school_id',sid).order('created_at',{ascending:false}).range(start,start+499);
   if(error)throw Error('โหลดทะเบียนไม่สำเร็จ: '+error.message);
   rows.push(...(data||[]));if((data||[]).length<500)break;
   if(start===9500)throw Error('ทะเบียนเกิน 10,000 รายการ กรุณาติดต่อผู้ดูแลระบบเพื่อเปิดการแบ่งหน้า');
  }
  store.rows=rows;
 }
 function table(items,showAction=true){
  return '<div class="table-scroller eq-table"><table><thead><tr><th>เลขครุภัณฑ์</th><th>ชื่อครุภัณฑ์</th><th>สถานที่ / ผู้รับผิดชอบ</th><th>ราคาทุน (บาท)</th><th>สถานะ</th>'+(showAction?'<th></th>':'')+'</tr></thead><tbody>'+
   (items.length?items.map(a=>'<tr><td><b>'+e(a.asset_code)+'</b></td><td>'+e(a.name)+'<small>'+e(category(a))+'</small></td><td>'+e(a.location||'-')+'<small>'+e(a.responsible_person||'')+'</small></td><td class="amount">'+cash(a.cost_satang)+'</td><td>'+e(st[a.asset_status]||'ใช้งานปกติ')+'</td>'+(showAction?'<td>'+b('เปิดดู','asset-open','mini-btn','data-id="'+e(a.id)+'"')+'</td>':'')+'</tr>').join(''):'<tr><td colspan="6" class="empty">ยังไม่มีครุภัณฑ์</td></tr>')+'</tbody></table></div>';
 }
 function metrics(){
  const active=store.rows.filter(a=>!['disposed','lost'].includes(a.asset_status)),book=active.filter(a=>a.accounting_class==='capitalized');
  const price=active.reduce((t,a)=>t+Number(a.cost_satang),0),net=book.reduce((t,a)=>t+depreciation(a,today()).net_satang,0);
  return '<div class="eq-stats">'+[['ครุภัณฑ์ทั้งหมด',store.rows.length,'ชิ้น'],['ทุนครุภัณฑ์ที่ถือครอง',cash(price),'บาท'],['มูลค่าบัญชีสินทรัพย์',cash(net),'บาท'],['ส่งซ่อม / สูญหาย',store.rows.filter(a=>['repair','lost'].includes(a.asset_status)).length,'รายการ']].map(([k,v,u])=>'<div class="eq-stat"><span>'+k+'</span><strong>'+v+'</strong><small>'+u+'</small></div>').join('')+'</div>';
 }
 function overview(){layout('ภาพรวมครุภัณฑ์','สรุปทะเบียนครุภัณฑ์ในโรงเรียน',metrics()+'<section class="card eq-card"><div class="section-head"><h2>รายการล่าสุด</h2>'+b('ดูทะเบียน →','asset-section','secondary','data-section="registry"')+'</div>'+table(store.rows.slice(0,8))+'</section>',can()?b('+ เพิ่มครุภัณฑ์','asset-new','primary'):'');}
 function registry(){
  const q=store.query.toLowerCase(),rows=store.rows.filter(a=>(store.status==='all'||store.status===a.asset_status)&&[a.asset_code,a.name,a.location,a.responsible_person,a.serial_number].join(' ').toLowerCase().includes(q));
  layout('ทะเบียนครุภัณฑ์','ค้นหาครุภัณฑ์รายชิ้นและตรวจสอบรายละเอียด','<section class="card eq-card"><div class="eq-filters"><input class="input" id="eq-search" placeholder="ค้นหารหัส ชื่อ ห้อง หรือผู้รับผิดชอบ" value="'+e(store.query)+'">'+select('สถานะ','eq_status',[['all','ทุกสถานะ'],...Object.entries(st)],store.status)+b('ค้นหา','asset-search')+'</div><p class="muted">พบ '+rows.length+' รายการ</p>'+table(rows.slice(0,200))+(rows.length>200?'<p>แสดง 200 รายการแรก กรุณาค้นหาเพื่อจำกัดผลลัพธ์</p>':'')+'</section>',can()?b('+ เพิ่มครุภัณฑ์','asset-new','primary'):'');
 }
 function sourceOptions(){
  const opts=[];
  for(const r of state.records||[])if(!r.deleted_at&&r.kind==='purchase'&&['received','completed'].includes(r.state))
   (r.items||[]).forEach((item,i)=>{
    const qty=Math.floor(Number(item.qty));
    if(!Number.isSafeInteger(qty)||qty<1||qty>10000) return;
    const used=new Set(store.rows.filter(x=>x.source_procurement_id===r.id&&x.source_item_index===i).map(x=>Number(x.source_unit_index)));
    const available=[];for(let unit=1;unit<=qty&&available.length<100;unit++)if(!used.has(unit))available.push(unit);
    if(available.length)opts.push({key:r.id+'|'+i,record:r,item,index:i,available,originalQuantity:qty});
   });
  return opts;
 }
 function form(){
  const x=store.editing||store.prefill||{},cats=[['','ไม่ระบุประเภท'],...store.cats.map(c=>[c.id,c.name+' ('+c.code_prefix+')'])];
  return '<form id="eq-asset-form" class="card eq-card"><h2>'+(store.editing?'แก้ไขทะเบียนครุภัณฑ์':'เพิ่มครุภัณฑ์รายชิ้น')+'</h2><div class="eq-grid">'+
   f('รหัสครุภัณฑ์ *','asset_code',x.asset_code||'','text','required maxlength="80"')+f('ชื่อครุภัณฑ์ *','name',x.name||'','text','required maxlength="250"')+
   select('ประเภทครุภัณฑ์','category_id',cats,x.category_id||'')+f('Serial Number','serial_number',x.serial_number||'')+
   f('วันที่ได้มา *','acquired_on',x.acquired_on||today(),'date','required')+f('วันที่พร้อมใช้งาน *','placed_in_service_on',x.placed_in_service_on||today(),'date','required')+
   f('ราคาทุนต่อชิ้น (บาท) *','cost_baht',x.cost_satang!=null?cash(x.cost_satang):'','text','required inputmode="decimal"')+
   f('มูลค่าคงเหลือ (บาท)','salvage_baht',x.salvage_satang!=null?cash(x.salvage_satang):'0.00','text','inputmode="decimal"')+
   f('อายุใช้งาน (เดือน) *','useful_life_months',x.useful_life_months||60,'number','required min="1" max="600"')+
   select('สถานะ','asset_status',Object.entries(st),x.asset_status||'active')+
   f('ห้อง / สถานที่ตั้ง','location',x.location||'')+f('ผู้รับผิดชอบ','responsible_person',x.responsible_person||'')+'</div>'+
   f('หมายเหตุ','notes',x.notes||'')+(store.source&&store.source.copies>1&&!store.editing?f('จำนวนที่ต้องการขึ้นทะเบียนแยกชิ้น','copies',store.source.copies,'number','min="1" max="100"'):'')+
   '<p class="hint">รหัสครุภัณฑ์ต้องไม่ซ้ำในโรงเรียน ครุภัณฑ์หลายชิ้นจะได้รับรหัสแยกกัน</p><div class="eq-actions"><button class="primary" type="submit">บันทึกครุภัณฑ์</button>'+b('ยกเลิก','asset-cancel')+'</div></form>';
 }
 function importPage(){
  const options=sourceOptions();
  let html='<div class="eq-columns"><section class="card eq-card"><h2>นำเข้าจากงานจัดซื้อเดิม</h2><p class="muted">เลือกเฉพาะรายการที่ได้รับการตรวจรับแล้ว ระบบจะนำราคาต่อหน่วยและรายการมาเติมแบบฟอร์ม</p>'+
    select('เลือกงานจัดซื้อ','eq_source',[['','เลือกรายการ'],...options.map(o=>[o.key,(o.record.document_number+'/'+o.record.fiscal_year)+' — '+o.item.name+' (เหลือ '+o.available.length+' ชิ้นที่เลือกขึ้นทะเบียนได้)'])],store.source?.key||'')+
    b('ดึงรายการ','asset-pick-source')+'</section><section class="card eq-card"><h2>นำเข้า Excel / CSV</h2><p class="muted">รองรับ .xlsx, .csv และ .tsv ดูตัวอย่างและตรวจข้อมูลก่อนบันทึก</p>'+
    '<input type="file" class="input" id="eq-file" accept=".xlsx,.csv,.tsv" aria-label="ไฟล์ครุภัณฑ์">'+
    '<div class="eq-actions">'+b('ตรวจไฟล์','asset-preview-file')+b('ดาวน์โหลดแม่แบบ','asset-template')+'</div></section></div>';
  if(store.errors.length)html+='<div class="eq-caution">พบข้อมูลไม่ถูกต้อง: '+store.errors.slice(0,12).map(e).join(' • ')+'</div>';
  if(store.preview.length)html+='<section class="card eq-card"><h2>ตรวจข้อมูล '+store.preview.length+' ชิ้นก่อนนำเข้า</h2>'+table(store.preview.slice(0,8).map((a,i)=>({...a,id:'preview-'+i,asset_status:'active'})),false)+b('ยืนยันนำเข้าทั้งหมด','asset-import-confirm','primary')+'</section>';
  if(can())html+=form();else html+='<div class="eq-caution">บัญชีนี้ไม่มีสิทธิ์เพิ่มหรือแก้ไขครุภัณฑ์</div>';
  layout('เพิ่ม / นำเข้าครุภัณฑ์','เพิ่มเอง ดึงจากงานจัดซื้อ หรือ Excel',html);
 }
 function detail(){
  const r=store.rows.find(a=>a.id===store.selected);if(!r){state.assetSection='registry';return registry();}
  const d=depreciation(r,today()),show=(l,v)=>'<div class="eq-detail"><span>'+l+'</span><b>'+e(String(v??'-'))+'</b></div>';
  layout('รายละเอียดครุภัณฑ์','ครุภัณฑ์รายตัว','<section class="card eq-card"><h2>'+e(r.name)+'</h2><div class="eq-detail-grid">'+
   show('รหัส',r.asset_code)+show('ประเภท',category(r))+show('Serial Number',r.serial_number)+show('สถานะ',st[r.asset_status])+
   show('วันที่ได้มา',r.acquired_on)+show('วันที่พร้อมใช้งาน',r.placed_in_service_on)+show('ราคาทุน',cash(r.cost_satang)+' บาท')+
   show('อายุใช้งาน',r.useful_life_months+' เดือน')+show('สถานที่ตั้ง',r.location)+show('ผู้รับผิดชอบ',r.responsible_person)+
   show('ประเภทบัญชี',r.accounting_class==='capitalized'?'สินทรัพย์ที่รับรู้':'ทะเบียนควบคุม')+
   show('ค่าเสื่อมสะสม',d.eligible?cash(d.depreciation_satang)+' บาท':'ไม่คำนวณ')+
   show('มูลค่าตามบัญชี',d.eligible?cash(d.net_satang)+' บาท':'ไม่คำนวณ')+show('หมายเหตุ',r.notes)+'</div>'+
   '<div class="eq-actions">'+(can()?b('แก้ไข','asset-edit','primary','data-id="'+e(r.id)+'"'):'')+b('กลับทะเบียน','asset-back')+'</div></section>');
 }
 function yearSelect(){return '<div class="eq-actions">'+f('ปีงบประมาณ พ.ศ.','eq_year',store.year,'number','min="2500" max="2700"')+b('เลือกปีงบประมาณ','asset-year')+'</div>';}
 function depPage(){
  const all=store.rows.map(r=>({r,d:yearDepreciation(r,store.year)})),eligible=all.filter(x=>x.d.eligible);
  const total=key=>cash(eligible.reduce((a,x)=>a+x.d[key],0));
  layout('คำนวณค่าเสื่อมราคา','วิธีเส้นตรงตามวันที่พร้อมใช้งานและอายุที่กำหนด','<section class="card eq-card">'+yearSelect()+
   '<p class="hint">คำนวณตามวันตั้งแต่พร้อมใช้งานจนถึงสิ้นสุดอายุใช้ประโยชน์ แสดงผลสำหรับปีงบประมาณสิ้นสุด 30 กันยายน (รายการจำหน่ายหรือทะเบียนควบคุมไม่ถูกรวมค่าเสื่อม)</p>'+
   '<div class="eq-stats">'+[['ค่าเสื่อมปีนี้',total('year_satang')],['ค่าเสื่อมสะสม',total('accumulated_satang')],['มูลค่าตามบัญชี',total('net_satang')]].map(x=>'<div class="eq-stat"><span>'+x[0]+'</span><strong>'+x[1]+'</strong><small>บาท</small></div>').join('')+'</div>'+
   '<div class="table-scroller"><table><thead><tr><th>รหัส</th><th>รายการ</th><th>ทุน</th><th>ค่าเสื่อมปีนี้</th><th>สะสม</th><th>มูลค่าสุทธิ</th></tr></thead><tbody>'+
   all.slice(0,300).map(({r,d})=>'<tr><td>'+e(r.asset_code)+'</td><td>'+e(r.name)+'</td><td>'+cash(r.cost_satang)+'</td><td>'+(d.eligible?cash(d.year_satang):'—')+'</td><td>'+(d.eligible?cash(d.accumulated_satang):'—')+'</td><td>'+(d.eligible?cash(d.net_satang):'—')+'</td></tr>').join('')+'</tbody></table></div>'+
   (all.length>300?'<p class="hint">แสดง 300 รายการแรก แต่ผลรวมครบทุกรายการ</p>':'')+'</section>');
 }
 function report(){
  layout('รายงานทะเบียนครุภัณฑ์ A4','พิมพ์ทะเบียนและบันทึกเป็น PDF จากเบราว์เซอร์','<section class="card eq-card"><h2>รายงานครุภัณฑ์ทั้งหมด '+store.rows.length+' ชิ้น</h2>'+yearSelect()+
   '<div class="eq-actions">'+b('พิมพ์ / บันทึก PDF ขนาด A4','asset-print','primary')+b('ส่งออก CSV','asset-export')+'</div>'+
   '<p class="hint">รายงานประกอบการตรวจสอบ โปรดตรวจข้อมูลและค่าเสื่อมตามนโยบายบัญชีก่อนลงนาม</p></section>'+table(store.rows.slice(0,15),false));
 }
 function settings(){
  if(!isSchoolAdmin())return overview();
  layout('ตั้งค่าประเภทและรหัสครุภัณฑ์','เฉพาะแอดมินโรงเรียน','<section class="card eq-card"><h2>นโยบายบัญชีของโรงเรียน</h2><form id="eq-policy-form"><div class="eq-grid">'+
   f('เกณฑ์รับรู้สินทรัพย์ต่อชิ้น (บาท)','threshold_baht',cash(store.policy.capitalization_threshold_satang),'text','required')+
   select('การยืนยันนโยบาย','policy_confirmed',[['false','ยังไม่ได้ตรวจสอบ'],['true','ยืนยันว่าตรวจสอบนโยบายของต้นสังกัดแล้ว']],String(store.policy.policy_confirmed))+
   '</div><p class="hint">การเปลี่ยนเกณฑ์ไม่มีผลย้อนหลังต่อครุภัณฑ์ที่บันทึกแล้ว</p><button class="primary" type="submit">บันทึกนโยบาย</button></form></section>'+
   '<section class="card eq-card"><h2>ประเภทครุภัณฑ์</h2><div class="table-scroller"><table><thead><tr><th>ประเภท</th><th>รหัสนำหน้า</th><th>อายุแนะนำ (เดือน)</th></tr></thead><tbody>'+
   store.cats.map(c=>'<tr><td>'+e(c.name)+'</td><td>'+e(c.code_prefix)+'</td><td>'+c.suggested_life_months+'</td><td>'+b('แก้ไข','asset-category-edit','mini-btn','data-id="'+e(c.id)+'"')+'</td></tr>').join('')+'</tbody></table></div>'+
   '<form id="eq-category-form"><h3>'+(store.editCategory?'แก้ไขประเภทครุภัณฑ์':'เพิ่มประเภทครุภัณฑ์')+'</h3><div class="eq-grid">'+f('ชื่อประเภท','name',store.editCategory?.name||'','text','required maxlength="100"')+
   f('คำนำหน้ารหัส','code_prefix',store.editCategory?.code_prefix||'','text','required maxlength="24"')+
   f('อายุแนะนำ (เดือน)','suggested_life_months',store.editCategory?.suggested_life_months||60,'number','min="1" max="600" required')+'</div>'+
   '<p class="hint">อายุแนะนำใช้ช่วยกรอกฟอร์ม เจ้าหน้าที่ต้องตรวจความเหมาะสมก่อนบันทึกจริง</p><div class="eq-actions"><button type="submit" class="primary">'+(store.editCategory?'บันทึกแก้ไขประเภท':'เพิ่มประเภท')+'</button>'+(store.editCategory?b('ยกเลิก','asset-category-cancel'):'')+'</div></form></section>');
 }
 function guide(){
  shell('คู่มือระบบทะเบียนคุมครุภัณฑ์','คู่มือผู้ใช้งาน',heading('คู่มือระบบทะเบียนคุมครุภัณฑ์','อ้างอิงการทำงานจากฟอร์มจริงของโมดูล')+
   '<section class="card eq-card"><ol class="eq-help">'+
   '<li>ภาพรวม: ดูจำนวนและมูลค่าครุภัณฑ์ทั้งหมด</li><li>ทะเบียน: ค้นหา เปิดดูรายละเอียด และแก้ไขตามสิทธิ์</li>'+
   '<li>เพิ่ม / นำเข้า: กรอกข้อมูลรายชิ้น ดึงจากรายการจัดซื้อที่ตรวจรับแล้ว หรือนำเข้า Excel แล้วตรวจตัวอย่างก่อนบันทึก</li>'+
   '<li>ค่าเสื่อม: เลือกปีงบประมาณ คำนวณตามวันพร้อมใช้งานและอายุที่กำหนด</li>'+
   '<li>รายงาน A4: ตรวจรายงานก่อนสั่งพิมพ์หรือบันทึก PDF</li>'+
   '<li>ตั้งค่า: แอดมินโรงเรียนกำหนดประเภท รหัส และเกณฑ์รับรู้สินทรัพย์</li></ol>'+
   '<p class="hint">คู่มือฉบับนี้เป็นข้อความตามหน้าจอจริง จะเพิ่มภาพประกอบหลังตรวจรับฟอร์มแล้ว</p></section>');
 }
 function view(){
  if(state.page==='asset-guide')return guide();
  switch(state.assetSection){case 'registry':return registry();case 'import':return importPage();case 'detail':return detail();case 'depreciation':return depPage();case 'report':return report();case 'settings':return settings();default:return overview();}
 }
 function reset(){store.editing=null;store.source=null;store.prefill=null;store.preview=[];store.errors=[];}
 async function go(action,el){
  if(action==='asset-category-edit'){if(!isSchoolAdmin())throw Error('เฉพาะแอดมินโรงเรียน');store.editCategory=store.cats.find(c=>c.id===el.dataset.id)||null;view();return true;}
  if(action==='asset-category-cancel'){store.editCategory=null;view();return true;}
  if(action==='asset-open'){store.selected=el.dataset.id;state.assetSection='detail';view();return true;}
  if(action==='asset-back'){state.assetSection='registry';view();return true;}
  if(action==='asset-new'){reset();state.assetSection='import';view();return true;}
  if(action==='asset-cancel'){reset();state.assetSection='registry';view();return true;}
  if(action==='asset-edit'){if(!can())throw Error('ไม่มีสิทธิ์แก้ไข');const r=store.rows.find(a=>a.id===el.dataset.id);if(!r)throw Error('ไม่พบครุภัณฑ์');reset();store.editing=r;state.assetSection='import';view();return true;}
  if(action==='asset-search'){store.query=document.getElementById('eq-search')?.value||'';store.status=document.querySelector('[name="eq_status"]')?.value||'all';view();return true;}
  if(action==='asset-year'){const year=Number(document.querySelector('[name="eq_year"]')?.value);if(!Number.isInteger(year)||year<2500||year>2700)throw Error('ปีงบประมาณต้องเป็น พ.ศ. 2500–2700');store.year=year;view();return true;}
  if(action==='asset-template'){saveCsvFile('kru-pasadu-equipment-template.csv',[importHeaders,['คพ-001/2570','คอมพิวเตอร์ตัวอย่าง','28000','2026-10-24','2026-10-24','60','0','','SN-001','ห้องตัวอย่าง','ครูตัวอย่าง','ข้อมูลสมมติ']]);return true;}
  if(action==='asset-preview-file'){
   if(!can())throw Error('ไม่มีสิทธิ์นำเข้า');const file=document.getElementById('eq-file')?.files?.[0];if(!file)throw Error('กรุณาเลือกไฟล์');
   const parsed=await readSpreadsheet(file),r=rowsToAssets(parsed,store.cats,store.policy.capitalization_threshold_satang);
   store.errors=r.errors;store.preview=r.errors.length?[]:r.assets;view();return true;
  }
  if(action==='asset-import-confirm'){
   if(!can()||!store.preview.length||store.errors.length)throw Error('ไม่มีรายการพร้อมนำเข้า');
   if(!confirm('ยืนยันนำเข้าครุภัณฑ์ '+store.preview.length+' ชิ้น?'))return true;
   const items=store.preview.map(a=>({...a,school_id:state.school.id}));
   if(state.demo)store.rows.unshift(...items.map((x,i)=>({...x,id:'demo-import-'+Date.now()+'-'+i})));
   else{const {error}=await db.from('equipment_assets').insert(items);if(error)throw Error('นำเข้าไม่สำเร็จ ไม่มีการบันทึกชุดนี้: '+error.message);await load();}
   reset();state.assetSection='registry';notify('นำเข้าครุภัณฑ์สำเร็จ '+items.length+' ชิ้น');return true;
  }
  if(action==='asset-pick-source'){
   if(!can())throw Error('ไม่มีสิทธิ์');const key=document.querySelector('[name="eq_source"]')?.value;
   const pick=sourceOptions().find(x=>x.key===key);if(!pick)throw Error('เลือกงานจัดซื้อที่ตรวจรับแล้วก่อน');
   reset();const cat=store.cats[0],copies=pick.available.length;
   store.source={...pick,copies};
   store.prefill={asset_code:(cat?.code_prefix||'คภ')+'-'+pick.record.document_number+'-'+(pick.index+1),name:pick.item.name,cost_satang:Number(pick.item.price_satang),salvage_satang:0,category_id:cat?.id||null,useful_life_months:cat?.suggested_life_months||60,acquired_on:today(),placed_in_service_on:today()};
   view();return true;
  }
  if(action==='asset-export'){
   const rows=[['รหัส','ชื่อ','ประเภท','ทุน(บาท)','วันที่ได้มา','วันที่พร้อมใช้งาน','สถานที่','ผู้รับผิดชอบ','สถานะ','ค่าเสื่อมสะสม','มูลค่าบัญชี']];
   for(const a of store.rows){const d=depreciation(a,(store.year-543)+'-09-30');rows.push([a.asset_code,a.name,category(a),cash(a.cost_satang),a.acquired_on,a.placed_in_service_on,a.location,a.responsible_person,st[a.asset_status],d.eligible?cash(d.depreciation_satang):'',d.eligible?cash(d.net_satang):'']);}
   saveCsvFile('kru-pasadu-equipment-'+store.year+'.csv',rows);return true;
  }
  if(action==='asset-print'){print();return true;}
  return false;
 }
 async function submit(form){
  if(!['eq-asset-form','eq-policy-form','eq-category-form'].includes(form.id))return false;
  if(!can())throw Error('ไม่มีสิทธิ์จัดการครุภัณฑ์');
  const data=Object.fromEntries(new FormData(form));
  if(form.id==='eq-policy-form'){
   if(!isSchoolAdmin())throw Error('เฉพาะแอดมินโรงเรียน');
   const amount=cents(data.threshold_baht||'0');
   const row={school_id:state.school.id,capitalization_threshold_satang:amount,policy_confirmed:data.policy_confirmed==='true',updated_at:new Date().toISOString()};
   if(state.demo)store.policy=row;else{const {error}=await db.from('asset_policies').upsert(row,{onConflict:'school_id'});if(error)throw Error(error.message);await load();}
   notify('บันทึกเกณฑ์บัญชีสำเร็จ');return true;
  }
  if(form.id==='eq-category-form'){
   if(!isSchoolAdmin())throw Error('เฉพาะแอดมินโรงเรียน');
   const row={school_id:state.school.id,name:String(data.name||'').trim(),code_prefix:String(data.code_prefix||'').trim(),suggested_life_months:Number(data.suggested_life_months)};
   if(!row.name||!row.code_prefix||!Number.isInteger(row.suggested_life_months)||row.suggested_life_months<1||row.suggested_life_months>600)throw Error('ข้อมูลประเภทไม่ถูกต้อง');
   if(state.demo){if(store.editCategory){const at=store.cats.findIndex(c=>c.id===store.editCategory.id);store.cats[at]={...row,id:store.editCategory.id};}else store.cats.push({...row,id:'cat-'+Date.now()});}
   else{const response=store.editCategory?await db.from('asset_categories').update(row).eq('id',store.editCategory.id).eq('school_id',state.school.id):await db.from('asset_categories').insert(row);if(response.error)throw Error(response.error.message);await load();}
   store.editCategory=null;notify('บันทึกประเภทครุภัณฑ์สำเร็จ');return true;
  }
  const item=assetInput(data,{threshold:store.policy.capitalization_threshold_satang,categories:store.cats});
  // Edits must not silently reclassify old accounting records after a policy threshold change.
  if(store.editing)item.accounting_class=store.editing.accounting_class;
  let batch=[item];
  if(!store.editing&&store.source){
   const qty=Number(data.copies||1);
   if(!Number.isInteger(qty)||qty<1||qty>store.source.copies)throw Error('จำนวนชิ้นไม่ถูกต้อง');
   batch=Array.from({length:qty},(_,i)=>({...item,asset_code:store.source.originalQuantity===1?item.asset_code:item.asset_code+'-'+String(store.source.available[i]).padStart(3,'0'),
    source_procurement_id:store.source.record.id,source_item_index:store.source.index,source_unit_index:store.source.available[i]}));
  }
  if(state.demo){if(store.editing){const index=store.rows.findIndex(x=>x.id===store.editing.id);store.rows[index]={...store.rows[index],...item};}
   else store.rows.unshift(...batch.map((r,i)=>({...r,id:'demo-item-'+Date.now()+'-'+i,school_id:'demo-school'})));
  }else{
   const resp=store.editing?await db.from('equipment_assets').update(item).eq('id',store.editing.id).eq('school_id',state.school.id).select('id').single():
    await db.from('equipment_assets').insert(batch.map(r=>({...r,school_id:state.school.id})));
   if(resp.error)throw Error('บันทึกไม่สำเร็จ: '+resp.error.message);await load();
  }
  reset();state.assetSection='registry';notify('บันทึกครุภัณฑ์สำเร็จ '+batch.length+' ชิ้น');return true;
 }
 function print(){
  const rows=store.rows,pages=[];for(let i=0;i<rows.length;i+=19)pages.push(rows.slice(i,i+19));if(!pages.length)pages.push([]);
  const html=pages.map((items,ix)=>'<section class="paper-page eq-print-page"><h1>ทะเบียนคุมครุภัณฑ์</h1><p><b>'+e(state.school?.name||'โรงเรียน')+'</b> • ปีงบประมาณ พ.ศ. '+store.year+' • หน้า '+(ix+1)+'/'+pages.length+'</p>'+
   '<table class="eq-print-table"><thead><tr><th>ลำดับ</th><th>รหัส / ชื่อครุภัณฑ์</th><th>วันที่ได้มา</th><th>ทุน</th><th>ค่าเสื่อมสะสม</th><th>มูลค่าบัญชี</th><th>สถานที่</th></tr></thead><tbody>'+
   items.map((a,i)=>{const d=depreciation(a,(store.year-543)+'-09-30');return '<tr><td>'+(ix*19+i+1)+'</td><td>'+e(a.asset_code)+'<div>'+e(a.name)+'</div></td><td>'+e(a.acquired_on)+'</td><td>'+cash(a.cost_satang)+'</td><td>'+(d.eligible?cash(d.depreciation_satang):'-')+'</td><td>'+(d.eligible?cash(d.net_satang):'-')+'</td><td>'+e(a.location||'-')+'</td></tr>';}).join('')+
   '</tbody></table><p class="eq-print-foot">เอกสารจากระบบ KRU PASADU • โปรดตรวจสอบข้อมูลและเกณฑ์ค่าเสื่อมก่อนใช้อ้างอิงทางราชการ</p></section>').join('');
  const root=printRoot();if(!root)throw Error('ไม่พบพื้นที่พิมพ์เอกสาร');root.innerHTML=html;requestAnimationFrame(()=>window.print());
 }
 return {load,view,go,submit,reset};
}
