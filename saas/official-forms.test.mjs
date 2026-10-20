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
 for(const expected of ['บันทึกข้อความ','รายงานขอซื้อพัสดุ','รายละเอียดของพัสดุที่จะซื้อ','รายงานผลการพิจารณา','ใบตรวจรับพัสดุ','ทราบผลและขออนุมัติเบิกจ่าย','ข้อ 175','ข้อ 204','ข้อ 205','ลงนามแล้ว','ผู้มอบ','ผู้รับของ','เลขที่ใบสั่งซื้อ','พว. 25/2569','เห็นชอบในรายงานขอซื้อ','เป็นผู้ตรวจรับพัสดุ']){
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
