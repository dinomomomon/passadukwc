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
 assert.deepEqual(docMetaValue({doc_memo_number:' 1/2570 ',doc_vat_baht:'0'}),{memo_number:'1/2570',vat_baht:'0'});
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
 assert.match(html,/class="gov-director-position">ผู้อำนวยการโรงเรียนกาวิละวิทยาลัย/);
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
 assert.deepEqual(docMetaValue({doc_memo_number:'',doc_delivery_date:'2026-10-25'},old),{invoice_number:'INV-5',budget_year:'2570',vat_baht:'0',inspection_location:'ห้องพัสดุ',delivery_date:'2026-10-25'});
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
 assert.match(html,/class="gov-director-position">ผู้อำนวยการโรงเรียนกาวิละวิทยาลัย/);
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
 assert.equal(saved.memo_number,'6/2569');
});
test('duplicated reference sequences in one input are rejected instead of silently saved',()=>{
 assert.throws(()=>docMetaValue({doc_memo_number:'พว. 1/2569 2/2569'}),/หลายเลข/);
 assert.throws(()=>docMetaValue({doc_memo_number:'พว.'}),/2\/2569/);
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
 assert.equal(saved.requisition_number,'จ. 219/2569');
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
test('payment director approval is moved upward without affecting other forms',async()=>{
 const {readFileSync}=await import('node:fs');
 const css=readFileSync(new URL('./government-forms.css',import.meta.url),'utf8');
 assert.match(css,/\.gov-payment \.memo-signatures\{\s*margin-top:0!important/);
 assert.match(css,/\.gov-payment \.gov-payment-director\{\s*margin-top:0!important/);
 assert.match(css,/\.gov-payment \.gov-payment-decision\{\s*position:relative!important;\s*top:-14mm!important/);
 assert.match(css,/@media print\{[\s\S]*?\.gov-payment \.gov-payment-decision\{\s*position:relative!important;\s*top:-14mm!important/);
});
