import {escapeHtml as e,normalizeMemoPrefix,normalizeMemoNumber,memoNumberTokens} from './print.js';
/* One source per fact. Derived values such as fiscal year, budget source,
   gross total, payment subtotal and receipt dates are not requested twice. */
export const documentInfoFields=[["memo_prefix","รหัส พว. (ใช้เฉพาะรายงานขอซื้อ/ขอจ้าง)"],["memo_number","ที่ — รายงานขอซื้อ/ขอจ้าง (เฉพาะเลข เช่น 1/2569)"],["approval_memo_number","ที่ — รายงานผลการพิจารณาฯ (ใส่เฉพาะเลข ไม่ใช้ พว.)"],["payment_memo_number","ที่ — ทราบผลและขออนุมัติเบิกจ่าย (ใส่เฉพาะเลข ไม่ใช้ พว.)"],["inspector_position","ตำแหน่งผู้ตรวจรับพัสดุ"],["order_number","เลขที่ใบสั่งซื้อ / สั่งจ้าง"],["order_date","วันที่ใบสั่งซื้อ / สั่งจ้าง","date"],["delivery_date","วันที่ส่งมอบจริง","date"],["invoice_number","เลขที่ใบส่งของ / ใบเสร็จ"],["invoice_date","วันที่ใบส่งของ / ใบเสร็จ","date"],["acceptance_number","เลขที่ใบตรวจรับ (ระบบออกรันให้ แก้ไขได้)"],["inspection_date","วันที่ตรวจรับจริง (เฉพาะกรณีต่างจากวันส่งมอบ)","date"],["inspection_location","สถานที่ตรวจรับ (เฉพาะกรณีต้องระบุ)"],["inspection_expert","ผู้ทรงคุณวุฒิ (ถ้ามี)"],["vat_baht","ภาษีมูลค่าเพิ่มตามหลักฐาน (บาท)","number"],["withholding_baht","ภาษีหัก ณ ที่จ่าย (บาท)","number"],["fine_baht","ค่าปรับ (บาท)","number"],["payable_baht","คงเหลือจ่ายจริง (บาท) — ระบบคำนวณให้ แก้ไขได้","number"],["budget_total_baht","งบประมาณที่มี (บาท)","number"],["budget_paid_baht","จ่ายไปแล้ว (บาท)","number"],["finance_note","ความเห็นเพิ่มเติมของเจ้าหน้าที่การเงิน"],["requisition_number","เลขที่ใบเบิกพัสดุ"],["requester_name","ชื่อผู้เบิก"],["requester_position","ตำแหน่งผู้เบิก"],["receiver_name","ชื่อผู้รับของ"],["delegate_name","ชื่อผู้รับของแทน (ถ้ามี)"],["requisition_date","วันที่ใบเบิก (เฉพาะเมื่อไม่ใช้วันส่งมอบ)","date"]];
export const documentInfoGroups=[{"id":"order","title":"1. เอกสารสั่งซื้อ / สั่งจ้าง","description":"กรอกเฉพาะเลขที่และวันที่จากใบสั่งซื้อหรือใบสั่งจ้างจริง","fields":[["order_number","เลขที่ใบสั่งซื้อ / สั่งจ้าง"],["order_date","วันที่ใบสั่งซื้อ / สั่งจ้าง","date"]]},{"id":"delivery","title":"2. ส่งมอบและตรวจรับ","description":"วันที่ตรวจรับและวันที่ใบตรวจรับใช้วันส่งมอบโดยอัตโนมัติ เว้นแต่มีการตรวจรับจริงต่างวัน","fields":[["delivery_date","วันที่ส่งมอบจริง","date"],["invoice_number","เลขที่ใบส่งของ / ใบเสร็จ"],["invoice_date","วันที่ใบส่งของ / ใบเสร็จ","date"],["acceptance_number","เลขที่ใบตรวจรับ (ระบบออกรันให้ แก้ไขได้)"]],"advanced":[["inspection_date","วันที่ตรวจรับจริง (เฉพาะกรณีต่างจากวันส่งมอบ)","date"],["inspection_location","สถานที่ตรวจรับ (เฉพาะกรณีต้องระบุ)"],["inspection_expert","ผู้ทรงคุณวุฒิ (ถ้ามี)"]]},{"id":"finance","title":"3. ข้อมูลเบิกจ่าย","description":"ระบบคำนวณคงเหลือจ่ายจริงจากวงเงินรวม หักภาษีและค่าปรับ (ถ้ามี) สามารถแก้ไขยอดสุทธิเมื่อหลักฐานระบุยอดต่างได้","fields":[["vat_baht","ภาษีมูลค่าเพิ่มตามหลักฐาน (บาท)","number"],["withholding_baht","ภาษีหัก ณ ที่จ่าย (บาท)","number"],["fine_baht","ค่าปรับ (บาท)","number"],["payable_baht","คงเหลือจ่ายจริง (บาท) — ระบบคำนวณให้ แก้ไขได้","number"]],"advanced":[["budget_total_baht","งบประมาณที่มี (บาท)","number"],["budget_paid_baht","จ่ายไปแล้ว (บาท)","number"],["finance_note","ความเห็นเพิ่มเติมของเจ้าหน้าที่การเงิน"]]},{"id":"requisition","title":"4. ใบเบิกพัสดุ","description":"ดึงชื่อผู้สั่งจ่ายจากหัวหน้าเจ้าหน้าที่พัสดุ และใช้ข้อมูลรายการพัสดุเดิม","fields":[["requisition_number","เลขที่ใบเบิกพัสดุ"],["requester_name","ชื่อผู้เบิก"],["requester_position","ตำแหน่งผู้เบิก"],["receiver_name","ชื่อผู้รับของ"]],"advanced":[["delegate_name","ชื่อผู้รับของแทน (ถ้ามี)"],["requisition_date","วันที่ใบเบิก (เฉพาะเมื่อไม่ใช้วันส่งมอบ)","date"]]}];
export const primaryDocumentFields=[["memo_prefix","รหัส พว. (ใช้เฉพาะรายงานขอซื้อ/ขอจ้าง)"],["memo_number","ที่ — รายงานขอซื้อ/ขอจ้าง (เฉพาะเลข เช่น 1/2569)"],["approval_memo_number","ที่ — รายงานผลการพิจารณาฯ (ใส่เฉพาะเลข ไม่ใช้ พว.)"],["payment_memo_number","ที่ — ทราบผลและขออนุมัติเบิกจ่าย (ใส่เฉพาะเลข ไม่ใช้ พว.)"],["inspector_position","ตำแหน่งผู้ตรวจรับพัสดุ"]];
const editableKeys=new Set(documentInfoFields.map(([key])=>key));
const memoNumbers=new Set(['memo_number','approval_memo_number','payment_memo_number']);
function fieldHtml([key,label,type],meta){
 const inputType=type||'text',raw=meta?.[key]??meta?.['doc_'+key]??'';
 const value=key==='memo_prefix'?normalizeMemoPrefix(raw):
  memoNumbers.has(key)&&memoNumberTokens(raw).length<=1?
   normalizeMemoNumber(raw,meta?.memo_prefix??meta?.doc_memo_prefix??''):raw;
 const placeholder=key==='memo_prefix'?'พว.':memoNumbers.has(key)?'เช่น 2/2569 (ไม่ต้องใส่ พว.)':inputType==='date'?'เลือกวันที่':'ไม่ทราบให้เว้นว่าง';
 return '<div class="field"><label for="doc_'+e(key)+'">'+e(label)+'</label><input class="input" id="doc_'+e(key)+'" name="doc_'+e(key)+'" type="'+inputType+'" '+(inputType==='number'?'min="0" step=".01" inputmode="decimal"':'')+' value="'+e(value)+'" placeholder="'+placeholder+'"></div>';
}
export function docMetaInputs(meta={},options={}){
 const mode=typeof options==='string'?options:(options.mode||'all');
 if(mode==='create')return '<div class="form-grid">'+primaryDocumentFields.map(f=>fieldHtml(f,meta)).join('')+'</div><p class="hint">พว. ใช้เฉพาะรายงานขอซื้อ/ขอจ้าง ส่วนเอกสารรายงานผลและเบิกจ่ายใช้คำว่า ที่ ตามด้วยเลขที่เท่านั้น</p>';
 const main='<section class="doc-meta-section"><h3>เลขที่หนังสือแต่ละฉบับ และตำแหน่งผู้ตรวจรับ</h3><div class="form-grid">'+primaryDocumentFields.map(f=>fieldHtml(f,meta)).join('')+'</div></section>';
 const sections=documentInfoGroups.map(g=>{
  const extra=g.advanced?.length?'<details class="doc-meta-advanced"><summary>กรณีพิเศษ / ข้อมูลเพิ่มเติม</summary><div class="form-grid">'+g.advanced.map(f=>fieldHtml(f,meta)).join('')+'</div></details>':'';
  return '<details class="doc-meta-section" '+(g.id==='order'?'open':'')+'><summary>'+e(g.title)+'</summary><p class="hint">'+e(g.description)+'</p><div class="form-grid">'+g.fields.map(f=>fieldHtml(f,meta)).join('')+'</div>'+extra+'</details>';
 }).join('');
 return main+sections+'<p class="hint">ใช้ พว. เฉพาะรายงานขอซื้อ/ขอจ้าง เอกสารฉบับอื่นใช้เลขหลังคำว่า ที่ เท่านั้น ยอดเงินรวมและกิจกรรม/โครงการเชื่อมจากข้อมูลหลัก ส่วนยอดเบิกจ่ายคำนวณอัตโนมัติเมื่อไม่กรอกยอดสุทธิเอง</p>';
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
  let normalized=String(value??'').trim();
  if(key==='memo_prefix')normalized=normalizeMemoPrefix(normalized);
  if(memoNumbers.has(key)&&normalized){
   const tokens=memoNumberTokens(normalized);
   if(tokens.length>1)throw Error('ช่องเลขที่หนังสือใส่หลายเลข กรุณาเหลือเลขที่เพียงชุดเดียว เช่น 2/2569');
   normalized=normalizeMemoNumber(normalized,next.memo_prefix||obj.doc_memo_prefix||'');
   if(!/^[0-9๐-๙]{1,7}\/[0-9๐-๙]{4}$/u.test(normalized))throw Error('เลขที่หนังสือต้องเป็นรูปแบบ 2/2569 โดยไม่ต้องใส่ พว.');
  }
  if(normalized)next[key]=normalized;
  else delete next[key];
 }
 return next;
}
