import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDocuments} from './print.js';
import {documentInfoFields,docMetaValue,docMetaWizardInputs,docMetaInputs} from './document-meta.js';
import {TEMPLATE_PAGES} from './template-builder.js';
const school={name:'โรงเรียนกาวิละวิทยาลัย',district:'เมืองเชียงใหม่',province:'เชียงใหม่',address:'อ.เมืองเชียงใหม่ จ.เชียงใหม่',head_name:'หัวหน้าพัสดุ',director_name:'ผู้อำนวยการ'};
const rec={kind:'purchase',document_date:'2026-10-26',title:'ซื้อวัสดุสำนักงาน',vendor_name:'บริษัททดสอบ จำกัด',vendor_address:'อำเภอเมือง จังหวัดเชียงใหม่',due_date:'2026-11-10',items:[{name:'โต๊ะพับ',qty:2,unit:'ตัว',price_satang:150000},{name:'เก้าอี้',qty:1,unit:'ตัว',price_satang:100000}],total_satang:400000,document_meta:{}};
const extract=html=>html.match(/<section class="paper-page official gov-doc gov-order">[\s\S]*?<\/section>/)?.[0]||'';
test('purchase and hire orders follow both uploaded school reference forms',()=>{
 for(const kind of ['purchase','hire']){
  const html=extract(buildDocuments({...rec,kind},school));
  assert.ok(html);
  assert.match(html,/order-garuda/);
  assert.match(html,new RegExp(kind==='purchase'?'ใบสั่งซื้อ':'ใบสั่งจ้าง'));
  for(const label of ['เลขประจำตัวผู้เสียภาษี','เลขที่บัญชีเงินฝากธนาคาร','ชื่อบัญชี','ธนาคาร','ราคาต่อหน่วย','จำนวนเงิน','ภาษีมูลค่าเพิ่ม','เงื่อนไขต่อไปนี้','ผู้สั่ง','ผู้รับใบสั่ง']){
   assert.ok(html.includes(label),'missing '+label);
  }
  assert.equal((html.match(/<li>/g)||[]).length,6);
  assert.match(html,/class="order-signatures"/);
  assert.match(html,/class="order-totals"/);
 }
});
test('orders use stored item prices, amounts and dates, not assumed seller details',()=>{
 const html=extract(buildDocuments({...rec,document_meta:{order_number:'184/2569',order_date:'2026-10-27',vat_baht:'261.68',order_vendor_tax_id:'1234567890123'}},school));
 assert.match(html,/184\/2569/);
 assert.match(html,/27 ตุลาคม 2569/);
 assert.match(html,/10 พฤศจิกายน 2569/);
 assert.match(html,/4,000.00/);
 assert.match(html,/261.68/);
 assert.match(html,/1234567890123/);
 assert.match(html,/สี่พันบาทถ้วน/);
 assert.doesNotMatch(html,/สมมติผู้รับใบสั่ง/);
});
test('vendor bank accounts, signers and two signing dates are saved separately and escaped',()=>{
 const input={doc_order_bank_name:'ธนาคารทดสอบ',doc_order_bank_account_name:'บัญชีทดสอบ',doc_order_vendor_signer_name:'นายทดสอบ',doc_order_school_sign_date:'2026-11-01',doc_order_vendor_sign_date:'2026-11-02',doc_order_vendor_tax_id:'<script>alert(1)</script>'};
 const meta=docMetaValue(input);
 assert.equal(meta.order_vendor_sign_date,'2026-11-02');
 const html=extract(buildDocuments({...rec,document_meta:meta},school));
 assert.match(html,/1 พฤศจิกายน 2569/);
 assert.match(html,/2 พฤศจิกายน 2569/);
 assert.match(html,/ธนาคารทดสอบ/);
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/&lt;script&gt;/);
 assert.throws(()=>docMetaValue({doc_order_vendor_sign_date:'2026-02-30'}),/วันที่ลงนาม/);
 assert.throws(()=>docMetaValue({doc_order_penalty_percent:'-1'}),/ไม่ติดลบ/);
});
test('new and saved purchase and hire forms allow order data and calendar controls',()=>{
 for(const kind of ['purchase','hire']){
  const wizard=docMetaWizardInputs({},3,kind),sign=docMetaWizardInputs({},4,kind);
  const editor=docMetaInputs({},{kind});
  for(const key of ['order_vendor_tax_id','order_bank_name','order_bank_account_number','order_delivery_days','order_vendor_signer_name']){
   assert.match(wizard,new RegExp('name="doc_'+key+'"'));
   assert.match(editor,new RegExp('name="doc_'+key+'"'));
  }
  for(const key of ['order_school_sign_date','order_vendor_sign_date']){
   assert.match(sign,new RegExp('name="doc_'+key+'" type="date"'));
   assert.match(editor,new RegExp('name="doc_'+key+'" type="date"'));
  }
 }
 assert.ok(documentInfoFields.some(([key])=>key==='order_vendor_tax_id'));
 assert.ok(TEMPLATE_PAGES.some(x=>x.key==='order'));
});
test('25 line items produce three pages while preserving order headers and final signatures',()=>{
 const items=Array.from({length:25},(_,i)=>({name:'รายการที่ '+(i+1),qty:1,unit:'ชิ้น',price_satang:10000}));
 const html=buildDocuments({...rec,items,total_satang:250000},school);
 assert.equal((html.match(/class="paper-page official gov-doc gov-order"/g)||[]).length,3);
 assert.equal((html.match(/class="order-signatures"/g)||[]).length,1);
 assert.equal((html.match(/class="order-garuda"/g)||[]).length,3);
});
test('separate A4 stylesheet ships in browser build',async()=>{
 const css=await readFile(new URL('./order-forms.css',import.meta.url),'utf8');
 const build=await readFile(new URL('./build.mjs',import.meta.url),'utf8');
 assert.match(css,/\.gov-order \.order-parties/);
 assert.match(css,/@media print/);
 assert.match(build,/order-forms\.css/);
});