import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {docMetaWizardInputs,docMetaInputs,docMetaValue} from './document-meta.js';

const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('./brand-theme.css',import.meta.url),'utf8');

test('step 3 order information is always visible even with no previous evidence',()=>{
 for(const kind of ['purchase','hire']){
  const html=docMetaWizardInputs({},3,kind);
  assert.match(html,/class="kp-wizard-evidence kp-evidence-visible" data-evidence-group="order"/);
  assert.doesNotMatch(html,/<details[^>]*data-evidence-group="order"/);
  assert.match(html,/data-evidence-count/);
  assert.match(html,/ยังไม่มีข้อมูล • กรอกภายหลังได้/);
  assert.match(html,/name="doc_order_number"/);
  assert.match(html,/name="doc_order_vendor_tax_id"/);
  assert.match(html,/name="doc_order_bank_account_number"/);
 }
});
test('step 4 delivery and finance fields require no extra click',()=>{
 for(const kind of ['purchase','hire']){
  const html=docMetaWizardInputs({},4,kind);
  for(const group of ['delivery','finance']){
   assert.match(html,new RegExp('class="kp-wizard-evidence kp-evidence-visible" data-evidence-group="'+group+'"'));
   assert.doesNotMatch(html,new RegExp('<details[^>]*data-evidence-group="'+group+'"'));
  }
  assert.match(html,/name="doc_delivery_date"/);
  assert.match(html,/name="doc_invoice_number"/);
  assert.match(html,/name="doc_withholding_baht"/);
  assert.match(html,/name="doc_budget_paid_baht"/);
 }
});
test('saved progress is displayed while missing real evidence remains blank',()=>{
 const blank=docMetaWizardInputs({},4,'purchase');
 assert.match(blank,/name="doc_delivery_date" type="date"[^>]*value=""/);
 assert.match(blank,/name="doc_invoice_number" type="text"[^>]*value=""/);
 const saved=docMetaWizardInputs({delivery_date:'2026-11-10',invoice_number:'A-127'},4,'purchase');
 assert.match(saved,/บันทึกข้อมูลแล้ว 2 ช่อง/);
 assert.match(saved,/name="doc_delivery_date" type="date"[^>]*value="2026-11-10"/);
 const cleaned=docMetaValue({doc_delivery_date:''},{});
 assert.ok(!cleaned.delivery_date);
});
test('the saved-document editor displays order delivery finance and requisition groups by default',()=>{
 const html=docMetaInputs({}, {kind:'purchase'});
 assert.match(html,/class="doc-meta-section kp-document-main-section"/);
 assert.doesNotMatch(html,/<details class="doc-meta-section"/);
 assert.match(html,/1\. เอกสารสั่งซื้อ \/ สั่งจ้าง/);
 assert.match(html,/2\. ส่งมอบและตรวจรับ/);
 assert.match(html,/3\. ข้อมูลเบิกจ่าย/);
 assert.match(html,/4\. ใบเบิกพัสดุ/);
});
test('wizard has live progress, a document completeness checklist, and editable later fields',()=>{
 assert.match(app,/function updateEvidenceProgress\(\)/);
 assert.match(app,/ความพร้อมข้อมูลประกอบเอกสาร/);
 assert.match(app,/ยังไม่มีเลขที่ใบสั่ง/);
 assert.match(app,/ยังไม่มีวันส่งมอบจริง/);
 assert.match(app,/เติมภายหลัง/);
 assert.match(app,/updateWizardReview\(\);updateEvidenceProgress\(\)/);
 assert.match(css,/\.kp-evidence-visible/);
 assert.match(css,/\.kp-evidence-checklist/);
});
