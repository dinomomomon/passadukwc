import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {schoolOfficerSigners,activeOfficerSigners,selectedOfficerSigner,validateOfficerSigners,MAX_OFFICER_SIGNERS} from './officer-signers.js';
import {buildDocuments} from './print.js';
const read=name=>readFileSync(new URL('./'+name,import.meta.url),'utf8');
const legacy={officer_name:'นายหนึ่ง ตัวอย่าง',head_name:'หัวหน้าตัวอย่าง',director_name:'ผู้อำนวยการตัวอย่าง'};
test('existing one-officer schools auto-select legacy signer without requiring configuration changes',()=>{
 assert.deepEqual(activeOfficerSigners(legacy),[{name:'นายหนึ่ง ตัวอย่าง',active:true,is_default:true}]);
 assert.equal(selectedOfficerSigner(legacy),'นายหนึ่ง ตัวอย่าง');
 assert.equal(selectedOfficerSigner({}),'');
});
test('one active signer is selected even if list has disabled staff',()=>{
 const school={officer_name:'คนเก่า',officer_signers:[
  {name:'เจ้าหน้าที่เก่า',active:false,is_default:false},
  {name:'เจ้าหน้าที่ใหม่',active:true,is_default:true}
 ]};
 assert.deepEqual(activeOfficerSigners(school).map(x=>x.name),['เจ้าหน้าที่ใหม่']);
 assert.equal(selectedOfficerSigner(school),'เจ้าหน้าที่ใหม่');
});
test('multiple officers honor explicit preference, then default, then first active',()=>{
 const school={officer_signers:validateOfficerSigners([
  {name:'เจ้าหน้าที่หนึ่ง',active:true,is_default:true},
  {name:'เจ้าหน้าที่สอง',active:true},
  {name:'เจ้าหน้าที่สาม',active:false}
 ])};
 assert.equal(selectedOfficerSigner(school),'เจ้าหน้าที่หนึ่ง');
 assert.equal(selectedOfficerSigner(school,'เจ้าหน้าที่สอง'),'เจ้าหน้าที่สอง');
 assert.equal(selectedOfficerSigner(school,'เจ้าหน้าที่สาม'),'เจ้าหน้าที่หนึ่ง');
 assert.equal(selectedOfficerSigner(school,'ไม่มีชื่อ'),'เจ้าหน้าที่หนึ่ง');
});
test('roster enforces active signer and unique default, supports 30 maximum',()=>{
 for(const invalid of [
  [],[{name:'คนเดียว',active:false}],
  [{name:'คนหนึ่ง',active:true,is_default:true},{name:'คนสอง',active:true,is_default:true}],
  [{name:'คนหนึ่ง',active:false,is_default:true},{name:'คนสอง',active:true}],
  [{name:'คนซ้ำ',active:true},{name:'คนซ้ำ',active:true}],
  Array.from({length:MAX_OFFICER_SIGNERS+1},(_,i)=>({name:'คน'+i,active:true}))
 ])assert.throws(()=>validateOfficerSigners(invalid));
 const v=validateOfficerSigners([{name:' คนเดียว  ตัวอย่าง ',active:true}]);
 assert.equal(v[0].name,'คนเดียว ตัวอย่าง');
 assert.equal(v[0].is_default,true);
});
test('school admin edits only roster; user wizard hides picker for one signer and shows it for several',()=>{
 const app=read('app.js');
 assert.match(app,/function officerSignerSettingsMarkup\(\)/);
 assert.match(app,/id="school-officers-form"/);
 assert.match(app,/if\(form\.id==='school-officers-form'\)/);
 assert.match(app,/if\(!isAdmin\(\)\)return notify\('เฉพาะแอดมินโรงเรียนเท่านั้น'/);
 assert.match(app,/officer_signers:signers,officer_name:initial\.name/);
 assert.match(app,/activeOfficers\.length>1/);
 assert.match(app,/activeOfficers\.length===1/);
 assert.match(app,/type="hidden" name="officer_signer"/);
 assert.match(app,/name="officer_signer" required/);
 assert.match(app,/เลือกให้อัตโนมัติ ไม่ต้องกดเลือก/);
 assert.match(app,/state\.lastOfficerSigner=officerName/);
 assert.match(app,/const existingOfficer=editing\?/);
});
test('create procedure writes selected officer snapshot transactionally, preserving current counters',()=>{
 const app=read('app.js');
 const sql=read('../supabase/migrations/20261023070308_school_procurement_officer_signers_auto_select_20261023.sql');
 assert.match(app,/p_officer_name:officerName/);
 assert.match(app,/db\.rpc\('create_procurement_with_officer',payload\)/);
 assert.match(sql,/public\.create_procurement\(/);
 assert.match(sql,/jsonb_set\(coalesce\(signers,'\{\}'::jsonb\),'\{officer\}'/);
 assert.match(sql,/revoke all on function public\.create_procurement_with_officer/);
 assert.match(sql,/to authenticated/);
 assert.doesNotMatch(sql,/update public\.official_number_registry|update public\.document_counters/i);
});
test('issued report uses immutable record signer, not newly configured school default',()=>{
 const row={kind:'purchase',title:'ซื้อวัสดุสำนักงาน',reason:'จำเป็นสำหรับงานโรงเรียน',department:'กลุ่มงาน',budget_source:'งบโรงเรียน',
  document_number:1,fiscal_year:2570,document_date:'2026-10-23',vendor_name:'ร้านตัวอย่าง',total_satang:20000,
  items:[{name:'ปากกา',qty:1,unit:'ด้าม',price_satang:20000}],signers:{officer:'เจ้าหน้าที่เดิมเฉพาะฉบับ',head:'หัวหน้าตัวอย่าง',director:'ผู้อำนวยการตัวอย่าง'},document_meta:{}};
 const html=buildDocuments(row,{...legacy,officer_name:'เจ้าหน้าที่ปัจจุบัน'});
 assert.match(html,/เจ้าหน้าที่เดิมเฉพาะฉบับ/);
 assert.doesNotMatch(html,/เจ้าหน้าที่ปัจจุบัน/);
});
test('bundle and UI cache cover new officer roster module',()=>{
 const pkg=JSON.parse(read('package.json')),index=read('index.html'),css=read('brand-theme.css');
 assert.match(pkg.scripts.build,/officer-signers\.test\.mjs/);
 assert.match(index,/app\.js\?v=20261024-equipment-auto-v2/);
 assert.match(index,/brand-theme\.css\?v=20261024-equipment-auto-v2/);
 assert.match(css,/\.kp-officer-row/);
 assert.match(read('app.js'),/from '\.\/officer-signers\.js'/);
});
