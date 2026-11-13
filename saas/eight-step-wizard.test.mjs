import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {docMetaWizardInputs,docMetaInputs,docMetaValue} from './document-meta.js';

const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('./brand-theme.css',import.meta.url),'utf8');
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');

test('eight labelled steps show separate purchase, dates, receipt, finance and review',()=>{
 for(const n of [1,2,3,4,5,6,7,8])assert.match(app,new RegExp("panel\\("+n+",'ขั้นที่ "+n));
 assert.match(app,/Math\.min\(8,Math\.max\(1,Number\(state\.wizardStep\)\|\|1\)\)/);
 assert.match(app,/Math\.max\(1,Math\.min\(8,step\+delta\)\)/);
 assert.match(app,/const labels=\['ข้อมูลหลัก','รายการพัสดุ','ผู้ขาย \/ ผู้ตรวจรับ','ใบสั่งซื้อ \/ จ้าง','วันที่และเลขเอกสาร','ส่งมอบ \/ ตรวจรับ','การเงิน','ตรวจทาน \/ บันทึก'\]/);
 assert.match(app,/data-wizard-indicator/);
 assert.match(app,/data-action="wizard-jump"/);
 assert.match(app,/class="kp-wizard-progress">ขั้น '\+step\+' จาก 8/);
});
test('existing saved data and optional inputs never duplicate across the new forms',()=>{
 for(const kind of ['purchase','hire']){
  const only=[docMetaWizardInputs({},3,kind),docMetaInputs({},{mode:'create',kind}),docMetaWizardInputs({},5,kind),docMetaWizardInputs({},6,kind),docMetaWizardInputs({},7,kind)].join('');
  assert.match(docMetaWizardInputs({},5,kind),/name="doc_sign_request_date"/);
  assert.match(docMetaWizardInputs({},6,kind),/name="doc_delivery_date"/);
  assert.match(docMetaWizardInputs({},7,kind),/name="doc_withholding_baht"/);
  assert.doesNotMatch(docMetaWizardInputs({},5,kind),/name="doc_delivery_date"/);
  assert.doesNotMatch(docMetaWizardInputs({},6,kind),/name="doc_withholding_baht"/);
  assert.doesNotMatch(docMetaWizardInputs({},7,kind),/name="doc_order_date"/);
  const names=[...only.matchAll(/name="(doc_[^"]+)"/g)].map(x=>x[1]);
  assert.equal(names.length,new Set(names).size,'each document field occurs exactly once in the actual eight-stage form');
  const data=docMetaValue({doc_delivery_date:'2026-11-10',doc_withholding_baht:'25.00'});
  assert.equal(data.delivery_date,'2026-11-10');
  assert.equal(data.withholding_baht,'25.00');
 }
});
test('not-yet-existing evidence remains blank and all optional steps can be skipped',()=>{
 for(const step of [4,5,6,7]){
  assert.match(app,new RegExp("panel\\("+step+",'ขั้นที่ "+step));
 }
 assert.match(docMetaWizardInputs({},6,'hire'),/name="doc_delivery_date" type="date"[^>]*value=""/);
 assert.match(docMetaWizardInputs({},7,'hire'),/name="doc_withholding_baht" type="number"[^>]*value=""/);
 assert.match(app,/ยังไม่มีข้อมูล — ข้ามขั้นนี้/);
 assert.match(app,/step>=3&&step<=7/);
 assert.match(app,/function wizardPhaseStatus\(/);
 assert.match(app,/function updateWizardNavProgress\(/);
 assert.match(app,/if\(action==='wizard-jump'\)/);
 assert.match(app,/collectDraft\(\);state\.wizardStep=target;form\(\)/);
});
test('final review and original metadata save path remain intact with 8 steps',()=>{
 assert.match(app,/const review=panel\(8/);
 assert.match(app,/id="wizard-review"/);
 assert.match(app,/const docMeta=docMetaValue\(d,editing\?original\?\.document_meta\|\|\{\}:\{\}\)/);
 assert.match(app,/p_meta:docMeta/);
 assert.match(app,/if\(form\.id==='doc-meta-form'\)/);
 assert.match(app,/ข้อมูลเอกสาร \/ ตรวจรับ \/ เบิกจ่าย/);
 assert.match(app,/document\.getElementById\('procurement-form'\)/);
});
test('eight-stage CSS and cache versions are present for desktop and mobile',()=>{
 assert.match(css,/\.kp-wizard-nav-eight/);
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(html,/brand-theme\.css\?v=20261113-eight-step-wizard-v1/);
 assert.match(html,/app\.js\?v=20261113-eight-step-wizard-v1/);
});
