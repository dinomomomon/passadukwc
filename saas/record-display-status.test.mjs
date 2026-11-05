import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isCompleteSavedProcurement,procurementDisplayStatus} from './record-display-status.js';

const sample=()=>({
 id:'example',state:'draft',kind:'purchase',title:'ซื้ออุปกรณ์สำหรับห้องเรียน',
 budget_source:'โครงการพัฒนาการเรียนรู้',document_date:'2026-10-01',
 document_number:2,fiscal_year:2570,total_satang:1080000,deleted_at:null,
 items:[{name:'แกรบทำหยาบ',qty:120,unit:'ถุง',price_satang:9000}],
 vendor_name:'',reason:'',department:''
});

test('a previously saved complete draft becomes green บันทึกเรียบร้อย without database transition',()=>{
 const original=sample(),snapshot=structuredClone(original);
 assert.equal(isCompleteSavedProcurement(original),true);
 assert.deepEqual(procurementDisplayStatus(original),{label:'บันทึกเรียบร้อย',className:'kp-saved-complete'});
 assert.deepEqual(original,snapshot,'presentation must not mutate source row');
 assert.equal(original.state,'draft','underlying editable state must not change');
});
test('newly saved hire or purchase is saved-complete even without optional vendor or inspector fields',()=>{
 for(const kind of ['purchase','hire']){
  const row={...sample(),kind,items:[{name:'งานตัวอย่าง',qty:'1',unit:'งาน',price_satang:'1080000'}]};
  assert.equal(procurementDisplayStatus(row).label,'บันทึกเรียบร้อย');
 }
});
test('incomplete, unsafe or empty rows retain their editable draft label',()=>{
 const invalid=[
  {title:' '},{budget_source:''},{document_date:null},{document_number:0},
  {fiscal_year:null},{total_satang:0},{items:[]},{items:[{name:'',qty:1,unit:'รีม',price_satang:100}]},
  {items:[{name:'กระดาษ',qty:1,unit:'',price_satang:100}]},
  {items:[{name:'กระดาษ',qty:0,unit:'รีม',price_satang:100}]},
  {items:[{name:'กระดาษ',qty:1,unit:'รีม',price_satang:0}]},
  {items:[{name:'กระดาษ',qty:1,unit:'รีม',price_satang:'oops'}]},
  {kind:'unknown'}, {items:null}
 ];
 for(const patch of invalid){
  const row={...sample(),...patch};
  assert.equal(isCompleteSavedProcurement(row),false,JSON.stringify(patch));
  assert.equal(procurementDisplayStatus(row).label,'ฉบับร่าง',JSON.stringify(patch));
 }
});
test('approval and inspection statuses remain distinct; deleted records are never saved complete',()=>{
 assert.equal(isCompleteSavedProcurement({...sample(),deleted_at:'2026-10-22T01:00:00Z'}),false);
 for(const [state,label] of Object.entries({
  review:'รอตรวจสอบ',approved:'อนุมัติแล้ว',
  received:'ตรวจรับแล้ว',completed:'เสร็จสิ้น',cancelled:'ยกเลิก'
 })){
  const row={...sample(),state};
  assert.equal(isCompleteSavedProcurement(row),false);
  assert.equal(procurementDisplayStatus(row).label,label);
 }
});
test('table, dashboard and detail use one status presenter but draft-only edit/delete is preserved',()=>{
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('./brand-theme.css',import.meta.url),'utf8');
 assert.match(app,/import \{procurementDisplayStatus\} from '\.\/record-display-status\.js'/);
 assert.match(app,/const badge=r=>\{const status=procurementDisplayStatus\(r\)/);
 assert.match(app,/recordTable\(rows/);
 assert.match(app,/recordTable\(rows\.slice\(0,6\)\)/);
 assert.match(app,/\+badge\(r\)\+'/);
 assert.match(app,/heading\(e\(r\.title\)\+' <span class="kp-detail-status">'\+badge\(r\)/);
 assert.match(app,/const canEditMainRecord=r=>!!r&&r\.state==='draft'/);
 assert.match(app,/const canDeleteMainRecord=r=>canEditMainRecord\(r\)/);
 for(const action of ["'open'","'open-edit'","'delete-record'","'edit-record'"])
  assert.ok(app.includes(action),'Expected action '+action);
 assert.match(app,/db\.rpc\('delete_procurement_draft'/);
 assert.match(app,/p_expected_updated_at:rec\.updated_at/);
 assert.match(app,/ยืนยันลบรายการนี้\?/);
 assert.match(app,/ไม่มีเลขเอกสารที่ใช้จริง/);
 assert.match(css,/\.tag\.kp-saved-complete/);
 assert.match(css,/\.kp-detail-status/);
});
