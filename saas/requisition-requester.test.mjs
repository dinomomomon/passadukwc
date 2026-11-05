import test from 'node:test';
import assert from 'node:assert/strict';
import {docMetaWizardInputs,docMetaInputs,docMetaValue} from './document-meta.js';
import {buildDocuments} from './print.js';

const school={name:'โรงเรียนกาวิละวิทยาลัย',officer_name:'เจ้าหน้าที่พัสดุ',head_name:'หัวหน้าพัสดุ',director_name:'ผู้อำนวยการ'};
const r={kind:'purchase',document_date:'2026-10-28',fiscal_year:2570,title:'จัดซื้อวัสดุ',reason:'ใช้งานในโรงเรียน',
 vendor_name:'ผู้ขาย',inspector_name:'ผู้ตรวจรับ',items:[{name:'ทรายหยาบ',qty:4,unit:'คิว',price_satang:320000}],
 total_satang:1280000,document_meta:{}};
const requisition=record=>{
 const html=buildDocuments(record,school);
 return html.match(/<section class="paper-page official gov-doc gov-requisition">([\s\S]*?)<\/section>/)?.[1]||'';
};

test('purchase wizard step 3 visibly asks for requester name and optional position',()=>{
 const form=docMetaWizardInputs({},3,'purchase');
 assert.match(form,/ข้อมูลผู้เบิกพัสดุ \(สำหรับใบเบิกพัสดุ\)/);
 assert.match(form,/ชื่อผู้เบิกพัสดุ/);
 assert.match(form,/ตำแหน่งผู้เบิก \(ถ้ามี\)/);
 assert.equal(form.split('name="doc_requester_name"').length-1,1);
 assert.equal(form.split('name="doc_requester_position"').length-1,1);
 const visible=form.indexOf('class="kp-requisition-requester"');
 const optionalOrder=form.indexOf('data-evidence-group="order"');
 assert.ok(visible!==-1&&optionalOrder>visible,'requester is visible before collapsed order evidence');
});

test('hire wizard does not ask for a purchasing-only requisition requester',()=>{
 const form=docMetaWizardInputs({},3,'hire');
 assert.doesNotMatch(form,/name="doc_requester_name"/);
 assert.doesNotMatch(form,/name="doc_requester_position"/);
});

test('saved requester fields are shown on edit and document metadata page',()=>{
 const saved={requester_name:'นางสาวผู้เบิกตัวอย่าง',requester_position:'ครู',sign_requisition_date:'2026-10-28'};
 const editWizard=docMetaWizardInputs(saved,3,'purchase');
 assert.match(editWizard,/name="doc_requester_name" type="text"[^>]*value="นางสาวผู้เบิกตัวอย่าง"/);
 assert.match(editWizard,/name="doc_requester_position" type="text"[^>]*value="ครู"/);
 const metadataEditor=docMetaInputs(saved,{kind:'purchase'});
 assert.match(metadataEditor,/name="doc_requester_name"[^>]*value="นางสาวผู้เบิกตัวอย่าง"/);
 assert.equal(docMetaValue({doc_requester_name:'นางสาวผู้เบิกใหม่',doc_requester_position:'เจ้าหน้าที่'},saved).requester_name,'นางสาวผู้เบิกใหม่');
 assert.equal(docMetaValue({doc_requester_name:''},saved).requester_name,undefined);
});

test('requester entered in wizard prints under the requisition signature, separate from other officials',()=>{
 const metadata=docMetaValue({doc_requester_name:'นางสาวผู้เบิกตัวอย่าง',doc_requester_position:'ครู'});
 const output=requisition({...r,document_meta:metadata});
 assert.match(output,/signature-name">\(นางสาวผู้เบิกตัวอย่าง\)<\/div>/);
 assert.match(output,/signature-role[^"]*">ผู้เบิก<\/div>/);
 assert.match(output,/ครู/);
 const empty=requisition(r);
 assert.doesNotMatch(empty,/signature-name">\(เจ้าหน้าที่พัสดุ\)<\/div>[\s\S]*?ผู้เบิก/,'never assign official as requester by default');
});

test('requester value is escaped and cannot inject markup into official PDF print',()=>{
 const metadata=docMetaValue({doc_requester_name:'ผู้เบิก <script>alert(1)</script>'});
 const output=requisition({...r,document_meta:metadata});
 assert.doesNotMatch(output,/<script>/);
 assert.match(output,/&lt;script&gt;/);
});
