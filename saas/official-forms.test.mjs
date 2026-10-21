import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDocuments, thaiBahtText,normalizeMemoPrefix,normalizeMemoNumber,renderMemoReference } from './print.js';
import {docMetaInputs, docMetaValue,documentInfoFields} from './document-meta.js';
const school={name:'โรงเรียนกาวิละวิทยาลัย',district:'อำเภอเมืองเชียงใหม่',province:'เชียงใหม่',memo_prefix:'พว.',officer_name:'เจ้าหน้าที่จริง',head_name:'หัวหน้าพัสดุจริง',director_name:'ผู้อำนวยการจริง',finance_name:'การเงินจริง'};
const sample={kind:'purchase',title:'ซื้อวัสดุสำนักงาน',reason:'ใช้ในกิจกรรมภายในโรงเรียน',department:'กลุ่มบริหารงานวิชาการ',budget_source:'กิจกรรมพัฒนาผู้เรียน',document_number:1,fiscal_year:2570,document_date:'2026-10-20',vendor_name:'ร้านค้าตัวอย่าง',due_date:'2026-10-25',inspector_name:'ผู้ตรวจรับจริง',items:[{name:'ของที่ระลึก',qty:1,unit:'ชุด',price_satang:20000}],total_satang:20000,signers:{officer:'เจ้าหน้าที่จริง',head:'หัวหน้าพัสดุจริง',director:'ผู้อำนวยการจริง'},document_meta:{memo_number:'25/2569',inspector_position:'ครู',order_number:'ส.1',order_date:'2026-10-20',invoice_number:'001'}};
test('government print set has six purchasing and five hiring documents',()=>{
 const a=buildDocuments(sample,school),b=buildDocuments({...sample,kind:'hire'},school);
 assert.equal((a.match(/<section class="paper-page/g)||[]).length,6);
 assert.equal((b.match(/<section class="paper-page/g)||[]).length,5);
 assert.match(a,/ใบเบิกพัสดุ/);assert.doesNotMatch(b,/ใบเบิกพัสดุ/);
});
test('source form sections, roles and legal citations present',()=>{
 const html=buildDocuments(sample,school);
 for(const expected of ['บันทึกข้อความ','รายงานขอซื้อพัสดุ','รายละเอียดของพัสดุที่จะซื้อ','รายงานผลการพิจารณา','ใบตรวจรับพัสดุ','ทราบผลและขออนุมัติเบิกจ่าย','ข้อ 175','ข้อ 204','ข้อ 205','ลงนามแล้ว','ผู้มอบ','ผู้รับของ','ใบสั่งซื้อเลขที่','พว. 25/2569','เห็นชอบในรายงานขอซื้อ','เป็นผู้ตรวจรับพัสดุ']){
   assert.ok(html.includes(expected),'Missing form element '+expected);
 }
 assert.doesNotMatch(html,/รอตรวจสอบข้อกฎหมาย|แบบร่างรอตรวจ/);
});
test('Thai words amount and record-sourced values',()=>{
 assert.equal(thaiBahtText(20000),'สองร้อยบาทถ้วน');
 assert.equal(thaiBahtText(1100),'สิบเอ็ดบาทถ้วน');
 assert.equal(thaiBahtText(12345),'หนึ่งร้อยยี่สิบสามบาทสี่สิบห้าสตางค์');
 const html=buildDocuments(sample,school);
 assert.ok(html.includes('ผู้ตรวจรับจริง'));
 assert.ok(html.includes('ร้านค้าตัวอย่าง'));
 assert.ok(html.includes('สองร้อยบาทถ้วน'));
 assert.ok(html.includes('วันที่ 25 ตุลาคม 2569'));
});
test('optional evidence fields do not get invented and are escaped',()=>{
 const html=buildDocuments({...sample,inspector_name:'<script>alert(1)</script>',document_meta:{}},school);
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/&lt;script&gt;/);
 assert.match(html,/................................../);
});
test('metadata form covers all backend-approved fields',()=>{
 assert.equal(documentInfoFields.length,27);
 const html=docMetaInputs({memo_number:'1/2570'});
 assert.match(html,/name="doc_memo_number"/);
 assert.match(html,/value="1\/2570"/);
 assert.deepEqual(docMetaValue({doc_memo_number:' 1/2570 ',doc_vat_baht:'0'}),{vat_baht:'0'});
});

test('hiring forms use correct language without duplicated job nouns',()=>{
 const html=buildDocuments({...sample,kind:'hire'},school);
 assert.match(html,/รายงานผลการพิจารณาและขออนุมัติสั่งจ้าง/);
 assert.match(html,/รายละเอียดของงานจ้าง แนบท้ายรายงานขอจ้าง/);
 assert.doesNotMatch(html,/สั่งจ้างงานจ้าง|จัดจ้างงานจ้าง|รายงานขอจ้างงานจ้าง/);
});
test('VAT line adds to gross without inventing VAT rate',()=>{
 const html=buildDocuments({...sample,document_meta:{vat_baht:'14.00'}},school);
 assert.match(html,/186\.00/);
 assert.match(html,/14\.00/);
 assert.match(html,/200\.00/);
});


test('director approvals have a dedicated ruled signature and separate position',()=>{
 const html=buildDocuments(sample,school);
 assert.match(html,/class="gov-director-writing"/);
 assert.match(html,/class="gov-director-rule"/);
 assert.match(html,/class="gov-director-position kp-signature-position kp-director-one-line">ผู้อำนวยการโรงเรียนกาวิละวิทยาลัย/);
});
test('editing drafts remains separate from issuing another numbered record',async()=>{
 const {readFileSync}=await import('node:fs');
 const code=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 assert.match(code,/update_procurement_draft/);
 assert.match(code,/p_expected_updated_at:original.updated_at/);
 assert.match(code,/state.editingRecordId=null/);
 assert.match(code,/data-action="open-edit"|open-edit/);
 assert.match(code,/canEditMainRecord/);
});
test('Chrome A4 print uses native page continuation instead of blocking long documents',async()=>{
 const {readFileSync}=await import('node:fs');
 const code=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('./government-forms.css',import.meta.url),'utf8');
 assert.doesNotMatch(code,/มีข้อความยาวเกินหน้ากระดาษ A4 แม้ปรับขนาดตัวอักษรแล้ว/);
 assert.match(code,/window\.print\(\)/);
 assert.match(css,/overflow:visible!important/);
 assert.match(css,/break-inside:auto!important/);
 assert.match(css,/gov-director-position/);
});

test('annex totals have a single merged amount-in-words cell without extra empty rows',()=>{
 const html=buildDocuments(sample,school);
 assert.match(html,/rowspan="3" colspan="4" class="gov-money-words"/);
 assert.doesNotMatch(html,/<td colspan="4"><\/td><td class="right">ภาษีมูลค่าเพิ่ม/);
});
test('receiving header uses Thai receipt prefix and auto delivery date for inspection',()=>{
 const record={...sample,document_meta:{delivery_date:'2026-10-25'}};
 const html=buildDocuments(record,school);
 assert.match(html,/ใบตรวจรับ เลขที่ ร\. \.{5,}\/2569/);
 assert.match(html,/วันที่ 25 ตุลาคม 2569/);
 assert.match(html,/ถูกต้องครบถ้วนเมื่อวันที่ 25 ตุลาคม 2569/);
});
test('receiving number remains editable and overrides the automatic placeholder',()=>{
 const html=buildDocuments({...sample,document_meta:{acceptance_number:'ร. 218/2569',delivery_date:'2026-10-25',acceptance_date:'2026-10-26'}},school);
 assert.match(html,/ใบตรวจรับ เลขที่ ร\. 218\/2569/);
 assert.match(html,/วันที่ 26 ตุลาคม 2569/);
});
test('multipage requisition repeats heading, receiving and issuing signatures on every page',()=>{
 const long={...sample,items:Array.from({length:21},(_,i)=>({name:'วัสดุ '+(i+1),qty:1,unit:'ชุด',price_satang:100})),total_satang:2100};
 const html=buildDocuments(long,school);
 assert.equal((html.match(/ใบเบิกพัสดุ<\/h2>/g)||[]).length,3);
 assert.equal((html.match(/class="gov-requisition-signatures"/g)||[]).length,3);
 assert.match(html,/หน้าที่ 1\/3/);
 assert.match(html,/หน้าที่ 2\/3/);
 assert.match(html,/หน้าที่ 3\/3/);
 assert.match(html,/>21<\/td>/);
 assert.equal((html.match(/<section class="paper-page/g)||[]).length,10);
});
test('each annex continuation retains title, official table and both signers',()=>{
 const long={...sample,items:Array.from({length:11},(_,i)=>({name:'พัสดุ '+(i+1),qty:1,unit:'ชุด',price_satang:100})),total_satang:1100};
 const html=buildDocuments(long,school);
 assert.equal((html.match(/รายละเอียดของพัสดุที่จะซื้อ แนบท้ายรายงานขอซื้อ<\/h2>/g)||[]).length,2);
 assert.equal((html.match(/class="gov-annex-sign"/g)||[]).length,2);
});
test('PDF layout measures every complete page rather than allowing cut-off signature',async()=>{
 const {readFileSync}=await import('node:fs');
 const js=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('./government-forms.css',import.meta.url),'utf8');
 assert.match(js,/fitSheet=sheet=>/);
 assert.match(js,/data-fit-margin|fitMargin/);
 assert.match(js,/ensureAcceptanceNumber/);
 assert.match(css,/height:297mm!important/);
 assert.match(css,/gov-right-head/);
});


test('unusually long requisition lines can be repartitioned with full signatures',()=>{
 const long={...sample,items:Array.from({length:12},(_,i)=>({name:'รายการพัสดุเลขที่ '+(i+1),qty:1,unit:'ชุด',price_satang:100})),total_satang:1200,__items_per_page:3};
 const html=buildDocuments(long,school);
 assert.equal((html.match(/ใบเบิกพัสดุ<\/h2>/g)||[]).length,4);
 assert.equal((html.match(/class="gov-requisition-signatures"/g)||[]).length,4);
 assert.equal((html.match(/class="gov-annex-sign"/g)||[]).length,4);
 assert.match(html,/หน้าที่ 4\/4/);
});
test('adaptive layout retries smaller batches only with completed page groups',async()=>{
 const {readFileSync}=await import('node:fs');
 const code=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 assert.match(code,/for\(const count of \[9,7,5,3,2,1\]\)/);
 assert.match(code,/__items_per_page:count/);
 assert.match(code,/complete-a4-pages/);
});


test('one-time entry shows only memo reference and inspector position at creation',()=>{
 const html=docMetaInputs({memo_number:'25/2569'},{mode:'create'});
 assert.match(html,/name="doc_memo_number"/);
 assert.match(html,/name="doc_inspector_position"/);
 assert.doesNotMatch(html,/name="doc_budget_year"/);
 assert.doesNotMatch(html,/name="doc_order_number"/);
 assert.doesNotMatch(html,/name="doc_vat_baht"/);
});
test('saved evidence survives partial form saves and blank fields affect only their own key',()=>{
 const old={memo_number:'25/2569',invoice_number:'INV-5',budget_year:'2570',vat_baht:'0',inspection_location:'ห้องพัสดุ'};
 assert.deepEqual(docMetaValue({doc_order_number:'PO-11'},old),{...old,order_number:'PO-11'});
 assert.deepEqual(docMetaValue({doc_memo_number:'',doc_delivery_date:'2026-10-25'},old),{...old,delivery_date:'2026-10-25'});
});
test('budget year and budget source propagate without extra metadata entries',()=>{
 const record={...sample,fiscal_year:2570,budget_source:'กิจกรรมพัฒนาผู้เรียน',document_meta:{}};
 const html=buildDocuments(record,school);
 assert.match(html,/ปีงบประมาณ 2570/);
 assert.match(html,/มีเงินตามกิจกรรม\/โครงการ กิจกรรมพัฒนาผู้เรียน/);
});
test('shared delivery date is used for receiving and requisition dates',()=>{
 const record={...sample,document_meta:{delivery_date:'2026-10-25'}};
 const html=buildDocuments(record,school);
 assert.ok((html.match(/วันที่ 25 ตุลาคม 2569/g)||[]).length>=3);
});
test('net amount derived from a single gross and real deductions only',()=>{
 const record={...sample,document_meta:{withholding_baht:'10',fine_baht:'0',vat_baht:'14'}};
 const html=buildDocuments(record,school);
 assert.match(html,/186\.00/);
 assert.match(html,/190\.00/);
 assert.match(html,/หนึ่งร้อยเก้าสิบบาทถ้วน/);
});
test('unset deductions do not silently imply zero withholding or tax',()=>{
 const record={...sample,document_meta:{}};
 const html=buildDocuments(record,school);
 assert.match(html,/คงเหลือจ่ายจริง/);
 assert.match(html,/จำนวนเงินที่ขอเบิก/);
});


test('request memo uses พว. while approval and payment use only ที่ and reference number',()=>{
 const record={...sample,document_meta:{memo_prefix:'พว.',memo_number:'11/2569',approval_memo_number:'12/2569',payment_memo_number:'13/2569'}};
 const html=buildDocuments(record,school);
 assert.match(html,/พว\. 11\/2569/);
 for(const no of ['12/2569','13/2569'])assert.match(html,new RegExp('<strong>ที่<\\/strong><span class="memo-value">'+no.replace('/','\\/')+'<\\/span>'));
 assert.equal((html.match(/พว\.\s+(?:11|12|13)\/2569/g)||[]).length,1);
});
test('annex legal article 22 begins its own line',()=>{
 const html=buildDocuments(sample,school);
 assert.match(html,/class="gov-law gov-law-second">ข้อ 22 วรรคหนึ่ง \(2\) และข้อ 22 วรรคสอง/);
});
test('payment words are next to payable approval rather than dangling below table',()=>{
 const record={...sample,document_meta:{withholding_baht:'10.00',fine_baht:'0'}};
 const html=buildDocuments(record,school);
 assert.match(html,/อนุมัติจ่ายเงินให้แก่ [^<]+ เป็นเงิน 190\.00 บาท \(หนึ่งร้อยเก้าสิบบาทถ้วน\)/);
 assert.doesNotMatch(html,/class="gov-words"/);
});
test('explicit net amount can be recorded instead of merely displaying a deduction estimate',()=>{
 const record={...sample,document_meta:{payable_baht:'195.50',withholding_baht:'10.00',fine_baht:'0'}};
 const html=buildDocuments(record,school);
 assert.match(html,/195\.50 บาท \(หนึ่งร้อยเก้าสิบห้าบาทห้าสิบสตางค์\)/);
});
test('payment director approval prints decision at left and blank sign line then name and position',()=>{
 const html=buildDocuments(sample,school);
 assert.match(html,/class="gov-payment-decision">1\. ทราบ<br>2\. อนุมัติจ่ายเงิน/);
 assert.match(html,/class="gov-payment-signline">ลงชื่อ <span class="gov-director-rule"><\/span>/);
 assert.match(html,/class="gov-director-position kp-signature-position kp-director-one-line">ผู้อำนวยการโรงเรียนกาวิละวิทยาลัย/);
});
test('four-step wizard preserves draft and validates each stage',async()=>{
 const {readFileSync}=await import('node:fs');
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 assert.match(app,/function moveWizard\(delta\)/);
 assert.match(app,/wizard-next/);
 assert.match(app,/wizard-prev/);
 assert.match(app,/data-wizard-panel/);
 assert.match(app,/collectDraft\(\);state\.wizardStep/);
});
test('new memo reference inputs are individually labeled and editable',()=>{
 const html=docMetaInputs({memo_prefix:'พว.',memo_number:'1/2569',approval_memo_number:'2/2569',payment_memo_number:'3/2569'},{mode:'create'});
 for(const key of ['memo_prefix','memo_number','approval_memo_number','payment_memo_number'])assert.match(html,new RegExp('name="doc_'+key+'"'));
 assert.match(html,/ที่ — รายงานผลการพิจารณาฯ/);
 assert.match(html,/ที่ — ทราบผลและขออนุมัติเบิกจ่าย/);
});

test('memo prefix cannot accidentally contain numbers when printing (real duplicated screenshot)',()=>{
 assert.equal(normalizeMemoPrefix('พว 1/2569'),'พว');
 assert.equal(normalizeMemoPrefix('พว. 1/2569'),'พว.');
 assert.equal(normalizeMemoNumber('พว. 2/2569','พว.'),'2/2569');
 assert.equal(renderMemoReference('พว 1/2569','2/2569'),'พว 2/2569');
 assert.equal(renderMemoReference('พว. 1/2569','พว. 2/2569'),'พว. 2/2569');
 assert.equal(renderMemoReference('พว. 1/2569','พว. 1/2569 2/2569'),'พว. 2/2569');
});
test('the three printed memo pages use precisely one distinct reference per page',()=>{
 const record={...sample,document_meta:{
  memo_prefix:'พว. 1/2569',memo_number:'พว. 2/2569',
  approval_memo_number:'3/2569',payment_memo_number:'พว. 4/2569'
 }};
 const html=buildDocuments(record,{...school,memo_prefix:'พว. 1/2569'});
 assert.match(html,/พว\. 2\/2569/);
 for(const no of ['3/2569','4/2569'])assert.match(html,new RegExp('<strong>ที่<\\/strong><span class="memo-value">'+no.replace('/','\\/')+'<\\/span>'));
 assert.equal((html.match(/พว\.\s+(?:2|3|4)\/2569/g)||[]).length,1);
 assert.doesNotMatch(html,/พว\.\s+1\/2569\s+2\/2569/);
 assert.equal((html.match(/memo-field-number/g)||[]).length,3);
});
test('form strips reused พว. in old memo values but never erases the document number',()=>{
 const html=docMetaInputs({memo_prefix:'พว. 5/2569',memo_number:'พว. 6/2569'},{mode:'create'});
 assert.match(html,/name="doc_memo_prefix"[^>]*value="พว\."/);
 assert.match(html,/name="doc_memo_number"[^>]*value="6\/2569"/);
 const saved=docMetaValue({doc_memo_prefix:'พว. 5/2569',doc_memo_number:'พว. 6/2569'});
 assert.equal(saved.memo_prefix,'พว.');
 assert.equal(saved.memo_number,undefined);
});
test('duplicated reference sequences in one input are rejected instead of silently saved',()=>{
 assert.deepEqual(docMetaValue({doc_memo_number:'พว. 1/2569 2/2569'}),{});
 assert.deepEqual(docMetaValue({doc_memo_number:'พว.'}),{});
});

test('the request memo alone carries the school prefix in both purchase and hire',()=>{
 for(const kind of ['purchase','hire']){
  const record={...sample,kind,document_meta:{
   memo_prefix:'พว.',memo_number:'2/2569',
   approval_memo_number:'พว. 3/2569',payment_memo_number:'พว. 4/2569'
  }};
  const html=buildDocuments(record,school);
  const numbers=[...html.matchAll(/<div class="memo-field memo-field-number"><strong>ที่<\/strong><span class="memo-value">([^<]+)<\/span>/g)].map(m=>m[1]);
  assert.deepEqual(numbers,['พว. 2/2569','3/2569','4/2569']);
 }
});


test('purchasing wizard step four includes editable requisition form number',()=>{
 const html=docMetaInputs({requisition_number:'จ. 218/2569'},{mode:'create',kind:'purchase'});
 assert.match(html,/name="doc_requisition_number"/);
 assert.match(html,/value="จ\. 218\/2569"/);
 assert.match(html,/ใบเบิกพัสดุ เลขที่/);
 const saved=docMetaValue({doc_requisition_number:'จ. 219/2569'});
 assert.equal(saved.requisition_number,undefined);
});
test('hiring wizard does not ask for a purchasing requisition number',()=>{
 const html=docMetaInputs({},{mode:'create',kind:'hire'});
 assert.doesNotMatch(html,/name="doc_requisition_number"/);
 assert.doesNotMatch(docMetaInputs({}, {mode:'all',kind:'hire'}),/name="doc_requisition_number"/);
});
test('requisition number entered once prints on all requisition continuation sheets',()=>{
 const record={...sample,items:Array.from({length:12},(_,i)=>({name:'วัสดุที่ '+(i+1),qty:1,unit:'ชุด',price_satang:100})),total_satang:1200,document_meta:{requisition_number:'จ. 218/2569'}};
 const html=buildDocuments(record,school);
 assert.equal((html.match(/ใบเบิก เลขที่ จ\. 218\/2569/g)||[]).length,2);
 assert.equal((html.match(/class="gov-requisition-signatures"/g)||[]).length,2);
});
test('payment signature blocks occupy full width and avoid detached decision/identity rows',async()=>{
 const {readFileSync}=await import('node:fs');
 const css=readFileSync(new URL('./government-forms.css',import.meta.url),'utf8');
 assert.match(css,/\.gov-payment \.memo-signatures\{\s*display:block!important/);
 assert.match(css,/\.gov-payment \.gov-payment-director\{\s*display:flex!important;\s*flex-direction:column!important/);
 assert.match(css,/\.gov-payment \.gov-payment-director-sign\{\s*display:block!important;[\s\S]*?margin:7mm 0 0!important/);
 assert.match(css,/\.gov-payment \.gov-payment-decision\{\s*position:static!important;\s*top:auto!important/);
 assert.match(css,/\.gov-payment \.gov-finance-wrap,/);
 assert.match(css,/@media print\{[\s\S]*?\.gov-payment \.gov-payment-decision\{\s*position:static!important;\s*top:auto!important/);
});
test('payment finance note is not redundantly printed and signatures have separate rows',()=>{
 const html=buildDocuments(sample,school);
 const paymentPage=html.slice(html.indexOf('gov-payment'));
 assert.doesNotMatch(paymentPage,/หมายเหตุเจ้าหน้าที่การเงิน/);
 assert.match(paymentPage,/class="gov-finance-wrap"><div class="signature-card kp-signature"/);
 assert.match(paymentPage,/class="signature-name">\([^<]+\)<\/div><div class="signature-role kp-signature-position">เจ้าหน้าที่การเงิน<\/div>/);
 assert.match(paymentPage,/class="signature-date">วันที่ <span class="date-rule"><\/span><\/div>/);
 assert.match(paymentPage,/class="gov-payment-director"/);
 assert.match(paymentPage,/class="gov-director-position kp-signature-position kp-director-one-line">ผู้อำนวยการโรงเรียนกาวิละวิทยาลัย/);
});
test('finance notes entered as real values are still available as optional additional notes',()=>{
 const rec={...sample,document_meta:{...sample.document_meta,finance_note:'เอกสารครบถ้วน'}};
 const html=buildDocuments(rec,school);
 assert.match(html,/class="gov-finance-extra-note">หมายเหตุเพิ่มเติม เอกสารครบถ้วน/);
 assert.doesNotMatch(html,/หมายเหตุเจ้าหน้าที่การเงิน/);
});


test('official number input is read-only because school ledger allocates and tracks it',()=>{
 const form=docMetaInputs({memo_number:'2/2569',approval_memo_number:'3/2569',payment_memo_number:'4/2569'},{mode:'create',kind:'purchase'});
 for(const field of ['memo_number','approval_memo_number','payment_memo_number','requisition_number']){
  assert.match(form,new RegExp('name="doc_'+field+'"[^>]*readonly'));
 }
 const stored=docMetaValue({doc_memo_number:'1/2569',doc_approval_memo_number:'2/2569',
  doc_requisition_number:'จ. 2/2569',doc_inspector_position:'ครู'});
 assert.equal(stored.memo_number,undefined);
 assert.equal(stored.requisition_number,undefined);
 assert.equal(stored.inspector_position,'ครู');
});
test('central registry adds a menu, handles issuance, search, corrections and status',async()=>{
 const {readFileSync}=await import('node:fs');
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 assert.match(app,/ทะเบียนคุมเลขเอกสาร/);
 assert.match(app,/issue_official_number/);
 assert.match(app,/manage_official_number/);
 assert.match(app,/set_official_number_start/);
 assert.match(app,/official_number_registry/);
 assert.match(app,/registry-filter-form/);
 assert.match(app,/registry-edit/);
 assert.match(app,/registry-void/);
 assert.match(app,/registry-use/);
});
test('ledger schema permanently reserves void numbers and isolates school RLS',async()=>{
 const {readFileSync}=await import('node:fs');
 const path=new URL('../supabase/migrations/20261020_official_number_registry.sql',import.meta.url);
 const sql=readFileSync(path,'utf8');
 const fix=readFileSync(new URL('../supabase/migrations/20261020_fix_registry_tenant_rls.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE UNIQUE INDEX official_registry_unique_number/);
 assert.match(sql,/WHERE status<>'conflict'/);
 assert.match(sql,/FOR EACH ROW EXECUTE FUNCTION public.auto_register_procurement_numbers/);
 assert.match(fix,/m\.school_id=official_number_registry\.school_id/);
});

test('admins can reconcile historical malformed numbers without deleting audit entries',async()=>{
 const {readFileSync}=await import('node:fs');
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 const sql=readFileSync(new URL('../supabase/migrations/20261020_resolve_legacy_official_number_conflicts.sql',import.meta.url),'utf8');
 assert.match(app,/registry-resolve/);
 assert.match(app,/resolve_official_number_conflict/);
 assert.match(sql,/status='resolved'/);
 assert.match(sql,/'reserved',auth\.uid\(\)/);
 assert.match(sql,/audit_logs/);
});
test('receipt and requisition only reserve after the actual delivery is recorded',async()=>{
 const {readFileSync}=await import('node:fs');
 const sql=readFileSync(new URL('../supabase/migrations/20261020_registry_workflow_legacy_rpc.sql',import.meta.url),'utf8');
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 assert.match(sql,/after_delivery_allocate_official_numbers/);
 assert.match(sql,/NEW\.document_meta->>'delivery_date'/);
 assert.match(app,/!r\.document_meta\?\.delivery_date/);
});

test('registry searches all historical document subjects, not only dashboard recent rows',async()=>{
 const {readFileSync}=await import('node:fs');
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 assert.match(app,/select\('\*,procurements\(title,vendor_name,kind\)'\)/);
 assert.match(app,/range\(offset,offset\+size-1\)/);
 assert.match(app,/recordsById\.get\(n\.procurement_id\)\|\|n\.procurements/);
});

test('every official signature card has line, centered full name, separate position and date',()=>{
 const html=buildDocuments(sample,school);
 const cards=[...html.matchAll(/<div class="signature-card kp-signature[^"]*">([\s\S]*?)<\/div>/g)];
 assert.ok(cards.length>=15,'expected signature blocks across all official pages');
 for(const [,block] of cards){
  assert.match(block,/ลงชื่อ <span class="(?:signature-rule|gov-director-rule)"/);
  assert.doesNotMatch(block,/signature-rule"><\/span>\s*(?:เจ้าหน้าที่|หัวหน้าเจ้าหน้าที่|ผู้ตรวจรับ)/);
 }
 assert.match(html,/class="signature-role kp-signature-position">หัวหน้าเจ้าหน้าที่<\/div><div class="signature-date">วันที่/);
 assert.match(html,/class="signature-role kp-signature-position">เจ้าหน้าที่<\/div><div class="signature-date">วันที่/);
});
test('director name, entire school title, and date remain in the same atomic card',()=>{
 const html=buildDocuments(sample,school);
 assert.match(html,/class="signature-card kp-signature gov-director-card"/);
 assert.match(html,/class="gov-director-position kp-signature-position kp-director-one-line">ผู้อำนวยการโรงเรียนกาวิละวิทยาลัย/);
 assert.match(html,/ผู้อำนวยการโรงเรียนกาวิละวิทยาลัย<\/div><div class="signature-date">วันที่/);
 assert.match(html,/class="signature-card kp-signature gov-payment-signature"/);
});
test('uniform signature CSS keeps names whole and dates distinctly spaced',async()=>{
 const {readFileSync}=await import('node:fs');
 const css=readFileSync(new URL('./government-forms.css',import.meta.url),'utf8');
 assert.match(css,/\.kp-signature\{[\s\S]*?break-inside:avoid!important/);
 assert.match(css,/\.kp-signature>.signature-name\{[\s\S]*?white-space:nowrap!important/);
 assert.match(css,/\.kp-signature>.signature-date\{[\s\S]*?margin:2\.6mm 0 0!important/);
 assert.match(css,/\.kp-signature \.kp-position-part\{[\s\S]*?white-space:nowrap!important/);
 assert.match(css,/\.gov-annex \.gov-law-second\{[\s\S]*?font-weight:400!important/);
});
test('purchase report, approval memo, acceptance and requisition keep all signature pieces',()=>{
 const html=buildDocuments(sample,school);
 for(const cls of ['gov-request','gov-approval','gov-acceptance','gov-payment','gov-requisition']){
  const i=html.indexOf(' '+cls+'"');assert.ok(i>=0,'missing '+cls);
  const section=html.slice(i,html.indexOf('</section>',i));
  assert.match(section,/signature-card kp-signature/);
  assert.match(section,/signature-date/);
 }
});

test('director title must be one unbroken verbatim line in all memo signature blocks',()=>{
 const html=buildDocuments(sample,school);
 const title='ผู้อำนวยการโรงเรียนกาวิละวิทยาลัย';
 assert.equal((html.match(/class="gov-director-position kp-signature-position kp-director-one-line">ผู้อำนวยการโรงเรียนกาวิละวิทยาลัย<\/div>/g)||[]).length,4);
 assert.doesNotMatch(html,/class="kp-position-part"/);
 assert.equal(html.split('class="signature-role kp-signature-position">เจ้าหน้าที่</div>').length-1>=2,true);
 assert.ok(html.includes(title));
});
test('only the director-position font is resized, with overflow measured from active rendered width',async()=>{
 const {readFileSync}=await import('node:fs');
 const css=readFileSync(new URL('./government-forms.css',import.meta.url),'utf8');
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 assert.match(css,/\.kp-signature>\.gov-director-position\.kp-director-one-line\{/);
 assert.match(css,/white-space:nowrap!important/);
 assert.match(app,/function fitDirectorPosition\(root\)/);
 assert.match(app,/label\.scrollWidth>label\.clientWidth/);
 assert.match(app,/label\.style\.setProperty\('font-size',px\+'px','important'\)/);
 assert.match(app,/fitDirectorPosition\(sheet\)/);
 assert.match(app,/fitDirectorPosition\(previewRoot\)/);
});
test('long school names retain their exact original director title without manual line breaks',()=>{
 const schoolLong={...school,name:'โรงเรียนตัวอย่างวิทยาลัยเทคโนโลยีและการจัดการศึกษาวิทยาศาสตร์จังหวัดเชียงใหม่'};
 const html=buildDocuments(sample,schoolLong);
 assert.ok(html.includes('ผู้อำนวยการ'+schoolLong.name+'</div>'));
 assert.doesNotMatch(html,/ผู้อำนวยการ<\/span><span/);
});

test('original payment approval places 1.ทราบ/2.อนุมัติ first then the director signature underneath on the LEFT',()=>{
 const html=buildDocuments(sample,school);
 const payment=html.slice(html.indexOf('gov-payment"'));
 const d=payment.indexOf('<div class="gov-payment-director">');
 const x=payment.indexOf('<div class="gov-payment-decision">1. ทราบ<br>2. อนุมัติจ่ายเงิน</div>',d);
 const sign=payment.indexOf('<div class="gov-payment-director-sign">',d);
 const line=payment.indexOf('class="gov-payment-signline">ลงชื่อ',sign);
 const name=payment.indexOf('class="signature-name">',sign);
 const title=payment.indexOf('class="gov-director-position kp-signature-position kp-director-one-line">',sign);
 assert.ok(d>=0 && x>d && sign>x && line>sign && name>line && title>name,
  'Director decision and signature must follow original top-to-bottom order');
 assert.match(payment.slice(sign,sign+900),/ผู้อำนวยการโรงเรียนกาวิละวิทยาลัย/);
});
test('payment approval is stacked at the left; officer signature remains at the right without overlaps',async()=>{
 const {readFileSync}=await import('node:fs');
 const css=readFileSync(new URL('./government-forms.css',import.meta.url),'utf8');
 const trailing=css.slice(css.indexOf('Payment memo — faithful to the original signed paper form.'));
 assert.match(trailing,/\.gov-payment \.gov-payment-director\{\s*display:flex!important;\s*flex-direction:column!important;\s*align-items:flex-start!important/);
 assert.match(trailing,/\.gov-payment \.gov-payment-director-sign\{[\s\S]*?width:58%!important/);
 assert.match(trailing,/@media print\{[\s\S]*?\.gov-payment \.gov-payment-director-sign\{[\s\S]*?margin-left:0!important/);
 assert.match(css,/\.gov-payment \.gov-finance-sign\{\s*width:60%/);
});

test('payment memo visually follows original: decision LEFT, finance sign RIGHT, director below LEFT',()=>{
 const html=buildDocuments(sample,school);
 const sec=html.slice(html.indexOf('gov-payment"'));
 const wrapper=sec.indexOf('<div class="memo-signatures">');
 const pair=sec.indexOf('<div class="gov-payment-approval-top">',wrapper);
 const decision=sec.indexOf('<div class="gov-payment-decision">1. ทราบ<br>2. อนุมัติจ่ายเงิน</div>',pair);
 const finance=sec.indexOf('<div class="gov-finance-sign">',pair);
 const financeRole=sec.indexOf('>เจ้าหน้าที่การเงิน</div>',finance);
 const director=sec.indexOf('<div class="gov-payment-director-sign">',finance);
 const dirLine=sec.indexOf('class="gov-payment-signline">ลงชื่อ',director);
 assert.ok(wrapper>=0 && pair>wrapper && decision>pair && finance>decision &&
  financeRole>finance && director>financeRole && dirLine>director,
 'Layout must be (decision at left + finance at right) on top; director signature below');
 assert.equal((sec.match(/class="gov-finance-sign"/g)||[]).length,1);
 assert.equal((sec.match(/class="gov-payment-director-sign"/g)||[]).length,1);
});
test('print layout keeps original approval and finance in the same row, director below as a whole card',async()=>{
 const {readFileSync}=await import('node:fs');
 const css=readFileSync(new URL('./government-forms.css',import.meta.url),'utf8');
 const section=css.slice(css.indexOf('Precise original payment approval geometry'));
 assert.match(section,/\.gov-payment \.gov-payment-approval-top\{\s*display:grid!important;\s*grid-template-columns:minmax\(0,36%\) minmax\(0,64%\)!important/);
 assert.match(section,/\.gov-payment \.gov-payment-approval-top \.gov-payment-decision\{[\s\S]*?grid-column:1!important/);
 assert.match(section,/\.gov-payment \.gov-payment-approval-top \.gov-finance-sign\{[\s\S]*?grid-column:2!important/);
 assert.match(section,/\.gov-payment \.gov-payment-director-sign\{\s*margin-top:8mm!important/);
 assert.match(section,/@media print\{[\s\S]*?\.gov-payment \.gov-payment-approval-top\{\s*display:grid!important/);
});

test('all purchase and hiring annex tables keep every exact Thai header on one line',()=>{
 const examples=[sample,{...sample,kind:'hire'}];
 for(const record of examples){
  const html=buildDocuments(record,school);
  const tables=[...html.matchAll(/<table class="official-table official-table-ruled gov-items gov-price-table">([\s\S]*?)<\/table>/g)];
  assert.ok(tables.length>=1,'every procurement requires a price annex');
  for(const [,body] of tables){
   assert.match(body,/^<colgroup><col class="col-order"><col class="col-description"><col class="col-quantity"><col class="col-unit"><col class="col-price"><col class="col-total"><\/colgroup>/);
   for(const text of ['ลำดับ','รายละเอียดและคุณลักษณะ','จำนวน','หน่วย','ราคาต่อหน่วย','จำนวนเงิน']){
    assert.match(body,new RegExp('<th[^>]*>'+text+'</th>'));
   }
  }
 }
});
test('requisition continuation tables use the exact five original headers and fixed width colgroup',()=>{
 const record={...sample,items:Array.from({length:18},(_,i)=>({name:'พัสดุ '+(i+1),qty:1,unit:'ชุด',price_satang:100})),total_satang:1800};
 const html=buildDocuments(record,school);
 const tables=[...html.matchAll(/<table class="official-table official-table-ruled gov-items gov-requisition-table">([\s\S]*?)<\/table>/g)];
 assert.equal(tables.length,2);
 for(const [,body] of tables){
  assert.match(body,/^<colgroup><col class="col-order"><col class="col-description"><col class="col-quantity"><col class="col-unit"><col class="col-note"><\/colgroup>/);
  for(const text of ['ลำดับ','รายละเอียดและคุณลักษณะ','จำนวน','หน่วย','หมายเหตุ']){
   assert.match(body,new RegExp('<th[^>]*>'+text+'</th>'));
  }
 }
});
test('government print CSS fixes order column width and prohibits splitting Thai table headings',async()=>{
 const {readFileSync}=await import('node:fs');
 const css=readFileSync(new URL('./government-forms.css',import.meta.url),'utf8');
 const rules=css.slice(css.indexOf('Official A4 tables — preserve every ORIGINAL header'));
 assert.match(rules,/\.gov-price-table col\.col-order,[\s\S]*?width:11\.5%!important/);
 assert.match(rules,/\.gov-requisition-table col\.col-order,[\s\S]*?width:11\.5%!important/);
 assert.match(rules,/\.gov-items thead th\{\s*white-space:nowrap!important;\s*word-break:keep-all!important;\s*overflow-wrap:normal!important/);
 assert.match(rules,/@media print\{[\s\S]*?\.gov-items thead th\{\s*white-space:nowrap!important/);
 assert.match(rules,/\.gov-items tbody td\{\s*word-break:normal!important;\s*overflow-wrap:break-word!important/);
});
test('table heading fit measures all headers and works in both preview and A4 printing',async()=>{
 const {readFileSync}=await import('node:fs');
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 assert.match(app,/function fitOfficialTableHeaders\(root\)/);
 assert.match(app,/for\(const table of root\.querySelectorAll\('\.gov-items'\)\)/);
 assert.match(app,/heads\.some\(h=>h\.scrollWidth>h\.clientWidth\+1\)/);
 assert.match(app,/for\(const head of heads\)head\.style\.setProperty\('font-size',px\+'px','important'\)/);
 assert.match(app,/fitOfficialTableHeaders\(sheet\)/);
 assert.match(app,/fitOfficialTableHeaders\(previewRoot\)/);
});

test('remove unfinished archive menu and retain PDF saving through procurement register',async()=>{
 const {readFileSync}=await import('node:fs');
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 assert.doesNotMatch(app,/items\.push\(\['storage','จัดเก็บเอกสาร'/);
 assert.doesNotMatch(app,/data-action="storage"/);
 assert.doesNotMatch(app,/if\(state\.page==='storage'\)/);
 assert.doesNotMatch(app,/function storage\(\)/);
 assert.doesNotMatch(app,/if\(action==='storage'\)/);
 assert.match(app,/function records\(\)/);
 assert.match(app,/function recordTable\(rows\)/);
 assert.match(app,/เปิดดู','open'/);
 assert.match(app,/พิมพ์ \/ บันทึก PDF','print'/);
 assert.match(app,/บันทึกเป็น PDF/);
 assert.match(app,/เลือกตำแหน่งจัดเก็บไฟล์ได้เอง/);
});
test('dashboard replaces storage shortcut with document-number register instead of dead link',async()=>{
 const {readFileSync}=await import('node:fs');
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 assert.match(app,/<button class="action-card" data-action="registry">/);
 assert.match(app,/if\(action==='registry'\|\|action==='registry-refresh'\)/);
 assert.doesNotMatch(app,/<button class="action-card" data-action="storage">/);
});


test('six template pages each have an independently editable school version',async()=>{
 const {TEMPLATE_PAGES}=await import('./template-builder.js');
 assert.deepEqual(TEMPLATE_PAGES.map(p=>p.key),['request','annex','approval','acceptance','payment','requisition']);
});
test('template extra blocks bind live record data but never evaluate arbitrary variable names',async()=>{
 const {expandTemplateText,templateBindings,templateEsc}=await import('./template-builder.js');
 const txt=expandTemplateText('{{school_name}} : {{vendor_name}} {{total_amount}} {{unknown}}',sample,school);
 assert.match(txt,/โรงเรียนกาวิละวิทยาลัย/);
 assert.match(txt,new RegExp(sample.vendor_name));
 assert.doesNotMatch(txt,/{{unknown}}/);
 assert.equal(templateEsc('<script>alert(1)</script>'),'&lt;script&gt;alert(1)&lt;/script&gt;');
 assert.equal(templateBindings(sample,school).items_count,String(sample.items.length));
});
test('template changes reject arbitrary HTML/CSS properties and sanitize typed JSON blocks',async()=>{
 const {safeTemplateDraft,emptyTemplate}=await import('./template-builder.js');
 const row=safeTemplateDraft({
  title:'หัวข้อพิเศษ',legal:'',blocks:[{id:'xfirst',type:'paragraph',text:'{{vendor_name}}',
   align:'center',size:18,bold:true,html:'<script>alert(1)</script>'}],
  order:['d0','xfirst'],styles:{d0:{align:'right',size:16,bold:true},bad:{align:'center'}}
 });
 assert.deepEqual(Object.keys(row).sort(),['blocks','legal','order','signatureOffsets','styles','textEdits','title']);
 assert.ok(!JSON.stringify(row).includes('script'));
 assert.deepEqual(Object.keys(row.styles),['d0']);
 assert.equal(row.blocks[0].text,'{{vendor_name}}');
 assert.deepEqual(emptyTemplate().blocks,[]);
 assert.throws(()=>safeTemplateDraft({blocks:Array.from({length:25},()=>({text:'a'}))}),/24/);
});
test('published layouts apply only to draft records; approved records retain pinned editions',async()=>{
 const {activeTemplateLayouts}=await import('./template-builder.js');
 const schoolRows={request:{published:{title:'ฉบับใหม่'},published_version:3}};
 const history={'request:1':{layout:{title:'ฉบับเก่า'}}};
 assert.equal(activeTemplateLayouts(schoolRows,history,{state:'draft'}).request.title,'ฉบับใหม่');
 assert.equal(activeTemplateLayouts(schoolRows,history,{state:'approved',document_template_versions:{request:1}}).request.title,'ฉบับเก่า');
 assert.equal(activeTemplateLayouts(schoolRows,history,{state:'approved',document_template_versions:{}}).request,undefined);
});
test('save/publish RPC, school-scoped RLS and immutable template version history are included',async()=>{
 const {readFileSync}=await import('node:fs');
 const sql=readFileSync(new URL('../supabase/migrations/20261021_school_document_template_builder.sql',import.meta.url),'utf8');
 const strict=readFileSync(new URL('../supabase/migrations/20261021_template_builder_style_validation.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE POLICY school_template_read[\s\S]*?is_school_member\(school_id\)/);
 assert.match(sql,/CREATE POLICY school_template_history_read[\s\S]*?is_school_member\(school_id\)/);
 assert.match(sql,/public\.save_school_document_template/);
 assert.match(sql,/public\.publish_school_document_template/);
 assert.match(sql,/public\.is_school_admin\(p_school_id\)/);
 assert.match(sql,/CREATE TRIGGER before_procurement_pin_template/);
 assert.match(strict,/t\.k NOT IN \('title','legal','blocks','order','styles'\)/);
});
test('admin-only template menu works without replacing official print masters',async()=>{
 const {readFileSync}=await import('node:fs');
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 assert.match(app,/items\.push\(\['templates','แม่แบบเอกสาร'/);
 assert.match(app,/if\(action==='templates'\)\{if\(!isSchoolAdmin\(\)\)/);
 assert.match(app,/school_document_template_versions/);
 assert.match(app,/applyDocumentTemplates\(buildDocuments\(/);
 assert.match(app,/liveTemplateLayouts\(state\.currentRecord\)/);
 assert.match(app,/templateEditor\.dragStart/);
 assert.match(app,/templateEditor\.drop/);
});
test('A4 template editor supports block dragging, independent page previews, saving and publishing',async()=>{
 const {readFileSync}=await import('node:fs');
 const code=readFileSync(new URL('./template-builder.js',import.meta.url),'utf8');
 assert.match(code,/async function save\(\)/);
 assert.match(code,/async function publish\(\)/);
 assert.match(code,/function drop\(el,ev\)/);
 assert.match(code,/function view\(\)/);
 assert.match(code,/save_school_document_template/);
 assert.match(code,/publish_school_document_template/);
 assert.match(code,/class="te-preview-scroll"/);
 assert.match(code,/class="te-block '/);
});

test('empty and heading-only school templates never reorder legally protected master blocks',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('./template-builder.js',import.meta.url),'utf8');
 assert.match(source,/if\(!t\.order\.length&&!t\.blocks\.length\)continue/);
 assert.match(source,/function structuralBlocks\(section\)/);
 assert.match(source,/memo-signatures/);
 assert.match(source,/gov-requisition-signatures/);
 assert.match(source,/gov-inspection-bottom/);
});

test('Word editor protects per-record names, amount and dates while permitting static text',async()=>{
 const {tokenizeOriginalText,applyTextFragments,protectedValues,thaiSystemDate}=await import('./template-rich-editor.js');
 const input='เพื่อจัดซื้อจาก '+sample.vendor_name+' เป็นเงิน 200.00 บาท มีความจำเป็นตามแผนของโรงเรียน';
 const parts=tokenizeOriginalText(input,sample,school);
 assert.equal(parts.filter(p=>p.kind==='locked').some(p=>p.value===sample.vendor_name),true);
 assert.equal(parts.filter(p=>p.kind==='locked').some(p=>p.value==='200.00'),true);
 const edited=parts.filter(p=>p.kind==='text').map(x=>x.value.replace('เพื่อจัดซื้อ','เพื่อดำเนินการจัดซื้อ'));
 const result=applyTextFragments(input,edited,sample,school);
 assert.match(result,/เพื่อดำเนินการจัดซื้อ/);
 assert.match(result,new RegExp(sample.vendor_name));
 assert.match(result,/200\.00/);
 assert.equal(thaiSystemDate('2026-10-21'),'21 ตุลาคม 2569');
 assert.equal(protectedValues(sample,school).some(x=>x[0]==='director_name'),true);
});
test('Word editor stores literal fragments only and ignores incompatible stale data',async()=>{
 const {applyTextFragments,safeSignatureOffset}=await import('./template-rich-editor.js');
 const base='บริษัท ทดสอบ 200.00 บาท';
 assert.equal(applyTextFragments(base,['จำนวนเกิน'],sample,school),base);
 assert.deepEqual(safeSignatureOffset({x:70,y:-80}),{x:15,y:-15});
 assert.deepEqual(safeSignatureOffset({x:4,y:2}),{x:4,y:2});
});
test('inline Word-like edits and bounded atomic signer positions are sanitized for each school',async()=>{
 const {safeTemplateDraft}=await import('./template-builder.js');
 const d=safeTemplateDraft({textEdits:{d0:{0:['ปรับข้อความ'],1:['หัวหน้า','งาน']},hacked:{0:['foo']}},
  signatureOffsets:{director:{x:11,y:-13},inspector:{x:400,y:-400},evil:{x:3,y:3}},blocks:[]});
 assert.deepEqual(d.textEdits.d0['0'],['ปรับข้อความ']);
 assert.equal(d.textEdits.hacked,undefined);
 assert.deepEqual(d.signatureOffsets.inspector,{x:15,y:-15});
 assert.equal(d.signatureOffsets.evil,undefined);
});
test('production bundles the A4 editor stylesheet and direct inline editing is accessible',async()=>{
 const {readFileSync}=await import('node:fs');
 const build=readFileSync(new URL('./build.mjs',import.meta.url),'utf8');
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 const tmpl=readFileSync(new URL('./template-builder.js',import.meta.url),'utf8');
 assert.match(build,/template-builder\.css/);
 assert.match(app,/templateEditor\.inlineInput\(el\)/);
 assert.match(app,/templateEditor\.lockedNotice\(\)/);
 assert.match(app,/templateEditor\.moveSignature\(drag\.id,x,y\)/);
 assert.match(tmpl,/dataset\.templateHeader/);
 assert.match(tmpl,/dataset\.templateText/);
 assert.match(tmpl,/te-system-locked/);
});
test('server validates rich literal fragments and signer coordinates before publishing',async()=>{
 const {readFileSync}=await import('node:fs');
 const sql=readFileSync(new URL('../supabase/migrations/20261021_template_inline_word_edit.sql',import.meta.url),'utf8');
 assert.match(sql,/textEdits/);
 assert.match(sql,/signatureOffsets/);
 assert.match(sql,/abs\(\(pair\.value->>'x'\)::numeric\)>15/);
 assert.match(sql,/jsonb_typeof\(subpair\.value\)<>'array'/);
});

test('the Word ribbon edits originals while computed amount tables remain protected',async()=>{
 const {readFileSync}=await import('node:fs');
 const editor=readFileSync(new URL('./template-builder.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 assert.match(editor,/function isProtectedGeneratedBlock\(el\)/);
 assert.match(editor,/\.gov-count,\.gov-money-list/);
 assert.match(editor,/if\(!isProtectedGeneratedBlock\(n\)\)applyTextEditsToBlock/);
 assert.match(editor,/if\(!block\|\|isProtectedGeneratedBlock\(original\)\)/);
 assert.match(editor,/class="te-word-ribbon"/);
 assert.match(editor,/data-format="bold"/);
 assert.match(editor,/data-tpl-field="ribbonSize"/);
 assert.match(editor,/function selectInline\(el\)/);
 assert.match(ui,/templateEditor\.selectInline\(ev\.target\)/);
 assert.match(ui,/templateEditor\.lockedNotice\(\)/);
});
test('rich editor migration fixes ambiguous text variable and rejects missing signature offsets',async()=>{
 const {readFileSync}=await import('node:fs');
 const sql=readFileSync(new URL('../supabase/migrations/20261021_template_inline_word_edit_validator_fix.sql',import.meta.url),'utf8');
 assert.match(sql,/SELECT entry\.value FROM jsonb_array_elements/);
 assert.match(sql,/NOT \(pair\.value \? 'x' AND pair\.value \? 'y'\)/);
});

test('orange draft save has a unique action style while published template remains separate',async()=>{
 const {readFileSync}=await import('node:fs');
 const template=readFileSync(new URL('./template-builder.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('./template-builder.css',import.meta.url),'utf8');
 assert.match(template,/💾 บันทึกฉบับร่าง/);
 assert.match(template,/tpl-save','te-save-draft/);
 assert.match(template,/tpl-publish','primary/);
 assert.match(css,/\.te-actions \.te-save-draft/);
 assert.match(css,/#ff912e/);
});
test('every state.flash and state.error save acknowledgement produces one dismissible accessible popup',async()=>{
 const {installStateNotices}=await import('./notification-popup.js');
 const state={flash:'',error:''},created=[];
 const element=tag=>({tagName:tag,attributes:{},children:[],isConnected:false,
  setAttribute(k,v){this.attributes[k]=v;},
  addEventListener(k,fn){this[k]=fn;},
  append(...items){this.children.push(...items);},
  remove(){this.isConnected=false;}
 });
 const doc={body:{appendChild(el){el.isConnected=true;created.push(el);}},createElement:element};
 const view=installStateNotices(state,doc);
 state.flash='บันทึกฉบับร่างเรียบร้อย';
 await Promise.resolve();
 assert.equal(created.length,1);
 assert.equal(created[0].className,'kp-popup kp-popup-success');
 assert.equal(created[0].children[1].children[0].textContent,'บันทึกสำเร็จ');
 assert.equal(created[0].attributes.role,'status');
 assert.equal(created[0].children[1].children[1].textContent,'บันทึกฉบับร่างเรียบร้อย');
 assert.equal(state.flash,'บันทึกฉบับร่างเรียบร้อย');
 state.flash='';
 await Promise.resolve();
 assert.equal(created.length,1);
 state.error='บันทึกไม่สำเร็จ';
 await Promise.resolve();
 assert.equal(created.length,2);
 assert.equal(created[1].className,'kp-popup kp-popup-error');
 assert.equal(created[1].attributes.role,'alert');
 assert.equal(created[0].isConnected,false);
 created[1].children[2].click();
 assert.equal(created[1].isConnected,false);
 view.clear();
});
test('popup is shipped to both deployments with no need to edit individual save flows',async()=>{
 const {readFileSync}=await import('node:fs');
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 const build=readFileSync(new URL('./build.mjs',import.meta.url),'utf8');
 const page=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 const popup=readFileSync(new URL('./notification-popup.js',import.meta.url),'utf8');
 assert.match(app,/import \{installStateNotices\} from '\.\/notification-popup\.js'/);
 assert.match(app,/installStateNotices\(state\)/);
 assert.match(build,/notification-popup\.css/);
 assert.match(page,/notification-popup\.css\?v=/);
 assert.match(popup,/Object\.defineProperty\(state,key/);
 assert.match(popup,/queueMicrotask/);
 assert.match(popup,/doc\.body\.appendChild\(notice\)/);
});


test('Word-like preview preserves native A4 title and legal paragraph layout',async()=>{
 const {readFileSync}=await import('node:fs');
 const css=readFileSync(new URL('./template-builder.css',import.meta.url),'utf8');
 const js=readFileSync(new URL('./template-builder.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 const generic=css.match(/#te-print-preview \.te-inline-edit\s*\{([^}]*)\}/)?.[1]||'';
 assert.ok(generic,'Word editing CSS must be present');
 assert.doesNotMatch(generic,/display\s*:\s*inline/,'editor must not force A4 heading or paragraph inline');
 assert.match(css,/#te-print-preview span\.te-inline-edit\s*\{[^}]*display\s*:\s*inline/);
 assert.match(css,/#te-print-preview \[data-template-header\]\.te-inline-edit\s*\{[^}]*display\s*:\s*block/);
 assert.match(js,/el\.dataset\.templateHeader=field/);
 assert.match(html,/template-builder\.css\?v=20261021-a4-preview-block-fix-v2/);
});

test('director decision is on separate lines and school can override only its wording',async()=>{
 const {safeTemplateDraft,emptyTemplate}=await import('./template-builder.js');
 const {readFileSync}=await import('node:fs');
 const page=buildDocuments(sample,school);
 assert.match(page,/<div class="director-action">เห็นชอบ<br>อนุมัติ<\/div>/);
 assert.equal(safeTemplateDraft({decisionText:'เห็นชอบ\nอนุมัติ'}).decisionText,'เห็นชอบ\nอนุมัติ');
 assert.equal(emptyTemplate().decisionText,'');
 assert.equal(safeTemplateDraft({decisionText:'<img src=x onerror=alert(1)>'}).decisionText,'<img src=x onerror=alert(1)>');
 const source=readFileSync(new URL('./template-builder.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('./template-builder.css',import.meta.url),'utf8');
 const gov=readFileSync(new URL('./government-forms.css',import.meta.url),'utf8');
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 assert.match(source,/decision\.textContent=t\.decisionText/,'must use safe textContent rather than HTML');
 assert.match(source,/directorDecision\.dataset\.templateHeader='decisionText'/);
 assert.match(source,/data-tpl-field="decisionText"/);
 assert.match(source,/type==='decisionText'\?/);
 assert.match(css,/\[data-template-header="decisionText"\]\.te-inline-edit/);
 assert.match(gov,/\.director-action\{white-space:pre-line\}/);
 assert.match(app,/data-template-header="decisionText"/);
});
