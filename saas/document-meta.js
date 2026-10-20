import {escapeHtml as e} from './print.js';
/* One source per fact. Derived values such as fiscal year, budget source,
   gross total, payment subtotal and receipt dates are not requested twice. */
export const documentInfoFields=[["memo_prefix","รหัสหนังสือราชการ เช่น พว."],["memo_number","ที่ — รายงานขอซื้อพัสดุ / รายงานขอจ้าง"],["approval_memo_number","ที่ — รายงานผลการพิจารณาและขออนุมัติสั่งซื้อ / สั่งจ้าง"],["payment_memo_number","ที่ — ทราบผลและขออนุมัติเบิกจ่าย"],["inspector_position","ตำแหน่งผู้ตรวจรับพัสดุ"],["order_number","เลขที่ใบสั่งซื้อ / สั่งจ้าง"],["order_date","วันที่ใบสั่งซื้อ / สั่งจ้าง","date"],["delivery_date","วันที่ส่งมอบจริง","date"],["invoice_number","เลขที่ใบส่งของ / ใบเสร็จ"],["invoice_date","วันที่ใบส่งของ / ใบเสร็จ","date"],["acceptance_number","เลขที่ใบตรวจรับ (ระบบออกรันให้ แก้ไขได้)"],["inspection_date","วันที่ตรวจรับจริง (เฉพาะกรณีต่างจากวันส่งมอบ)","date"],["inspection_location","สถานที่ตรวจรับ (เฉพาะกรณีต้องระบุ)"],["inspection_expert","ผู้ทรงคุณวุฒิ (ถ้ามี)"],["vat_baht","ภาษีมูลค่าเพิ่มตามหลักฐาน (บาท)","number"],["withholding_baht","ภาษีหัก ณ ที่จ่าย (บาท)","number"],["fine_baht","ค่าปรับ (บาท)","number"],["payable_baht","คงเหลือจ่ายจริง (บาท) — ระบบคำนวณให้ แก้ไขได้","number"],["budget_total_baht","งบประมาณที่มี (บาท)","number"],["budget_paid_baht","จ่ายไปแล้ว (บาท)","number"],["finance_note","ความเห็นเพิ่มเติมของเจ้าหน้าที่การเงิน"],["requisition_number","เลขที่ใบเบิกพัสดุ"],["requester_name","ชื่อผู้เบิก"],["requester_position","ตำแหน่งผู้เบิก"],["receiver_name","ชื่อผู้รับของ"],["delegate_name","ชื่อผู้รับของแทน (ถ้ามี)"],["requisition_date","วันที่ใบเบิก (เฉพาะเมื่อไม่ใช้วันส่งมอบ)","date"]];
export const documentInfoGroups=[{"id":"order","title":"1. เอกสารสั่งซื้อ / สั่งจ้าง","description":"กรอกเฉพาะเลขที่และวันที่จากใบสั่งซื้อหรือใบสั่งจ้างจริง","fields":[["order_number","เลขที่ใบสั่งซื้อ / สั่งจ้าง"],["order_date","วันที่ใบสั่งซื้อ / สั่งจ้าง","date"]]},{"id":"delivery","title":"2. ส่งมอบและตรวจรับ","description":"วันที่ตรวจรับและวันที่ใบตรวจรับใช้วันส่งมอบโดยอัตโนมัติ เว้นแต่มีการตรวจรับจริงต่างวัน","fields":[["delivery_date","วันที่ส่งมอบจริง","date"],["invoice_number","เลขที่ใบส่งของ / ใบเสร็จ"],["invoice_date","วันที่ใบส่งของ / ใบเสร็จ","date"],["acceptance_number","เลขที่ใบตรวจรับ (ระบบออกรันให้ แก้ไขได้)"]],"advanced":[["inspection_date","วันที่ตรวจรับจริง (เฉพาะกรณีต่างจากวันส่งมอบ)","date"],["inspection_location","สถานที่ตรวจรับ (เฉพาะกรณีต้องระบุ)"],["inspection_expert","ผู้ทรงคุณวุฒิ (ถ้ามี)"]]},{"id":"finance","title":"3. ข้อมูลเบิกจ่าย","description":"ระบบคำนวณคงเหลือจ่ายจริงจากวงเงินรวม หักภาษีและค่าปรับ (ถ้ามี) สามารถแก้ไขยอดสุทธิเมื่อหลักฐานระบุยอดต่างได้","fields":[["vat_baht","ภาษีมูลค่าเพิ่มตามหลักฐาน (บาท)","number"],["withholding_baht","ภาษีหัก ณ ที่จ่าย (บาท)","number"],["fine_baht","ค่าปรับ (บาท)","number"],["payable_baht","คงเหลือจ่ายจริง (บาท) — ระบบคำนวณให้ แก้ไขได้","number"]],"advanced":[["budget_total_baht","งบประมาณที่มี (บาท)","number"],["budget_paid_baht","จ่ายไปแล้ว (บาท)","number"],["finance_note","ความเห็นเพิ่มเติมของเจ้าหน้าที่การเงิน"]]},{"id":"requisition","title":"4. ใบเบิกพัสดุ","description":"ดึงชื่อผู้สั่งจ่ายจากหัวหน้าเจ้าหน้าที่พัสดุ และใช้ข้อมูลรายการพัสดุเดิม","fields":[["requisition_number","เลขที่ใบเบิกพัสดุ"],["requester_name","ชื่อผู้เบิก"],["requester_position","ตำแหน่งผู้เบิก"],["receiver_name","ชื่อผู้รับของ"]],"advanced":[["delegate_name","ชื่อผู้รับของแทน (ถ้ามี)"],["requisition_date","วันที่ใบเบิก (เฉพาะเมื่อไม่ใช้วันส่งมอบ)","date"]]}];
export const primaryDocumentFields=[["memo_prefix","รหัสหนังสือราชการ เช่น พว."],["memo_number","ที่ — รายงานขอซื้อพัสดุ / รายงานขอจ้าง"],["approval_memo_number","ที่ — รายงานผลการพิจารณาและขออนุมัติสั่งซื้อ / สั่งจ้าง"],["payment_memo_number","ที่ — ทราบผลและขออนุมัติเบิกจ่าย"],["inspector_position","ตำแหน่งผู้ตรวจรับพัสดุ"]];
const editableKeys=new Set(documentInfoFields.map(([key])=>key));
function fieldHtml([key,label,type],meta){
 const inputType=type||'text',value=meta?.[key]??meta?.['doc_'+key]??'';
 return '<div class="field"><label for="doc_'+e(key)+'">'+e(label)+'</label><input class="input" id="doc_'+e(key)+'" name="doc_'+e(key)+'" type="'+inputType+'" '+(inputType==='number'?'min="0" step=".01" inputmode="decimal"':'')+' value="'+e(value)+'" placeholder="'+(inputType==='date'?'เลือกวันที่':'ไม่ทราบให้เว้นว่าง')+'"></div>';
}
export function docMetaInputs(meta={},options={}){
 const mode=typeof options==='string'?options:(options.mode||'all');
 if(mode==='create')return '<div class="form-grid">'+primaryDocumentFields.map(f=>fieldHtml(f,meta)).join('')+'</div><p class="hint">กรอกรหัส พว. และเลขที่หนังสือแยกตามฉบับที่ใช้จริง ข้อมูลตรวจรับและเบิกจ่ายบันทึกภายหลังได้</p>';
 const main='<section class="doc-meta-section"><h3>เลขที่หนังสือแต่ละฉบับ และตำแหน่งผู้ตรวจรับ</h3><div class="form-grid">'+primaryDocumentFields.map(f=>fieldHtml(f,meta)).join('')+'</div></section>';
 const sections=documentInfoGroups.map(g=>{
  const extra=g.advanced?.length?'<details class="doc-meta-advanced"><summary>กรณีพิเศษ / ข้อมูลเพิ่มเติม</summary><div class="form-grid">'+g.advanced.map(f=>fieldHtml(f,meta)).join('')+'</div></details>':'';
  return '<details class="doc-meta-section" '+(g.id==='order'?'open':'')+'><summary>'+e(g.title)+'</summary><p class="hint">'+e(g.description)+'</p><div class="form-grid">'+g.fields.map(f=>fieldHtml(f,meta)).join('')+'</div>'+extra+'</details>';
 }).join('');
 return main+sections+'<p class="hint">เลขหนังสือของแต่ละหน้าเป็นคนละเลข ยอดเงินรวมและกิจกรรม/โครงการเชื่อมจากข้อมูลหลัก ส่วนยอดเบิกจ่ายคำนวณอัตโนมัติเมื่อไม่กรอกยอดสุทธิเอง</p>';
}
/* Merge with the saved metadata. Do not accidentally delete previously
   recorded evidence or legacy fields that have no visible input anymore.
   Clearing a visible field intentionally removes only that particular key. */
export function docMetaValue(obj={},existing={}){
 const next={...(existing&&typeof existing==='object'&&!Array.isArray(existing)?existing:{})};
 for(const [raw,value] of Object.entries(obj||{})){
  if(!raw.startsWith('doc_'))continue;
  const key=raw.slice(4);
  if(!editableKeys.has(key))continue;
  const normalized=String(value??'').trim();
  if(normalized)next[key]=normalized;
  else delete next[key];
 }
 return next;
}
