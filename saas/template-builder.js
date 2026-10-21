/**
 * Per-school official document templates. The six government master forms
 * remain the source of truth for dynamic values, legal text and signatures.
 * User edits are typed JSON patches: no arbitrary user HTML or JavaScript.
 */
import {currentTextNodes,tokenizeOriginalText,applyTextEditsToBlock,applySignatureOffsets,decorateSignatureHandles,safeSignatureOffset} from './template-rich-editor.js';
export const TEMPLATE_PAGES=[
 {key:'request',name:'รายงานขอซื้อ / ขอจ้าง',css:'gov-request'},
 {key:'annex',name:'รายละเอียดพัสดุ / งานจ้างแนบท้าย',css:'gov-annex'},
 {key:'approval',name:'รายงานผลการพิจารณาและขออนุมัติสั่งซื้อ / จ้าง',css:'gov-approval'},
 {key:'acceptance',name:'ใบตรวจรับพัสดุ / งานจ้าง',css:'gov-acceptance'},
 {key:'payment',name:'ทราบผลและขออนุมัติเบิกจ่าย',css:'gov-payment'},
 {key:'requisition',name:'ใบเบิกพัสดุ',css:'gov-requisition'}
];
export const TEMPLATE_VARIABLES={
 school_name:'ชื่อโรงเรียน',director_name:'ชื่อผู้อำนวยการ',officer_name:'เจ้าหน้าที่',
 head_name:'หัวหน้าเจ้าหน้าที่',finance_name:'เจ้าหน้าที่การเงิน',
 document_number:'เลขทะเบียนรายการ',document_date:'วันที่เอกสาร',title:'ชื่อเรื่อง',
 department:'กลุ่มงาน',reason:'เหตุผลและความจำเป็น',budget_source:'แหล่งเงิน',
 vendor_name:'ชื่อร้านค้า/ผู้รับจ้าง',inspector_name:'ผู้ตรวจรับ',
 total_amount:'ยอดเงิน (บาท)',items_count:'จำนวนรายการ'
};
export const templateEsc=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
 .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export function templateBindings(r={},s={}){
 const satang=Number(r.total_satang||0);
 return {
  school_name:s.name||'',director_name:r.signers?.director||s.director_name||'',
  officer_name:r.signers?.officer||s.officer_name||'',
  head_name:r.signers?.head||s.head_name||'',finance_name:s.finance_name||'',
  document_number:(r.document_number||'–')+'/'+(r.fiscal_year||'–'),
  document_date:r.document_date||'',title:r.title||'',
  department:r.department||'',reason:r.reason||'',budget_source:r.budget_source||'',
  vendor_name:r.vendor_name||'',inspector_name:r.inspector_name||'',
  total_amount:(satang/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}),
  items_count:String((r.items||[]).length)
 };
}
export function expandTemplateText(text,r,s){
 const vals=templateBindings(r,s);
 return String(text||'').replace(/\{\{([a-z_]+)\}\}/g,(_match,key)=>
  Object.prototype.hasOwnProperty.call(vals,key)?String(vals[key]):'');
}
export function safeTemplateDraft(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('รูปแบบแม่แบบไม่ถูกต้อง');
 const limit=(t,max)=>String(t??'').slice(0,max);
 const clean={};
 if(input.title!==undefined)clean.title=limit(input.title,400);
 if(input.legal!==undefined)clean.legal=limit(input.legal,400);
 const blocks=Array.isArray(input.blocks)?input.blocks:[];
 if(blocks.length>24)throw Error('แม่แบบเพิ่มบล็อกได้ไม่เกิน 24 บล็อกต่อหน้า');
 clean.blocks=blocks.map((b,i)=>({
  id:/^x[a-zA-Z0-9_-]{1,55}$/.test(String(b.id||''))?b.id:'x'+i+'custom',
  type:['paragraph','heading','note','divider'].includes(b.type)?b.type:'paragraph',
  text:limit(b.text,4000),
  align:['left','center','right'].includes(b.align)?b.align:'left',
  size:[12,14,16,18,20,22,24].includes(Number(b.size))?Number(b.size):16,
  bold:Boolean(b.bold),
  placement:'after-content'
 }));
 clean.order=(Array.isArray(input.order)?input.order:[]).filter(x=>typeof x==='string'&&/^(d[0-9]{1,2}|x[a-zA-Z0-9_-]{1,55})$/.test(x)).slice(0,60);
 const original=input.styles&&typeof input.styles==='object'&&!Array.isArray(input.styles)?input.styles:{};
 clean.styles={};
 for(const [id,style] of Object.entries(original).slice(0,60)){
  if(!/^d[0-9]{1,2}$/.test(id))continue;
  clean.styles[id]={
   align:['left','center','right'].includes(style?.align)?style.align:'left',
   size:[12,14,16,18,20,22,24].includes(Number(style?.size))?Number(style.size):16,
   bold:Boolean(style?.bold)
  };
 }
 const entries=input.textEdits&&typeof input.textEdits==='object'&&!Array.isArray(input.textEdits)?input.textEdits:{};
 clean.textEdits={};
 for(const [id,items] of Object.entries(entries).slice(0,60)){
  if(!/^d[0-9]{1,2}$/.test(id)||!items||typeof items!=='object'||Array.isArray(items))continue;
  const saved={};
  for(const [index,fragments] of Object.entries(items).slice(0,80)){
   if(!/^(0|[1-9]\d{0,2})$/.test(index)||!Array.isArray(fragments)||fragments.length>30)continue;
   if(fragments.some(f=>typeof f!=='string'||f.length>4000))continue;
   saved[index]=fragments;
  }
  clean.textEdits[id]=saved;
 }
 const offsets=input.signatureOffsets&&typeof input.signatureOffsets==='object'&&!Array.isArray(input.signatureOffsets)?input.signatureOffsets:{};
 clean.signatureOffsets={};
 for(const [id,offset] of Object.entries(offsets).slice(0,12)){
  if(!/^(staff[01]|director|finance|inspector|requisition[0-3])$/.test(id))continue;
  clean.signatureOffsets[id]=safeSignatureOffset(offset);
 }
 return clean;
}
export function emptyTemplate(){return {title:'',legal:'',blocks:[],order:[],styles:{},textEdits:{},signatureOffsets:{}};}
export function templateKeyForPage(section){
 for(const p of TEMPLATE_PAGES)if(section.classList.contains(p.css))return p.key;
 return null;
}
function structuralBlocks(section){
 const zone=section?.querySelector('.memo-content')||section?.querySelector('.doc-sheet-body');
 if(!zone)return {zone:null,nodes:[]};
 const nodes=[...zone.children].filter(el=>
  !el.matches('.memo-top,.memo-field,.memo-line,.print-title,.gov-law,.gov-right-head,.memo-signatures,.gov-requisition-signatures,.gov-inspection-bottom,.director-sign')&&
  !el.classList.contains('te-extra-block')&&!el.querySelector('.signature-card'));
 return {zone,nodes};
}
export function originalBlockLabels(section){
 const {nodes}=structuralBlocks(section);
 return nodes.map((n,i)=>({id:'d'+i,label:(n.textContent||'ตาราง / บล็อก '+(i+1)).replace(/\s+/g,' ').trim().slice(0,90)||'บล็อก '+(i+1)}));
}
function isProtectedGeneratedBlock(el){return el.matches('table,.gov-items,.gov-count,.gov-money-list')||!!el.querySelector('.gov-items,.gov-money-list');}
function styleBlock(el,style){
 if(!style)return;
 if(['left','center','right'].includes(style.align))el.style.setProperty('text-align',style.align,'important');
 if([12,14,16,18,20,22,24].includes(Number(style.size)))el.style.setProperty('font-size',Number(style.size)+'pt','important');
 if(style.bold)el.style.setProperty('font-weight','700','important');
}
export function createTemplateBlockNode(block,r,s,doc){
 const el=doc.createElement('div');el.className='te-extra-block te-extra-'+block.type;
 el.dataset.templateBlock=block.id;
 el.style.textAlign=block.align||'left';
 el.style.fontSize=(Number(block.size)||16)+'pt';
 if(block.bold||block.type==='heading')el.style.fontWeight='700';
 if(block.type==='divider'){el.appendChild(doc.createElement('hr'));return el;}
 el.textContent=expandTemplateText(block.text,r,s);return el;
}
export function applyDocumentTemplates(html,layouts,r,s,doc=typeof document!=='undefined'?document:null){
 if(!doc||!layouts||!Object.keys(layouts).length)return html;
 const host=doc.createElement('div');host.innerHTML=html;
 const occurrence={};
 for(const section of host.querySelectorAll('section.paper-page.gov-doc')){
  const key=templateKeyForPage(section);
  if(!key)continue;
  const input=layouts[key];if(!input)continue;
  const t=safeTemplateDraft(input);
  const pageNumber=occurrence[key]||0;occurrence[key]=pageNumber+1;
  if(t.title){
   const title=section.querySelector('.print-title,.memo-field-subject .memo-value');
   if(title)title.textContent=expandTemplateText(t.title,r,s);
  }
  if(t.legal){
   const legal=section.querySelector('.gov-law');
   if(legal)legal.textContent=expandTemplateText(t.legal,r,s);
  }
  const {zone,nodes}=structuralBlocks(section);
  if(!zone)continue;
  for(const [i,n] of nodes.entries()){n.dataset.templateOriginal='d'+i;if(!isProtectedGeneratedBlock(n))applyTextEditsToBlock(n,t.textEdits['d'+i],r,s,doc);styleBlock(n,t.styles['d'+i]);}
  applySignatureOffsets(section,t.signatureOffsets);
  // A published blank/master template or heading-only change must not disturb
  // the original legal form hierarchy, signatures or preformatted tables.
  if(!t.order.length&&!t.blocks.length)continue;
  // Reorder only within the editable content zone. Legal headers, tables'
  // own rows, signature cards and page headings are never disassembled.
  const custom=pageNumber===0?t.blocks.map(b=>createTemplateBlockNode(b,r,s,doc)):[];
  const originals=new Map(nodes.map((n,i)=>['d'+i,n]));
  const extras=new Map(custom.map(n=>[n.dataset.templateBlock,n]));
  const sequence=[...new Set(t.order)].filter(id=>originals.has(id)||extras.has(id));
  for(const id of [...originals.keys(),...extras.keys()])if(!sequence.includes(id))sequence.push(id);
  if(!sequence.length)continue;
  const marker=doc.createComment('template-block-position');
  const anchor=nodes[0]||[...zone.children].find(n=>n.matches('.gov-requisition-signatures,.gov-inspection-bottom'))||null;
  zone.insertBefore(marker,anchor);
  const fragment=doc.createDocumentFragment();
  for(const id of sequence)fragment.appendChild(originals.get(id)||extras.get(id));
  zone.insertBefore(fragment,marker);
  marker.remove();
 }
 return host.innerHTML;
}
export function activeTemplateLayouts(rows,versionRows={},record=null){
 const out={};
 for(const p of TEMPLATE_PAGES){
  const row=rows?.[p.key];
  if(record && record.state!=='draft'){
   const n=Number(record.document_template_versions?.[p.key]||0);
   if(n>0 && versionRows[p.key+':'+n])out[p.key]=versionRows[p.key+':'+n].layout;
  } else if(row?.published_version>0&&row.published)out[p.key]=row.published;
 }
 return out;
}
export function createTemplateEditor({db,state,shell,heading,btn,buildDocuments,notify}){
 let selected='request',draft=emptyTemplate(),revision=0,currentBlock='',dirty=false,history=[];
 const row=()=>state.schoolTemplates?.[selected];
 let activeSignature='',inlineAlert='';
 function assignDraft(){draft=safeTemplateDraft(row()?.draft||emptyTemplate());revision=row()?.draft_revision||0;currentBlock='';activeSignature='';inlineAlert='';dirty=false;}
 async function load(){
  if(state.demo){state.schoolTemplates={};return;}
  if(!state.school?.id)return;
  const {data,error}=await db.from('school_document_templates').select('*').eq('school_id',state.school.id);
  if(error)throw Error('โหลดแม่แบบไม่สำเร็จ: '+error.message);
  state.schoolTemplates=Object.fromEntries((data||[]).map(v=>[v.template_key,v]));
 }
 async function open(){
  if(!state.memberships.some(m=>m.school_id===state.school?.id&&m.role==='school_admin'&&m.active!==false)&&!state.demo)
   throw Error('เฉพาะแอดมินโรงเรียนเท่านั้นที่แก้แม่แบบได้');
  await load();assignDraft();state.page='templates';view();
 }
 async function loadVersions(){
  if(state.demo){history=[];return;}
  const {data,error}=await db.from('school_document_template_versions')
   .select('version,published_at,published_by,layout').eq('school_id',state.school.id)
   .eq('template_key',selected).order('version',{ascending:false}).limit(30);
  if(error)throw Error(error.message);
  history=data||[];
 }
 const snapshot=()=>state.currentRecord||state.records?.[0]||{
  kind:'purchase',document_number:1,fiscal_year:2570,document_date:'2026-10-21',
  title:'ซื้อวัสดุสำนักงาน',vendor_name:'ร้านค้าตัวอย่าง',reason:'ใช้ดำเนินกิจกรรมของโรงเรียน',
  department:'งานบริหารวิชาการ',budget_source:'กิจกรรมพัฒนาผู้เรียน',
  total_satang:50000,items:[{name:'ของที่ระลึก',qty:1,unit:'ชุด',price_satang:50000}],
  state:'draft',signers:{},document_meta:{}
 };
 function editorRecord(){const r=snapshot();return selected==='requisition'&&r.kind==='hire'?{...r,kind:'purchase'}:r;}
 function sourcePage(){
  const html=buildDocuments(editorRecord(),state.school);
  const host=document.createElement('div');host.innerHTML=html;
  return [...host.querySelectorAll('section.paper-page.gov-doc')].find(el=>templateKeyForPage(el)===selected);
 }
 function pagePreviewHtml(){
  const r=editorRecord();const html=buildDocuments(r,state.school);
  const host=document.createElement('div');host.innerHTML=applyDocumentTemplates(html,{[selected]:draft},r,state.school);
  const page=[...host.querySelectorAll('section.paper-page.gov-doc')].find(el=>templateKeyForPage(el)===selected);
  if(page){
   for(const node of page.querySelectorAll('[data-template-original],[data-template-block]')){
    const id=node.dataset.templateOriginal||node.dataset.templateBlock;
    node.dataset.templateDrag=id;
    node.draggable=true;
    node.classList.add('te-canvas-draggable');
    if(id===currentBlock)node.classList.add('te-canvas-selected');
   }
   for(const [selector,field] of [['.memo-field-subject .memo-value,.print-title','title'],['.gov-law','legal']]){
    const el=page.querySelector(selector);
    if(el){el.dataset.templateHeader=field;el.contentEditable='plaintext-only';el.draggable=false;el.classList.add('te-inline-edit');}
   }
   decorateSignatureHandles(page,activeSignature);
   const source=sourcePage();
   const {nodes:originals}=structuralBlocks(source);
   for(const [i,original] of originals.entries()){
    const block=page.querySelector('[data-template-original="d'+i+'"]');
    if(!block||isProtectedGeneratedBlock(original)){if(block)block.classList.add('te-generated-locked');continue;}
    const originalsText=currentTextNodes(original,document);
    const editedText=currentTextNodes(block,document);
    for(let j=editedText.length-1;j>=0;j--){
     const liveNode=editedText[j],originalNode=originalsText[j];
     if(!originalNode||!liveNode||!liveNode.parentNode)continue;
     const parts=tokenizeOriginalText(originalNode.textContent,r,state.school);
     const custom=draft.textEdits?.['d'+i]?.[String(j)];
     const patch=Array.isArray(custom)&&custom.length===parts.filter(p=>p.kind==='text').length?custom:null;
     const fragment=document.createDocumentFragment();let ix=0;
     for(const part of parts){
      const span=document.createElement('span');
      if(part.kind==='locked'){
       span.className='te-system-locked';span.dataset.systemKey=part.key;
       span.title='ข้อมูลนี้ดึงจากระบบอัตโนมัติ ไม่สามารถแก้ข้อความนี้ได้';
       span.contentEditable='false';span.textContent=part.value;
      }else{
       span.className='te-inline-edit';span.dataset.templateText='d'+i+':'+j+':'+ix;
       span.contentEditable='plaintext-only';span.spellcheck=false;
       span.textContent=patch?patch[ix]:part.value;ix++;
      }
      fragment.appendChild(span);
     }
     liveNode.parentNode.replaceChild(fragment,liveNode);
    }
   }
  }
  return page?.outerHTML||'<p>เอกสารประเภทนี้ไม่อยู่ในรายการจัดซื้อ/จัดจ้างที่เลือก โปรดเลือกรายการตัวอย่างที่เกี่ยวข้อง</p>';
 }
 const esc=templateEsc;
 const blockName=id=>id.startsWith('d')?((originalBlockLabels(sourcePage()).find(x=>x.id===id)||{}).label||'บล็อกต้นฉบับ'):draft.blocks.find(b=>b.id===id)?.text?.slice(0,55)||'บล็อกเพิ่มเติม';
 function blockSeq(){
  const defaults=originalBlockLabels(sourcePage()).map(x=>x.id),custom=draft.blocks.map(x=>x.id);
  return [...new Set([...(draft.order||[]),...defaults,...custom])].filter(x=>defaults.includes(x)||custom.includes(x));
 }
 function fields(){
  const page=TEMPLATE_PAGES.find(p=>p.key===selected);
  const cur=draft.blocks.find(b=>b.id===currentBlock);
  const sty=draft.styles[currentBlock]||{align:'left',size:16,bold:false};
  const signature=draft.signatureOffsets[activeSignature]||{x:0,y:0};
  return '<div class="te-fields">'+
   (activeSignature?'<div class="te-field-title">ย้ายชุดลายเซ็น (ชื่อและตำแหน่งล็อกไว้)</div><label>ซ้าย / ขวา (-15 ถึง 15 มม.)</label><input class="input" type="number" min="-15" max="15" step="1" data-tpl-field="signatureX" value="'+signature.x+'"><label>ขึ้น / ลง (-15 ถึง 15 มม.)</label><input class="input" type="number" min="-15" max="15" step="1" data-tpl-field="signatureY" value="'+signature.y+'"><p class="hint">ลากบล็อกลงนามในหน้า A4 ได้ทั้งชุด โดยชื่อ ตำแหน่ง และวันที่จะอยู่ด้วยกัน</p>':'')+
   '<label>หัวเรื่อง (เว้นว่างเพื่อใช้แม่แบบกลาง)</label><input class="input" data-tpl-field="title" maxlength="400" value="'+esc(draft.title||'')+'" placeholder="'+esc(page.name)+'">'+
   '<label>บรรทัดอ้างกฎหมาย (เว้นว่างเพื่อใช้ต้นฉบับ)</label><textarea class="input" data-tpl-field="legal" rows="2" maxlength="400" placeholder="ใช้ข้อความกฎหมายต้นฉบับ">'+esc(draft.legal||'')+'</textarea>'+
   '<p class="hint">กรณีแก้ถ้อยคำกฎหมาย ต้องตรวจสอบกับระเบียบที่ใช้อยู่ก่อนประกาศใช้</p>'+
   '<div class="te-field-title">บล็อกที่เลือก</div>'+
   (currentBlock?(currentBlock.startsWith('x')?'<label>ข้อความ (ใช้ตัวแปรได้ เช่น {{school_name}})</label><textarea class="input te-block-textarea" rows="5" maxlength="4000" data-tpl-field="blockText">'+esc(cur?.text||'')+'</textarea>':
   '<p class="hint">คลิกข้อความทั่วไปบนกระดาษ A4 แล้วพิมพ์แก้ไขได้โดยตรง ส่วนข้อความสีฟ้าเป็นข้อมูลอัตโนมัติ เช่น ชื่อผู้ขาย ชื่อเจ้าหน้าที่ วันที่ และจำนวนเงิน จึงล็อกไว้ คุณสามารถจัดแนว ขนาดตัวอักษร หรือย้ายบล็อกได้</p>')+
   '<div class="te-style-controls"><label>ขนาดตัวอักษร <select class="select" data-tpl-field="size">'+[12,14,16,18,20,22,24].map(x=>'<option value="'+x+'" '+(Number(cur?.size||sty.size||16)===x?'selected':'')+'>'+x+' pt</option>').join('')+'</select></label>'+
   '<label>จัดแนว <select class="select" data-tpl-field="align">'+[['left','ซ้าย'],['center','กลาง'],['right','ขวา']].map(([x,label])=>'<option value="'+x+'" '+((cur?.align||sty.align)===x?'selected':'')+'>'+label+'</option>').join('')+'</select></label>'+
   '<label><input type="checkbox" data-tpl-field="bold" '+((cur?.bold||sty.bold)?'checked':'')+'> ตัวหนา</label></div>'+
   (cur?btn('ลบบล็อกนี้','tpl-remove','secondary'):''):'<p class="hint">เลือกบล็อกจากรายการเพื่อปรับรูปแบบ หรือเพิ่มข้อความใหม่</p>')+
   '<details><summary>ตัวแปรข้อมูลที่ใช้ในบล็อกเพิ่มเติม</summary><div class="te-vars">'+
    Object.entries(TEMPLATE_VARIABLES).map(([k,v])=>'<button type="button" class="mini-btn" data-action="tpl-token" data-token="'+k+'">{{'+k+'}} <small>'+esc(v)+'</small></button>').join('')+
    '</div></details></div>';
 }
 function view(){
  const page=TEMPLATE_PAGES.find(p=>p.key===selected);
  const seq=blockSeq();const draftStatus=dirty?'<span class="tag amber">ยังไม่บันทึก</span>':'<span class="tag">บันทึกแล้ว</span>';
  const activeStyle=currentBlock.startsWith('x')?draft.blocks.find(b=>b.id===currentBlock)||{}:draft.styles[currentBlock]||{};
  const ribbon='<div class="te-word-ribbon" aria-label="เครื่องมือจัดรูปแบบเหมือน Word">'+
   '<strong>เครื่องมือจัดข้อความ</strong>'+
   btn('B','tpl-format','te-ribbon-btn','data-format="bold" title="ตัวหนาทั้งบล็อก"')+
   btn('≡','tpl-format','te-ribbon-btn','data-format="left" title="ชิดซ้าย"')+
   btn('☰','tpl-format','te-ribbon-btn','data-format="center" title="กึ่งกลาง"')+
   btn('≣','tpl-format','te-ribbon-btn','data-format="right" title="ชิดขวา"')+
   '<label>ขนาด <select class="select" data-tpl-field="ribbonSize">'+
    [12,14,16,18,20,22,24].map(n=>'<option value="'+n+'" '+(Number(activeStyle.size||16)===n?'selected':'')+'>'+n+' pt</option>').join('')+
   '</select></label>'+
   '<small>คลิกข้อความแล้วแก้ไขบนหน้าเอกสารได้เลย • เลือกบล็อกเพื่อจัดรูปแบบ • ชื่อและตัวเลขที่ผูกระบบจะแก้ไม่ได้</small></div>';
  const src='<div class="te-builder"><aside class="te-pane">'+
   (inlineAlert?'<div class="te-lock-alert" role="status">'+esc(inlineAlert)+'</div>':'')+
   '<div class="te-pane-title"><h2>บล็อกเอกสาร</h2>'+draftStatus+'</div>'+
   '<p class="hint">คลิกข้อความบน A4 เพื่อพิมพ์แก้คำทั่วไปได้ทันที • ข้อความสีฟ้าคือข้อมูลล็อกจากระบบ • ลากชุดผู้ลงนามเพื่อขยับตำแหน่ง</p>'+
   '<ol class="te-block-list">'+seq.map((id,i)=>'<li class="te-block '+(id===currentBlock?'te-selected':'')+'" draggable="true" data-template-drag="'+esc(id)+'">'+
    '<button class="te-block-open" data-action="tpl-block" data-id="'+esc(id)+'"><span class="te-drag-handle">⠿</span>'+esc(blockName(id))+'</button>'+
    '<span class="te-block-btns">'+btn('↑','tpl-up','mini-btn','data-id="'+esc(id)+'"')+btn('↓','tpl-down','mini-btn','data-id="'+esc(id)+'"')+'</span></li>').join('')+'</ol>'+
   '<label>เพิ่มองค์ประกอบ</label><div class="te-newblock"><select class="select" id="tpl-new-type"><option value="paragraph">ข้อความ</option><option value="heading">หัวข้อ</option><option value="note">หมายเหตุ</option><option value="divider">เส้นคั่น</option></select>'+
   btn('เพิ่มบล็อก','tpl-add','primary')+'</div>'+fields()+'</aside>'+
   '<section class="te-right"><div class="te-preview-caption"><strong>ตัวอย่าง A4 — '+esc(page.name)+'</strong><span>ข้อมูลจากรายการตัวอย่าง · แสดงผลแม่แบบฉบับร่าง</span></div>'+
   ribbon+'<div class="te-preview-scroll"><div id="te-print-preview">'+pagePreviewHtml()+'</div></div>'+
   '<div class="alert">แม่แบบนี้ใช้เฉพาะโรงเรียนของคุณ เมื่อบันทึกจะยังไม่กระทบการพิมพ์ จนกด “ประกาศใช้”</div></section></div>';
  const version='เวอร์ชันใช้งาน '+(row()?.published_version||'แม่แบบกลาง')+' · ฉบับร่างแก้ไขครั้งที่ '+revision;
  shell('แม่แบบเอกสาร','ออกแบบเอกสารเฉพาะโรงเรียน',heading('จัดการแม่แบบเอกสาร','เลือกแต่ละหน้า ลากจัดบล็อก แล้วบันทึกฉบับร่างก่อนประกาศใช้')+
   '<section class="card te-header"><div class="te-tabs">'+TEMPLATE_PAGES.map(p=>btn(p.name,'tpl-page',p.key===selected?'primary':'secondary','data-key="'+p.key+'"')).join('')+'</div>'+
   '<div class="te-actions"><small>'+esc(version)+'</small>'+btn('บันทึกฉบับร่าง','tpl-save','secondary')+btn('ประกาศใช้แม่แบบนี้','tpl-publish','primary')+
   btn('ประวัติ / คืนเวอร์ชัน','tpl-history','secondary')+btn('คืนค่าแบบกลาง','tpl-reset','secondary')+'</div></section>'+
   src+(history.length?'<section class="card te-history"><h2>ประวัติแม่แบบที่ประกาศใช้</h2>'+
    history.map(h=>'<div class="row"><span>เวอร์ชัน '+h.version+' · '+esc(h.published_at?.slice(0,10)||'')+'</span>'+
    btn('นำกลับมาแก้เป็นฉบับร่าง','tpl-restore','secondary','data-version="'+h.version+'"')+'</div>').join('')+'</section>':''));
 }
 function refreshPreview(){const host=document.querySelector('#te-print-preview');if(host)host.innerHTML=pagePreviewHtml();}
 function rerender(){view();}
 function editField(el){
  const field=el.dataset.tplField;if(!field)return;
  const target=draft.blocks.find(b=>b.id===currentBlock),sty=draft.styles[currentBlock]||(draft.styles[currentBlock]={align:'left',size:16,bold:false});
  const value=el.type==='checkbox'?el.checked:el.value;
  if(field==='ribbonSize'){if(!currentBlock)return;const t=draft.blocks.find(b=>b.id===currentBlock);if(t)t.size=Number(value);else if(currentBlock.startsWith('d'))draft.styles[currentBlock]={...(draft.styles[currentBlock]||{}),size:Number(value)};}
  else if(field==='signatureX'||field==='signatureY'){if(!activeSignature)return;const now=draft.signatureOffsets[activeSignature]||{x:0,y:0};draft.signatureOffsets[activeSignature]=safeSignatureOffset({...now,[field==='signatureX'?'x':'y']:value});}
  else if(field==='title'||field==='legal')draft[field]=String(value);
  else if(field==='blockText'&&target)target.text=String(value);
  else if(['size','align','bold'].includes(field)){
   if(target)target[field]=field==='size'?Number(value):value;
   else if(currentBlock.startsWith('d'))sty[field]=field==='size'?Number(value):value;
  }
  dirty=true;refreshPreview();
  const badge=document.querySelector('.te-pane-title .tag');if(badge){badge.textContent='ยังไม่บันทึก';badge.classList.add('amber');}
 }
 const move=(id,delta)=>{const seq=blockSeq(),i=seq.indexOf(id),j=i+delta;if(i<0||j<0||j>=seq.length)return;[seq[i],seq[j]]=[seq[j],seq[i]];draft.order=seq;dirty=true;view();};
 async function save(){
  draft=safeTemplateDraft(draft);
  if(state.demo)return notify('โหมดสาธิต: ทดลองออกแบบได้ แต่ไม่บันทึกขึ้นระบบ');
  const {data,error}=await db.rpc('save_school_document_template',{p_school_id:state.school.id,p_template_key:selected,p_layout:draft,p_expected_revision:revision});
  if(error)throw Error('บันทึกแม่แบบไม่สำเร็จ: '+error.message);
  revision=Number(data);dirty=false;await load();notify('บันทึกฉบับร่างแล้ว (ยังไม่ประกาศใช้)');state.page='templates';view();
 }
 async function publish(){
  if(dirty)throw Error('กรุณาบันทึกฉบับร่างก่อนประกาศใช้');
  if(state.demo)return notify('โหมดสาธิตยังไม่เปิดให้ประกาศใช้');
  if(!confirm('ยืนยันประกาศใช้แม่แบบ "'+TEMPLATE_PAGES.find(p=>p.key===selected).name+'"? เจ้าหน้าที่ของโรงเรียนจะพิมพ์เอกสารตามรูปแบบใหม่นับจากนี้'))return;
  const {data,error}=await db.rpc('publish_school_document_template',{p_school_id:state.school.id,p_template_key:selected,p_expected_revision:revision});
  if(error)throw Error('ประกาศใช้แม่แบบไม่สำเร็จ: '+error.message);
  await load();history=[];dirty=false;notify('ประกาศใช้แม่แบบเวอร์ชัน '+data+' สำเร็จ');state.page='templates';view();
 }
 async function action(name,el){
  if(name==='tpl-page'){
   if(dirty&&!confirm('มีการแก้ไขที่ยังไม่บันทึก ต้องการเปลี่ยนหน้าโดยทิ้งการแก้ไขหรือไม่?'))return;
   selected=el.dataset.key;history=[];assignDraft();view();return;
  }
  if(name==='tpl-format'){
   if(!currentBlock){lockedNotice();return;}
   const prop=String(el.dataset.format||'');
   const custom=draft.blocks.find(b=>b.id===currentBlock);
   const style=custom||draft.styles[currentBlock]||(draft.styles[currentBlock]={align:'left',size:16,bold:false});
   if(prop==='bold')style.bold=!style.bold;
   else if(['left','center','right'].includes(prop))style.align=prop;
   dirty=true;view();return;
  }
  if(name==='tpl-block'){currentBlock=el.dataset.id;activeSignature='';view();return;}
  if(name==='tpl-signature'){activeSignature=el.dataset.id;currentBlock='';view();return;}
  if(name==='tpl-add'){
   if(draft.blocks.length>=24)throw Error('เพิ่มได้สูงสุด 24 บล็อก');
   const type=document.querySelector('#tpl-new-type')?.value||'paragraph';
   const id='x'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
   draft.blocks.push({id,type,text:type==='divider'?'':'พิมพ์ข้อความของโรงเรียน...',align:'left',size:16,bold:false,placement:'after-content'});
   draft.order=blockSeq();currentBlock=id;dirty=true;view();return;
  }
  if(name==='tpl-up'||name==='tpl-down'){move(el.dataset.id,name==='tpl-up'?-1:1);return;}
  if(name==='tpl-remove'){draft.blocks=draft.blocks.filter(b=>b.id!==currentBlock);draft.order=draft.order.filter(x=>x!==currentBlock);currentBlock='';dirty=true;view();return;}
  if(name==='tpl-token'){
   if(!currentBlock.startsWith('x'))return notify('โปรดเลือกบล็อกข้อความเพิ่มเติมก่อนแทรกตัวแปร',true);
   const block=draft.blocks.find(b=>b.id===currentBlock);if(!block)return;
   block.text+='{{'+el.dataset.token+'}}';dirty=true;view();return;
  }
  if(name==='tpl-save')return save();
  if(name==='tpl-publish')return publish();
  if(name==='tpl-history'){await loadVersions();view();return;}
  if(name==='tpl-restore'){
   const h=history.find(x=>x.version===Number(el.dataset.version));
   if(!h||!confirm('นำแม่แบบเวอร์ชัน '+h.version+' กลับมาเป็นฉบับร่าง? ยังไม่เปลี่ยนแม่แบบใช้งานจนกว่าจะบันทึกและประกาศใช้'))return;
   draft=safeTemplateDraft(h.layout);currentBlock='';dirty=true;view();return;
  }
  if(name==='tpl-reset'){
   if(!confirm('คืนค่าแม่แบบกลางสำหรับหน้านี้ในฉบับร่าง? ต้องบันทึกและประกาศใช้จึงจะเปลี่ยนหน้าเอกสารของเจ้าหน้าที่'))return;
   draft=emptyTemplate();currentBlock='';dirty=true;view();return;
  }
 }
 function lockedNotice(){
  inlineAlert='ชื่อบุคคล ตำแหน่ง เลขเอกสาร วันที่ และยอดเงินส่วนนี้ดึงจากฐานข้อมูล จึงแก้บนแม่แบบไม่ได้ กรุณาแก้ที่ข้อมูลโรงเรียนหรือรายการจัดซื้อแทน';
  const el=document.querySelector('.te-lock-alert');if(el)el.textContent=inlineAlert;
  else {const panel=document.querySelector('.te-pane');panel?.insertAdjacentHTML('afterbegin','<div class="te-lock-alert" role="status">'+templateEsc(inlineAlert)+'</div>');}
 }
 function inlineInput(el){
  const bits=String(el.dataset.templateText||'').split(':');
  if(bits.length!==3)return;
  const [id,index,fragmentIndex]=bits;
  const page=sourcePage(),source=structuralBlocks(page).nodes[Number(id.slice(1))];
  if(!source)return;
  const texts=currentTextNodes(source,document),base=texts[Number(index)];
  if(!base)return;
  const initial=tokenizeOriginalText(base.textContent,editorRecord(),state.school).filter(p=>p.kind==='text').map(p=>p.value);
  if(!draft.textEdits[id])draft.textEdits[id]={};
  const array=draft.textEdits[id][index]||initial;
  if(Number(fragmentIndex)>=array.length)return;
  array[Number(fragmentIndex)]=String(el.textContent||'').replace(/\u200b/g,'').slice(0,4000);
  draft.textEdits[id][index]=array;
  dirty=true;
  const badge=document.querySelector('.te-pane-title .tag');
  if(badge){badge.textContent='ยังไม่บันทึก';badge.classList.add('amber');}
 }
 function selectInline(el){
  const id=String(el?.dataset?.templateText||'').split(':')[0];
  if(/^d\d{1,2}$/.test(id))currentBlock=id;
 }
 function headerInput(el){
  const type=el?.dataset?.templateHeader;
  if(type!=='title'&&type!=='legal')return;
  draft[type]=String(el.textContent||'').slice(0,400);
  dirty=true;
  const badge=document.querySelector('.te-pane-title .tag');
  if(badge){badge.textContent='ยังไม่บันทึก';badge.classList.add('amber');}
 }
 function refreshEditorText(el){
  if(!el?.dataset?.templateText)return;
  inlineInput(el);
 }
 function moveSignature(id,x,y){
  if(!/^(staff[01]|director|finance|inspector|requisition[0-3])$/.test(id))return;
  const now=draft.signatureOffsets[id]||{x:0,y:0};
  draft.signatureOffsets[id]=safeSignatureOffset({x:now.x+x,y:now.y+y});
  activeSignature=id;currentBlock='';dirty=true;view();
 }
 let dragging='';
 function dragStart(el,ev){dragging=el.dataset.templateDrag||'';if(ev.dataTransfer){ev.dataTransfer.effectAllowed='move';ev.dataTransfer.setData('text/plain',dragging);}}
 function drop(el,ev){ev.preventDefault();const from=dragging,to=el.dataset.templateDrag;dragging='';if(!from||!to||from===to)return;const order=blockSeq(),i=order.indexOf(from),j=order.indexOf(to);if(i<0||j<0)return;order.splice(i,1);order.splice(j,0,from);draft.order=order;dirty=true;view();}
 return {open,load,view,action,editField,dragStart,drop,refreshPreview,inlineInput,lockedNotice,refreshEditorText,moveSignature,headerInput,selectInline};
}
