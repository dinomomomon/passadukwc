import {escapeHtml as e,normalizeMemoPrefix,normalizeMemoNumber,memoNumberTokens} from './print.js';
/* One source per fact. Derived values such as fiscal year, budget source,
   gross total, payment subtotal and receipt dates are not requested twice. */
export const documentInfoFields=[["memo_prefix","รหัสรายงานขอซื้อ/ขอจ้าง (พว. วัสดุ / พค. ครุภัณฑ์)"],["memo_number","ที่ — รายงานขอซื้อ/ขอจ้าง (เฉพาะเลข เช่น 1/2569)"],["approval_memo_number","ที่ — รายงานผลการพิจารณาฯ (ใส่เฉพาะเลข ไม่ใช้ พว.)"],["payment_memo_number","ที่ — ทราบผลและขออนุมัติเบิกจ่าย (ใส่เฉพาะเลข ไม่ใช้ พว.)"],["inspector_position","ตำแหน่งผู้ตรวจรับพัสดุ"],["order_number","เลขที่ใบสั่งซื้อ / สั่งจ้าง"],["order_date","วันที่ใบสั่งซื้อ / สั่งจ้าง","date"],["delivery_date","วันที่ส่งมอบจริง","date"],["invoice_number","เลขที่ใบส่งของ / ใบเสร็จ"],["invoice_date","วันที่ใบส่งของ / ใบเสร็จ","date"],["acceptance_number","เลขที่ใบตรวจรับ (ระบบออกรันให้ แก้ไขได้)"],["inspection_date","วันที่ตรวจรับจริง (เฉพาะกรณีต่างจากวันส่งมอบ)","date"],["inspection_location","สถานที่ตรวจรับ (เฉพาะกรณีต้องระบุ)"],["inspection_expert","ผู้ทรงคุณวุฒิ (ถ้ามี)"],["vat_baht","ภาษีมูลค่าเพิ่มตามหลักฐาน (บาท)","number"],["withholding_baht","ภาษีหัก ณ ที่จ่าย (บาท)","number"],["fine_baht","ค่าปรับ (บาท)","number"],["payable_baht","คงเหลือจ่ายจริง (บาท) — ระบบคำนวณให้ แก้ไขได้","number"],["budget_total_baht","งบประมาณที่มี (บาท)","number"],["budget_paid_baht","จ่ายไปแล้ว (บาท)","number"],["finance_note","ความเห็นเพิ่มเติมของเจ้าหน้าที่การเงิน"],["requisition_number","ใบเบิกพัสดุ เลขที่ (กรอกได้ เช่น จ. 218/2569)"],["requester_name","ชื่อผู้เบิก"],["requester_position","ตำแหน่งผู้เบิก"],["receiver_name","ชื่อผู้รับของ"],["delegate_name","ชื่อผู้รับของแทน (ถ้ามี)"],["requisition_date","วันที่ใบเบิก (เฉพาะเมื่อไม่ใช้วันส่งมอบ)","date"],["sign_request_date","รายงานขอซื้อ/ขอจ้าง — วันที่ลงนาม","date"],["sign_annex_date","รายละเอียดแนบท้าย — วันที่ลงนาม","date"],["sign_approval_date","รายงานผลการพิจารณาฯ — วันที่ลงนาม","date"],["sign_acceptance_date","ใบตรวจรับ — วันที่ลงนาม","date"],["payment_document_date","บันทึกเบิกจ่าย — วันที่หัวหนังสือ","date"],["sign_payment_date","บันทึกเบิกจ่าย — วันที่ลงนาม","date"],["sign_requisition_date","ใบเบิกพัสดุ — วันที่ลงนาม","date"],["order_vendor_tax_id","เลขประจำตัวผู้เสียภาษีของผู้ขาย/ผู้รับจ้าง"],["order_bank_account_number","เลขที่บัญชีเงินฝากธนาคาร"],["order_bank_account_name","ชื่อบัญชีเงินฝากธนาคาร"],["order_bank_name","ธนาคาร"],["order_delivery_days","กำหนดส่งมอบภายใน (วัน)","number"],["order_delivery_location","สถานที่ส่งมอบ"],["order_warranty","ระยะเวลารับประกันสินค้า / งานจ้าง"],["order_penalty_percent","ค่าปรับรายวันร้อยละ (ตรวจข้อตกลงก่อนพิมพ์)","number"],["order_penalty_min_baht","ค่าปรับขั้นต่ำต่อวัน (บาท)","number"],["order_vendor_signer_name","ชื่อบุคคลผู้รับใบสั่งซื้อ/สั่งจ้าง"],["order_vendor_signer_position","ตำแหน่งบุคคลผู้รับใบสั่งซื้อ/สั่งจ้าง"],["order_school_sign_date","วันที่ผู้สั่งซื้อ/จ้างลงนาม","date"],["order_vendor_sign_date","วันที่ผู้รับใบสั่งซื้อ/จ้างลงนาม","date"],["vat_mode","ประเภทการคิด VAT"],["discount_baht","ส่วนลดจากยอดจ่ายตามหลักฐาน (บาท)","number"],["request_document_date","รายงานขอซื้อ/ขอจ้าง — วันที่หัวหนังสือ","date"],["annex_document_date","รายละเอียดแนบท้าย — วันที่หน้าเอกสาร","date"],["approval_document_date","รายงานผลการพิจารณาฯ — วันที่หัวหนังสือ","date"],["acceptance_date","ใบตรวจรับ — วันที่หัวเอกสาร","date"]];
export const documentInfoGroups=[{"id":"order","title":"1. เอกสารสั่งซื้อ / สั่งจ้าง","description":"ข้อมูลเลขที่หนังสือ ผู้ขาย/ผู้รับจ้าง บัญชีธนาคาร ผู้รับใบสั่ง และเงื่อนไขตามเอกสารต้นฉบับ กรอกเมื่อทราบข้อมูลจริง","fields":[["order_number","เลขที่ใบสั่งซื้อ / สั่งจ้าง"],["order_vendor_tax_id","เลขประจำตัวผู้เสียภาษีของผู้ขาย/ผู้รับจ้าง"],["order_bank_account_number","เลขที่บัญชีเงินฝากธนาคาร"],["order_bank_account_name","ชื่อบัญชีเงินฝากธนาคาร"],["order_bank_name","ธนาคาร"],["order_delivery_days","กำหนดส่งมอบภายใน (วัน)","number"],["order_delivery_location","สถานที่ส่งมอบ"],["order_warranty","ระยะเวลารับประกันสินค้า / งานจ้าง"],["order_penalty_percent","ค่าปรับรายวันร้อยละ (ตรวจข้อตกลงก่อนพิมพ์)","number"],["order_penalty_min_baht","ค่าปรับขั้นต่ำต่อวัน (บาท)","number"],["order_vendor_signer_name","ชื่อบุคคลผู้รับใบสั่งซื้อ/สั่งจ้าง"],["order_vendor_signer_position","ตำแหน่งบุคคลผู้รับใบสั่งซื้อ/สั่งจ้าง"]]},{"id":"delivery","title":"2. ส่งมอบและตรวจรับ","description":"วันที่ตรวจรับและวันที่ใบตรวจรับใช้วันส่งมอบโดยอัตโนมัติ เว้นแต่มีการตรวจรับจริงต่างวัน","fields":[["delivery_date","วันที่ส่งมอบจริง","date"],["invoice_number","เลขที่ใบส่งของ / ใบเสร็จ"],["invoice_date","วันที่ใบส่งของ / ใบเสร็จ","date"],["acceptance_number","เลขที่ใบตรวจรับ (ระบบออกรันให้ แก้ไขได้)"]],"advanced":[["inspection_date","วันที่ตรวจรับจริง (เฉพาะกรณีต่างจากวันส่งมอบ)","date"],["inspection_location","สถานที่ตรวจรับ (เฉพาะกรณีต้องระบุ)"],["inspection_expert","ผู้ทรงคุณวุฒิ (ถ้ามี)"]]},{"id":"finance","title":"3. ข้อมูลเบิกจ่าย","description":"ข้อมูลเบิกจ่ายหลังเกิดรายการ ส่วนลดในหน้านี้หักจากยอดจ่าย ไม่ลดฐาน VAT ในใบสั่งซื้อ/จ้าง หากเป็นส่วนลดราคาสินค้าจริง ต้องแก้ไขราคาในรายการฉบับร่างก่อนออกเอกสาร","fields":[["vat_baht","ภาษีมูลค่าเพิ่มตามหลักฐาน (บาท)","number"],["withholding_baht","ภาษีหัก ณ ที่จ่าย (บาท)","number"],["fine_baht","ค่าปรับ (บาท)","number"],["discount_baht","หัก ส่วนลดจากยอดจ่าย (บาท)","number"],["payable_baht","คงเหลือจ่ายจริง (บาท) — ระบบคำนวณให้ แก้ไขได้","number"]],"advanced":[["budget_total_baht","งบประมาณที่มี (บาท)","number"],["budget_paid_baht","จ่ายไปแล้ว (บาท)","number"],["finance_note","ความเห็นเพิ่มเติมของเจ้าหน้าที่การเงิน"]]},{"id":"requisition","title":"4. ใบเบิกพัสดุ","description":"ดึงชื่อผู้สั่งจ่ายจากหัวหน้าเจ้าหน้าที่พัสดุ และใช้ข้อมูลรายการพัสดุเดิม","fields":[["requisition_number","ใบเบิกพัสดุ เลขที่ (กรอกได้ เช่น จ. 218/2569)"],["requester_name","ชื่อผู้เบิก"],["requester_position","ตำแหน่งผู้เบิก"],["receiver_name","ชื่อผู้รับของ"]],"advanced":[["delegate_name","ชื่อผู้รับของแทน (ถ้ามี)"]]}];
export const signatureDateFields=[["sign_request_date","รายงานขอซื้อ/ขอจ้าง — วันที่ลงนาม","date"],["sign_annex_date","รายละเอียดแนบท้าย — วันที่ลงนาม","date"],["sign_approval_date","รายงานผลการพิจารณาฯ — วันที่ลงนาม","date"],["sign_acceptance_date","ใบตรวจรับ — วันที่ลงนาม","date"],["sign_payment_date","บันทึกเบิกจ่าย — วันที่ลงนาม","date"],["sign_requisition_date","ใบเบิกพัสดุ — วันที่ลงนาม","date"],["order_school_sign_date","วันที่ผู้สั่งซื้อ/จ้างลงนาม","date"],["order_vendor_sign_date","วันที่ผู้รับใบสั่งซื้อ/จ้างลงนาม","date"]];
export const documentHeaderDateFields=[["request_document_date","รายงานขอซื้อ/ขอจ้าง — วันที่หัวหนังสือ","date"],["annex_document_date","รายละเอียดแนบท้าย — วันที่หน้าเอกสาร (ไม่ใส่ถ้าไม่ต้องการ)","date"],["approval_document_date","รายงานผลการพิจารณาฯ — วันที่หัวหนังสือ","date"],["order_date","ใบสั่งซื้อ/ใบสั่งจ้าง — วันที่หัวเอกสาร","date"],["acceptance_date","ใบตรวจรับ — วันที่หัวเอกสาร","date"],["payment_document_date","บันทึกขออนุมัติเบิกจ่าย — วันที่หัวหนังสือ","date"],["requisition_date","ใบเบิกพัสดุ — วันที่หัวเอกสาร","date"]];
export const primaryDocumentFields=[["memo_prefix","รหัสรายงานขอซื้อ/ขอจ้าง (พว. วัสดุ / พค. ครุภัณฑ์)"],["memo_number","ที่ — รายงานขอซื้อ/ขอจ้าง (เฉพาะเลข เช่น 1/2569)"],["approval_memo_number","ที่ — รายงานผลการพิจารณาฯ (ใส่เฉพาะเลข ไม่ใช้ พว.)"],["payment_memo_number","ที่ — ทราบผลและขออนุมัติเบิกจ่าย (ระบบออกเลขอัตโนมัติ)"],["inspector_position","ตำแหน่งผู้ตรวจรับพัสดุ"]];
const editableKeys=new Set(documentInfoFields.map(([key])=>key));
const memoNumbers=new Set(['memo_number','approval_memo_number','payment_memo_number']);
const registryNumbers=new Set(['memo_number','approval_memo_number','payment_memo_number','acceptance_number','requisition_number']);
const documentDateKeys=new Set(documentInfoFields.filter(([, ,type])=>type==='date').map(([key])=>key));
const orderNumericKeys=new Set(['order_delivery_days','order_penalty_percent','order_penalty_min_baht']);
const financeKeys=new Set(['vat_baht','withholding_baht','fine_baht','discount_baht','payable_baht']);
function fieldHtml([key,label,type],meta,categories){
 const inputType=type||'text',raw=meta?.[key]??meta?.['doc_'+key]??'';
 const value=key==='memo_prefix'?normalizeMemoPrefix(raw):
  memoNumbers.has(key)&&memoNumberTokens(raw).length<=1?
   normalizeMemoNumber(raw,meta?.memo_prefix??meta?.doc_memo_prefix??''):raw;
 if(key==='memo_prefix'){
  const normalized=normalizeMemoPrefix(value)||'พว.';
  const base=Array.isArray(categories)&&categories.length?categories:[{name:'วัสดุ',prefix:'พว.'},{name:'ครุภัณฑ์',prefix:'พค.'}];
  const grouped=new Map();
  for(const cat of base){
   if(!cat?.prefix||!cat?.name)continue;
   if(!grouped.has(cat.prefix))grouped.set(cat.prefix,[]);
   grouped.get(cat.prefix).push(cat.name);
  }
  if(!grouped.has(normalized))grouped.set(normalized,['รหัสเดิมของเอกสารนี้']);
  return '<div class="field"><label for="doc_memo_prefix">'+e(label)+'</label>'+
   '<select class="select" id="doc_memo_prefix" name="doc_memo_prefix" aria-label="รหัสรายงานขอซื้อ">'+
    [...grouped].map(([code,names])=>'<option value="'+e(code)+'" '+(code===normalized?'selected':'')+'>'+
     e(code+' — '+names.join(' / '))+'</option>').join('')+
   '</select><p class="hint">รหัสรายงานตามหมวดที่โรงเรียนกำหนด ไม่แก้เลขทะเบียนคุม</p></div>';
 }
 const placeholder=key==='memo_prefix'?'พว.':memoNumbers.has(key)?'เช่น 2/2569 (ไม่ต้องใส่ พว.)':inputType==='date'?'เลือกวันที่':'ไม่ทราบให้เว้นว่าง';
 return '<div class="field"><label for="doc_'+e(key)+'">'+e(label)+'</label><input class="input" id="doc_'+e(key)+'" name="doc_'+e(key)+'" type="'+inputType+'" '+(inputType==='number'?'min="0" step=".01" inputmode="decimal"':'')+((registryNumbers.has(key)||key==='vat_baht'&&(['included','added','none','mixed'].includes(meta?.vat_mode||meta?.doc_vat_mode)))?' readonly aria-describedby="registry-help"':'')+' value="'+e(value)+'" placeholder="'+(registryNumbers.has(key)?'ระบบออกเลขอัตโนมัติ':placeholder)+'"></div>';
}
// One central editor per document, so no duplicated date inputs can
// overwrite each other when the wizard is submitted or the record is updated.
export function docMetaDateInputs(meta={},kind='purchase'){
 const definitions=[
  ['รายงานขอซื้อ / ขอจ้าง','request_document_date',['sign_request_date']],
  ['รายละเอียดแนบท้าย','annex_document_date',['sign_annex_date']],
  ['รายงานผลการพิจารณาฯ','approval_document_date',['sign_approval_date']],
  [kind==='hire'?'ใบสั่งจ้าง':'ใบสั่งซื้อ','order_date',['order_school_sign_date','order_vendor_sign_date']],
  ['ใบตรวจรับ'+(kind==='hire'?'งานจ้าง':'พัสดุ'),'acceptance_date',['sign_acceptance_date']],
  ['บันทึกขออนุมัติเบิกจ่าย','payment_document_date',['sign_payment_date']],
  ...(kind==='purchase'?[['ใบเบิกพัสดุ','requisition_date',['sign_requisition_date']]]:[])
 ];
 const fieldMap=new Map([...documentHeaderDateFields,...signatureDateFields].map(f=>[f[0],f]));
 return '<section class="kp-document-date-editor"><h3>วันที่หัวเอกสารและวันที่ลงนาม (เลือกแยกแต่ละฉบับ)</h3>'+
  '<p class="hint">ช่องวันที่หัวเอกสารที่เว้นว่างจะใช้วันที่ลงนามที่ระบุไว้เป็นค่าแสดงผลในเอกสารที่เกี่ยวข้อง (ยกเว้นรายงานหลักที่ใช้วันที่เอกสารเดิม) แก้ไขวันที่หัวเอกสารและวันที่ลงนามเป็นคนละวันได้ โดยข้อมูลรายการเดิมไม่ถูกเปลี่ยนย้อนหลัง</p>'+
  definitions.map(([title,headerKey,signKeys])=>'<details class="doc-meta-section kp-doc-date-group" open><summary>'+e(title)+'</summary><div class="form-grid">'+
    [headerKey,...signKeys].map(key=>fieldHtml(fieldMap.get(key),meta)).join('')+'</div></details>').join('')+'</section>';
}
export function docMetaInputs(meta={},options={}){
 const mode=typeof options==='string'?options:(options.mode||'all');
 const kind=typeof options==='string'?'purchase':(options.kind||'purchase');
 if(mode==='create')return '<div class="form-grid">'+primaryDocumentFields.filter(f=>f[0]!=='memo_prefix').map(f=>fieldHtml(f,meta)).join('')+(kind==='purchase'?fieldHtml(['requisition_number','ใบเบิกพัสดุ เลขที่ (กรอกได้ เช่น จ. 218/2569)'],meta):'')+'</div><p class="hint">รหัสตามหมวดที่โรงเรียนกำหนดเลือกจากขั้นที่ 1 รายงานผลการพิจารณาและทราบผลและขออนุมัติเบิกจ่ายออกเลขที่จากทะเบียนอัตโนมัติ ส่วนวันที่หัวหนังสือเบิกจ่ายและวันที่ลงนามเลือกได้ในขั้นตอนนี้ หากไม่ระบุจะเว้นว่างไว้ให้กรอกภายหลัง</p>'; 
 const main='<section class="doc-meta-section"><h3>เลขที่หนังสือและตำแหน่งผู้ตรวจรับ</h3><p class="hint">เลขที่ทราบผลและขออนุมัติเบิกจ่ายออกอัตโนมัติตามทะเบียน วันที่หัวกระดาษและวันที่ลงนามเลือกแยกกันได้ทุกฉบับในหัวข้อถัดไป โดยไม่เปลี่ยนวันที่และเลขทะเบียนดั้งเดิม</p><div class="form-grid">'+primaryDocumentFields.filter(f=>kind==='purchase'||f[0]!=='memo_prefix').map(f=>fieldHtml(f,meta,options.categories)).join('')+'</div></section>';
 const signatureSection=docMetaDateInputs(meta,kind);
 const sections=documentInfoGroups.filter(g=>kind==='purchase'||g.id!=='requisition').map(g=>{
  const extra=g.advanced?.length?'<details class="doc-meta-advanced"><summary>กรณีพิเศษ / ข้อมูลเพิ่มเติม</summary><div class="form-grid">'+g.advanced.map(f=>fieldHtml(f,meta)).join('')+'</div></details>':'';
  return '<details class="doc-meta-section" '+(g.id==='order'?'open':'')+'><summary>'+e(g.title)+'</summary><p class="hint">'+e(g.description)+'</p><div class="form-grid">'+g.fields.map(f=>fieldHtml(f,meta)).join('')+'</div>'+extra+'</details>';
 }).join('');
 return main+signatureSection+sections+'<p id="registry-help" class="hint">เลขที่เอกสารออกอัตโนมัติและแก้ผ่านเมนูทะเบียนคุมเลขเท่านั้น เพื่อป้องกันเลขซ้ำ</p><p class="hint">หากพิมพ์แล้วยังมีเส้นประที่เลขใบสั่ง/ใบตรวจรับ/ใบเบิก กรุณาตรวจว่าได้กรอกเลขใบสั่งจริงหรือออกเลขจากทะเบียนคุมแล้ว วันที่ลงนามไม่ใช่เลขหนังสือและไม่ออกเลขทะเบียนให้อัตโนมัติ</p><p class="hint">ใช้รหัสตามหมวดเฉพาะรายงานขอซื้อ/ขอจ้าง เอกสารฉบับอื่นใช้เลขหลังคำว่า ที่ เท่านั้น ยอดเงินรวมและกิจกรรม/โครงการเชื่อมจากข้อมูลหลัก ส่วนยอดเบิกจ่ายคำนวณอัตโนมัติเมื่อไม่กรอกยอดสุทธิเอง</p>';
}
/**
 * Optional evidence panels in the 4-step procurement wizard.
 * All controls reuse the same doc_* keys and validator used by
 * "ข้อมูลเอกสารราชการ" after saving, so no second source of truth.
 * Missing legal/actual evidence is NEVER made up or auto-dated.
 */
