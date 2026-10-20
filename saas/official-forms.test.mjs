import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDocuments, thaiBahtText } from './print.js';
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
 assert.equal(documentInfoFields.length,32);
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
 assert.match(html,/ใบตรวจรับ เลขที่ ร\. ........\.\.\/2569/);
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
