import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDocuments} from './print.js';
import {docMetaDateInputs,docMetaInputs,docMetaWizardInputs,docMetaValue,documentHeaderDateFields} from './document-meta.js';
const school={name:'โรงเรียนกาวิละวิทยาลัย',district:'เมืองเชียงใหม่',province:'เชียงใหม่',head_name:'หัวหน้าเจ้าหน้าที่',officer_name:'เจ้าหน้าที่',director_name:'ผู้อำนวยการ'};
const sample={kind:'purchase',fiscal_year:2570,document_date:'2026-10-26',reason:'งานอาคาร',title:'ซื้อวัสดุ',vendor_name:'ร้านค้า',inspector_name:'ผู้ตรวจรับ',items:[{name:'ทราย',unit:'คิว',qty:4,price_satang:320000}],total_satang:1280000,document_meta:{}};
const sheets=rec=>buildDocuments(rec,school).split(/(?=<section class="paper-page)/).filter(x=>x.includes('class="paper-page'));
test('every dated purchase/hire document has independently editable header and signer inputs, with no duplicate field',()=>{
 const headerKeys=documentHeaderDateFields.map(x=>x[0]);
 assert.deepEqual(headerKeys,['request_document_date','annex_document_date','approval_document_date','order_date','acceptance_date','payment_document_date','requisition_date']);
 for(const kind of ['purchase','hire']){
  const editor=docMetaInputs({}, {kind}),wizard=docMetaWizardInputs({},4,kind),step3=docMetaWizardInputs({},3,kind);
  for(const html of [editor,wizard]){
   for(const key of headerKeys.filter(k=>kind==='purchase'||k!=='requisition_date')){
    assert.equal(html.split('name="doc_'+key+'"').length-1,1,'header date input '+kind+' '+key);
    assert.match(html,new RegExp('name="doc_'+key+'" type="date"'));
   }
   for(const key of ['sign_request_date','sign_annex_date','sign_approval_date','order_school_sign_date','order_vendor_sign_date','sign_acceptance_date','sign_payment_date',...(kind==='purchase'?['sign_requisition_date']:[])]){
    assert.equal(html.split('name="doc_'+key+'"').length-1,1,'signature date input '+kind+' '+key);
   }
  }
  assert.doesNotMatch(step3,/name="doc_order_date"/,'order date must not appear twice in wizard');
  if(kind==='hire')assert.doesNotMatch(editor,/name="doc_requisition_date"/);
 }
 assert.match(docMetaDateInputs({},'purchase'),/วันที่หัวเอกสารและวันที่ลงนาม/);
 const info=docMetaInputs({}, {kind:'purchase'});
 assert.match(info,/หากพิมพ์แล้วยังมีเส้นประ/);
});
test('previously saved signature dates populate missing document header dates without inventing entries in database',()=>{
 const m={sign_request_date:'2026-10-26',sign_approval_date:'2026-10-26',sign_acceptance_date:'2026-10-28',sign_requisition_date:'2026-10-28',order_school_sign_date:'2026-10-26'};
 const pages=sheets({...sample,document_meta:m});
 assert.equal(pages.length,7);
 assert.match(pages[0],/class="memo-value">26 ตุลาคม 2569<\/span>/);
 assert.match(pages[2],/class="memo-value">26 ตุลาคม 2569<\/span>/);
 assert.match(pages[3],/ใบสั่งซื้อ เลขที่[\s\S]*?<div>วันที่ 26 ตุลาคม 2569<\/div>/);
 assert.match(pages[4],/ใบตรวจรับ เลขที่[\s\S]*?<div>วันที่ 28 ตุลาคม 2569<\/div>/);
 assert.match(pages[6],/ใบเบิก เลขที่[\s\S]*?<div>วันที่ 28 ตุลาคม 2569<\/div>/);
 assert.match(pages[5],/kp-payment-date-writein/,'no fabricated payment date');
 assert.deepEqual(m,{sign_request_date:'2026-10-26',sign_approval_date:'2026-10-26',sign_acceptance_date:'2026-10-28',sign_requisition_date:'2026-10-28',order_school_sign_date:'2026-10-26'},'stored metadata stays unchanged');
});
test('all explicit header dates override signatures and print distinct real dates',()=>{
 const m={
  request_document_date:'2026-10-21',sign_request_date:'2026-10-26',
  annex_document_date:'2026-10-22',sign_annex_date:'2026-10-26',
  approval_document_date:'2026-10-23',sign_approval_date:'2026-10-26',
  order_date:'2026-10-24',order_school_sign_date:'2026-10-26',order_vendor_sign_date:'2026-10-27',
  acceptance_date:'2026-10-29',sign_acceptance_date:'2026-10-30',
  payment_document_date:'2026-10-30',sign_payment_date:'2026-10-31',
  requisition_date:'2026-11-01',sign_requisition_date:'2026-11-02'
 };
 const pages=sheets({...sample,document_meta:m});
 assert.match(pages[0],/class="memo-value">21 ตุลาคม 2569<\/span>/);
 assert.match(pages[0],/class="kp-signature-date-value">26 ตุลาคม 2569<\/span>/);
 assert.match(pages[1],/gov-annex-heading-date">วันที่ 22 ตุลาคม 2569<\/div>/);
 assert.match(pages[2],/class="memo-value">23 ตุลาคม 2569<\/span>/);
 assert.match(pages[3],/<div>วันที่ 24 ตุลาคม 2569<\/div>/);
 assert.match(pages[3],/order-signer-date">26 ตุลาคม 2569/);
 assert.match(pages[3],/order-signer-date">27 ตุลาคม 2569/);
 assert.match(pages[4],/ใบตรวจรับ เลขที่[\s\S]*?<div>วันที่ 29 ตุลาคม 2569<\/div>/);
 assert.match(pages[4],/class="kp-signature-date-value">30 ตุลาคม 2569/);
 assert.match(pages[5],/class="memo-value">30 ตุลาคม 2569<\/span>/);
 assert.match(pages[5],/class="kp-signature-date-value">31 ตุลาคม 2569/);
 assert.match(pages[6],/ใบเบิก เลขที่[\s\S]*?<div>วันที่ 1 พฤศจิกายน 2569<\/div>/);
 assert.match(pages[6],/class="kp-signature-date-value">2 พฤศจิกายน 2569/);
});
test('hire renders all six dated documents without the purchase-only requisition',()=>{
 const m={order_school_sign_date:'2026-10-26',sign_acceptance_date:'2026-10-28',sign_payment_date:'2026-10-30'};
 const p=sheets({...sample,kind:'hire',document_meta:m});
 assert.equal(p.length,6);
 assert.match(p[3],/วันที่ 26 ตุลาคม 2569/);
 assert.match(p[4],/วันที่ 28 ตุลาคม 2569/);
 assert.match(p[5],/class="memo-value">30 ตุลาคม 2569<\/span>/);
});
test('all document dates are ISO-calendar validated and can be changed/cleared independently',()=>{
 const existing={sign_acceptance_date:'2026-10-28',order_date:'2026-10-26',order_number:'1/2569'};
 const out=docMetaValue({doc_acceptance_date:'2026-10-30',doc_request_document_date:'2026-10-25',doc_order_date:'2026-10-27'},existing);
 assert.deepEqual(out,{...existing,acceptance_date:'2026-10-30',request_document_date:'2026-10-25',order_date:'2026-10-27'});
 const next=docMetaValue({doc_acceptance_date:''},out);
 assert.equal(next.acceptance_date,undefined);assert.equal(next.sign_acceptance_date,'2026-10-28');
 for(const key of ['request_document_date','annex_document_date','approval_document_date','order_date','acceptance_date','payment_document_date','requisition_date']){
  assert.throws(()=>docMetaValue({['doc_'+key]:'2026-02-30'}),/วันที่เอกสาร/);
 }
});
test('source of record stays unchanged; only display dates use the header overrides',async()=>{
 const src=await readFile(new URL('./print.js',import.meta.url),'utf8');
 assert.match(src,/function acceptanceHeaderDate\(r\)/);
 assert.match(src,/function orderHeaderDate\(r\)/);
 assert.match(src,/function paymentHeaderDate\(r\)/);
 assert.match(src,/function requestHeaderDate\(r\)/);
 assert.doesNotMatch(src,/r\.document_date\s*=/,'printing must not modify the original document date');
});