export function docMetaWizardInputs(meta={},step=3,kind='purchase'){
 const orderFields=[['order_number','เลขที่ใบสั่งซื้อ / ใบสั่งจ้าง'],...[["order_vendor_tax_id","เลขประจำตัวผู้เสียภาษีของผู้ขาย/ผู้รับจ้าง"],["order_bank_account_number","เลขที่บัญชีเงินฝากธนาคาร"],["order_bank_account_name","ชื่อบัญชีเงินฝากธนาคาร"],["order_bank_name","ธนาคาร"],["order_delivery_days","กำหนดส่งมอบภายใน (วัน)","number"],["order_delivery_location","สถานที่ส่งมอบ"],["order_warranty","ระยะเวลารับประกันสินค้า / งานจ้าง"],["order_penalty_percent","ค่าปรับรายวันร้อยละ (ตรวจข้อตกลงก่อนพิมพ์)","number"],["order_penalty_min_baht","ค่าปรับขั้นต่ำต่อวัน (บาท)","number"],["order_vendor_signer_name","ชื่อบุคคลผู้รับใบสั่งซื้อ/สั่งจ้าง"],["order_vendor_signer_position","ตำแหน่งบุคคลผู้รับใบสั่งซื้อ/สั่งจ้าง"]]];
 const deliveryFields=[
  ['delivery_date','วันที่ส่งมอบจริง','date'],
  ['invoice_number','เลขที่ใบส่งของ / ใบเสร็จ / หลักฐานส่งงาน'],
  ['invoice_date','วันที่ออกหลักฐานส่งมอบ','date'],
  ['inspection_date','วันที่ตรวจรับจริง (ถ้าต่างจากวันส่งมอบ)','date'],
  ['inspection_location','สถานที่ตรวจรับ'],
  ['inspection_expert','ผู้ชำนาญการ / ผู้ทรงคุณวุฒิ (ถ้ามี)'],
 ];
 const paymentFields=[
  ['vat_baht','ภาษีมูลค่าเพิ่มตามหลักฐาน (บาท)','number'],
  ['withholding_baht','ภาษีหัก ณ ที่จ่าย (บาท)','number'],
  ['fine_baht','ค่าปรับ (บาท)','number'],
  ['discount_baht','ส่วนลดจากยอดจ่ายตามหลักฐาน (บาท)','number'],
  ['budget_total_baht','งบประมาณที่มี (บาท)','number'],
  ['budget_paid_baht','จ่ายไปแล้ว (บาท)','number']
 ];
 const section=(title,hint,fields,id)=>{
  const hasValues=fields.some(([key])=>String(meta?.[key]??meta?.['doc_'+key]??'').trim()!=='');
  return '<details class="kp-wizard-evidence" data-evidence-group="'+id+'" '+(hasValues?'open':'')+'>'+
   '<summary>'+e(title)+' <span>กรอกเมื่อมีข้อมูลจริง</span></summary>'+
   '<p class="hint">'+e(hint)+'</p>'+
   '<div class="form-grid">'+fields.map(f=>fieldHtml(f,meta)).join('')+'</div></details>';
 };
 if(Number(step)===3){
  // The requisition requester is the actual person withdrawing supplies.
  // Show these fields directly, not inside the optional order-data accordion.
  // Both create and edit wizards share the saved document_meta keys.
  const requesterFields=kind==='purchase'?
   '<section class="kp-requisition-requester"><h3>ข้อมูลผู้เบิกพัสดุ (สำหรับใบเบิกพัสดุ)</h3>'+
   '<p class="hint">กรอกชื่อผู้เบิกจริง ไม่ใช่ชื่อผู้ขาย ผู้ตรวจรับ หรือเจ้าหน้าที่พัสดุ ระบบจะนำไปแสดงใต้ช่องลงชื่อ “ผู้เบิก” ในใบเบิกพัสดุ สามารถกลับมาแก้ไขภายหลังได้</p>'+
   '<div class="form-grid">'+[
    ['requester_name','ชื่อผู้เบิกพัสดุ'],
    ['requester_position','ตำแหน่งผู้เบิก (ถ้ามี)']
   ].map(f=>fieldHtml(f,meta)).join('')+'</div></section>':'';
  return '<div class="kp-evidence-panel">'+requesterFields+
   section('ข้อมูลใบสั่ง'+(kind==='hire'?'จ้าง':'ซื้อ')+' (ถ้าออกแล้ว)',
   'เลขที่ใบสั่งต้องตรงกับเอกสารจริง ไม่ใช่เลขรายงานขอซื้อ/จ้าง วันที่ใบสั่งซื้อ/จ้างเลือกได้ในขั้นที่ 4 พร้อมวันที่ลงนาม หากยังไม่ออกเอกสารสามารถเว้นไว้ได้',orderFields,'order')+'</div>';
 }
 if(Number(step)===4){
  return '<div class="kp-evidence-panel">'+docMetaDateInputs(meta,kind)+'<h3>ข้อมูลสำหรับเติมเอกสารตรวจรับและเบิกจ่าย</h3>'+
   '<p class="hint">ยังไม่มีหลักฐานจริงสามารถเว้นว่างทั้งหมดได้ ระบบจะไม่สมมติวันส่งมอบหรือเลขที่ใบส่งของ กรอกเพิ่มเติมภายหลังได้ที่ “ข้อมูลเอกสาร / ตรวจรับ / เบิกจ่าย”</p>'+
   section('ข้อมูลส่งมอบและตรวจรับ (เมื่อส่งมอบจริง)',
    'กรอกวันส่งมอบตามเหตุการณ์จริง ไม่ใช่กำหนดส่งมอบ วันตรวจรับใช้วันส่งมอบเป็นค่าเริ่มต้นหากไม่ระบุวันอื่น โปรดตรวจสอบว่าตรวจรับจริงวันใด เลขใบตรวจรับออกจากทะเบียนกลางหลังบันทึกการส่งมอบ',deliveryFields,'delivery')+
   section('ข้อมูลการเงินประกอบการเบิกจ่าย (ถ้ามี)',
    'กรอกจำนวนเงินตามหลักฐานที่ตรวจสอบแล้ว ยอดเบิกจ่ายสุทธิจะคำนวณจากวงเงินรวม หักภาษีและค่าปรับ หากไม่มีข้อมูลจริงอย่าเพิ่งกรอกตัวเลขสมมติ',paymentFields,'finance')+'</div>';
 }
 return '';
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
  if(registryNumbers.has(key))continue; // Registry owns allocation and corrections
  let normalized=String(value??'').trim();
  if(key==='memo_prefix')normalized=normalizeMemoPrefix(normalized);
  if(key==='vat_mode'&&normalized&&!['legacy','included','added','none','mixed'].includes(normalized))throw Error('ประเภท VAT ไม่ถูกต้อง');
  if(financeKeys.has(key)&&normalized&&(!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/.test(normalized)||Number(normalized)>1e10))throw Error('ยอดเงินต้องไม่ติดลบและมีทศนิยมไม่เกินสองตำแหน่ง');
  if(orderNumericKeys.has(key)&&normalized&&(!Number.isFinite(Number(normalized))||Number(normalized)<0||Number(normalized)>1000000))throw Error('จำนวนวันหรือค่าปรับต้องเป็นตัวเลขที่ไม่ติดลบ');
   if(documentDateKeys.has(key)&&normalized){const dt=new Date(normalized+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(normalized)||!Number.isFinite(dt.getTime())||dt.toISOString().slice(0,10)!==normalized)throw Error('กรุณาเลือกวันที่เอกสารหรือวันที่ลงนามที่ถูกต้องจากปฏิทิน');}
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
