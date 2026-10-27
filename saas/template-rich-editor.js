// Rich text editing on existing government forms. Dynamic values are NOT persisted:
// textEdits stores only literal fragments between verified system-derived tokens.
const THAI_MONTHS=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
export function thaiSystemDate(s){
 const m=/^(\d{4})-(\d\d)-(\d\d)$/.exec(String(s||''));
 return m?Number(m[3])+' '+THAI_MONTHS[Number(m[2])-1]+' '+(Number(m[1])+543):'';
}
function amountText(satang){return (Number(satang||0)/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});}
export function protectedValues(r={},s={}){
 const m=r.document_meta||{},signers=r.signers||{};
 const values=[
 ['school_name',s.name],['director_name',signers.director||s.director_name],
 ['officer_name',signers.officer||s.officer_name],['head_name',signers.head||s.head_name],
 ['finance_name',s.finance_name],['inspector_name',r.inspector_name],
 ['vendor_name',r.vendor_name],['vendor_address',r.vendor_address],['department',r.department],
 ['budget_source',r.budget_source],['reason',r.reason],['title',r.title],
 ['document_date',thaiSystemDate(r.document_date)],['due_date',thaiSystemDate(r.due_date)],
 ['delivery_date',thaiSystemDate(m.delivery_date)],['inspection_date',thaiSystemDate(m.inspection_date)],
 ['invoice_date',thaiSystemDate(m.invoice_date)],['order_date',thaiSystemDate(m.order_date)],
 ['acceptance_date',thaiSystemDate(m.acceptance_date)],['requisition_date',thaiSystemDate(m.requisition_date)],
 ['total_amount',amountText(r.total_satang)],['inspector_position',m.inspector_position],
 ['requester_name',m.requester_name],['issuer_name',m.issuer_name],['receiver_name',m.receiver_name],
 ['delegate_name',m.delegate_name],['memo_number',m.memo_number],['approval_memo_number',m.approval_memo_number],
 ['payment_memo_number',m.payment_memo_number],['acceptance_number',m.acceptance_number],
 ['requisition_number',m.requisition_number],['order_number',m.order_number],['invoice_number',m.invoice_number],
 ['fiscal_year',String(r.fiscal_year||'')],
 ['role_director',s.name?'ผู้อำนวยการ'+s.name:''],
 ['role_head','หัวหน้าเจ้าหน้าที่'],['role_officer','เจ้าหน้าที่การเงิน']
 ];
 for(let i=0;i<(r.items||[]).length;i++){
  const item=r.items[i];values.push(['item_name_'+i,item.name],['unit_price_'+i,amountText(item.price_satang)],['line_total_'+i,amountText(item.price_satang*item.qty)]);
 }
 for(const field of ['withholding_baht','fine_baht','payable_baht','vat_baht']){
  if(m[field]!==undefined && m[field]!==null && String(m[field])!=='')
   values.push([field,Number(m[field]).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})]);
 }
 const known=new Set();
 return values.filter(([,v])=>String(v||'').length>=3).filter(([,v])=>{
  if(known.has(String(v)))return false;known.add(String(v));return true;
 }).sort((a,b)=>String(b[1]).length-String(a[1]).length);
}
export function tokenizeOriginalText(input,r,s){
 const str=String(input||''),options=protectedValues(r,s),result=[];
 let pos=0;
 while(pos<str.length){
  let match=null,at=str.length;
  for(const [key,value] of options){
   const start=str.indexOf(value,pos);
   if(start>=0 && start<at){at=start;match={key,value};}
  }
  if(!match){result.push({kind:'text',value:str.slice(pos)});break;}
  result.push({kind:'text',value:str.slice(pos,at)});
  result.push({kind:'locked',key:match.key,value:String(match.value)});
  pos=at+match.value.length;
 }
 if(!result.length)result.push({kind:'text',value:''});
 return result;
}
export function applyTextFragments(base,fragments,r,s){
 const parts=tokenizeOriginalText(base,r,s);
 const editable=parts.filter(p=>p.kind==='text');
 if(!Array.isArray(fragments)||fragments.length!==editable.length||!fragments.every(x=>typeof x==='string'&&x.length<=4000))return base;
 let i=0;
 return parts.map(p=>p.kind==='locked'?p.value:fragments[i++]).join('');
}
export function currentTextNodes(element,doc){
 const showText=doc.defaultView?.NodeFilter?.SHOW_TEXT??4;
 const walker=doc.createTreeWalker(element,showText),nodes=[];let node;
 while((node=walker.nextNode())){
  if(node.parentElement?.closest('.signature-card,.kp-signature,.te-system-locked'))continue;
  nodes.push(node);
 }
 return nodes;
}
export function applyTextEditsToBlock(element,edits,r,s,doc){
 if(!edits||typeof edits!=='object')return;
 const nodes=currentTextNodes(element,doc);
 for(const [k,fragments] of Object.entries(edits)){
  if(!/^(0|[1-9]\d{0,2})$/.test(k))continue;
  const node=nodes[Number(k)];if(!node)continue;
  node.textContent=applyTextFragments(node.textContent,fragments,r,s);
 }
}
export function signatureElements(section){
 // Each signing PARTY is one atomic draggable unit: name/role/date stay together.
 const output=[];
 const add=(el,id,label)=>{if(el&&!output.some(v=>v.el===el))output.push({el,id,label});};
 const signGrid=section.querySelectorAll('.sign-grid>.signature-card');
 signGrid.forEach((el,i)=>add(el,'staff'+i,i?'หัวหน้าเจ้าหน้าที่':'เจ้าหน้าที่พัสดุ'));
 const vertical=section.querySelectorAll('.gov-vertical-sign>.signature-card');
 vertical.forEach((el,i)=>add(el,'staff'+i,i?'หัวหน้าเจ้าหน้าที่':'เจ้าหน้าที่พัสดุ'));
 const director=section.querySelector('.director-sign,.gov-payment-director-sign');
 add(director,'director','ผู้อำนวยการ');
 add(section.querySelector('.gov-finance-sign'),'finance','เจ้าหน้าที่การเงิน');
 add(section.querySelector('.gov-inspector-sign'),'inspector','ผู้ตรวจรับ');
 const inspection=section.querySelectorAll('.gov-inspection-bottom .sign-grid>.signature-card');
 inspection.forEach((el,i)=>add(el,'staff'+i,i?'หัวหน้าเจ้าหน้าที่':'เจ้าหน้าที่พัสดุ'));
 section.querySelectorAll('.gov-requisition-signatures>div').forEach((el,i)=>add(el,'requisition'+i,['ผู้เบิก','ผู้สั่งจ่าย','ผู้มอบ','ผู้รับของ'][i]||'ผู้ลงนาม'));
 return output;
}
export function safeSignatureOffset(input){
 return {x:Math.max(-15,Math.min(15,Number(input?.x)||0)),
  y:Math.max(-15,Math.min(15,Number(input?.y)||0))};
}
export function applySignatureOffsets(section,offsets={}){
 for(const {el,id} of signatureElements(section)){
  const {x,y}=safeSignatureOffset(offsets[id]);
  if(x||y){
   el.style.setProperty('translate',x+'mm '+y+'mm');
   el.dataset.templateSignature=id;
  }
 }
}
export function decorateSignatureHandles(section,selected=''){
 for(const {el,id,label} of signatureElements(section)){
  el.dataset.templateSignature=id;
  el.dataset.templateSignatureLabel=label;
  el.classList.add('te-signature-handle');
  if(selected===id)el.classList.add('te-canvas-selected');
 }
}
