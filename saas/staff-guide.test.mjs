import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {staffGuideTopics,staffGuideIds,staffGuideHtml} from './staff-guide.js';
const read=name=>readFileSync(new URL('./'+name,import.meta.url),'utf8');

test('user manual has exactly three requested topics in the requested order',()=>{
 assert.deepEqual(staffGuideIds,['create','records','registry']);
 assert.deepEqual(staffGuideTopics.map(t=>t.title),[
  'การสร้างรายการใหม่','ทะเบียนจัดซื้อจัดจ้าง','ทะเบียนคุมเลขเอกสาร'
 ]);
 assert.equal(staffGuideTopics.length,3);
 for(let i=0;i<staffGuideTopics.length;i++){
  const topic=staffGuideTopics[i],html=staffGuideHtml(topic.id);
  assert.match(html,new RegExp('data-action="user-guide-section" data-section="'+topic.id+'"'));
  assert.match(html,new RegExp('data-action="user-guide-open" data-target="'+topic.action+'"'));
  assert.match(html,new RegExp('0'+(i+1)+' / 03'));
  assert.equal((html.match(/data-action="user-guide-section"/g)||[]).length,4);
  assert.doesNotMatch(html,/<form|data:image|fake screenshot|บันทึกสำเร็จ/i);
 }
 assert.match(staffGuideHtml('missing'),/การสร้างรายการใหม่/);
});

test('step 1–4 infographics appear only under creation guide, with full-size links',()=>{
 const create=staffGuideHtml('create'),records=staffGuideHtml('records'),registry=staffGuideHtml('registry');
 for(const [filename,step] of [['staff-guide-create-1.svg','1'],['staff-guide-create-2.svg','3']]){
  assert.match(create,new RegExp('href="/'+filename+'"'));
  assert.match(create,new RegExp('src="/'+filename+'"'));
  assert.match(create,/target="_blank"/);
  const svg=read(filename);
  assert.match(svg,/viewBox="0 0 1500 1290"/);
  assert.match(svg,new RegExp('ขั้นที่ '+step));
  assert.match(svg,/KRU PASADU/);
  assert.doesNotMatch(svg,/<script|onload=|javascript:/i);
  assert.ok(svg.endsWith('</svg>'));
 }
 assert.equal((create.match(/class="kp-ug-figure"/g)||[]).length,2);
 assert.match(create,/width="1500" height="1290"/);
 assert.doesNotMatch(create,/ขณะนี้ยังไม่มีภาพประกอบ/);
 assert.doesNotMatch(records,/staff-guide-create/);
 assert.match(records,/staff-guide-records-1\.svg/);
 assert.match(records,/staff-guide-records-2\.svg/);
 assert.doesNotMatch(registry,/staff-guide-create/);
 assert.match(registry,/staff-guide-registry\.svg/);
});
test('records guide publishes two full-width Thai infographics with independent enlargement links',()=>{
 const records=staffGuideHtml('records');
 const creation=staffGuideHtml('create');
 const other=staffGuideHtml('registry');
 const assetNames=['staff-guide-records-1.svg','staff-guide-records-2.svg'];
 for(const name of assetNames){
  assert.match(records,new RegExp('href="/'+name+'"'));
  assert.match(records,new RegExp('src="/'+name+'"'));
  const svg=read(name);
  assert.match(svg,/viewBox="0 0 1540 1290"/);
  assert.match(svg,/ทะเบียนจัดซื้อจัดจ้าง/);
  assert.match(svg,/KRU PASADU/);
  assert.ok(svg.endsWith('</svg>'));
  assert.doesNotMatch(svg,/<script|onload=|javascript:|โรงเรียนกาวิละวิทยาลัย/i);
  assert.doesNotMatch(creation,new RegExp(name));
  assert.doesNotMatch(other,new RegExp(name));
 }
 assert.equal((records.match(/class="kp-ug-figure"/g)||[]).length,2);
 assert.equal((records.match(/target="_blank"/g)||[]).length>=2,true);
 assert.match(records,/width="1540" height="1290"/);
 assert.doesNotMatch(records,/ขณะนี้ยังไม่มีภาพประกอบ/);
 assert.match(other,/staff-guide-registry\.svg/);
 assert.match(read('build.mjs'),/staff-guide-records-1\.svg/);
 assert.match(read('build.mjs'),/staff-guide-records-2\.svg/);
});
test('number registry manual has accurate seven-step infographic and safe full-size link',()=>{
 const registry=staffGuideHtml('registry'),create=staffGuideHtml('create'),records=staffGuideHtml('records');
 assert.match(registry,/href="\/staff-guide-registry\.svg"/);
 assert.match(registry,/src="\/staff-guide-registry\.svg"/);
 assert.match(registry,/width="1540" height="1320"/);
 assert.equal((registry.match(/class="kp-ug-figure"/g)||[]).length,1);
 assert.match(registry,/target="_blank"/);
 assert.match(registry,/rel="noopener noreferrer"/);
 assert.doesNotMatch(create,/staff-guide-registry\.svg/);
 assert.doesNotMatch(records,/staff-guide-registry\.svg/);
 assert.doesNotMatch(registry,/ขณะนี้ยังไม่มีภาพประกอบ/);
 const svg=read('staff-guide-registry.svg'),app=read('app.js');
 assert.match(svg,/viewBox="0 0 1540 1320"/);
 assert.match(svg,/ทะเบียนคุมเลขเอกสาร/);
 for(const label of ['เลขทั้งหมด','ใช้แล้ว','จองเลข','ต้องตรวจสอบ','ทุกประเภท','ทุกปี','ทุกสถานะ','วันที่ลงทะเบียน','เปิดรายการ','รีเฟรช']){
  assert.ok(svg.includes(label),'SVG label: '+label);
  assert.ok(app.includes(label),'Actual registry code label: '+label);
 }
 assert.match(svg,/โรงเรียนตัวอย่าง/);
 assert.doesNotMatch(svg,/<script|onload=|javascript:|โรงเรียนกาวิละวิทยาลัย/i);
 assert.ok(svg.endsWith('</svg>'));
 assert.match(read('build.mjs'),/staff-guide-registry\.svg/);
});
test('guide is available through regular and mobile navigation to every school role, including demo',()=>{
 const app=read('app.js');
 assert.match(app,/function groupedNavHtml\(\)/);
 assert.match(app,/visibleSidebarGroups\(opts\)/);
 assert.match(app,/kp-bottom-navigation/);
 assert.match(app,/data-action="nav-mobile"/);
 assert.match(app,/if\(state\.page==='user-guide'\)return renderStaffGuide\(\)/);
 assert.match(app,/if\(action==='user-guide'\)/);
 assert.match(app,/if\(action==='user-guide-section'\)/);
 assert.match(app,/if\(action==='user-guide-open'\)/);
 assert.doesNotMatch(app.slice(app.indexOf("if(action==='user-guide'){"),app.indexOf("if(action==='admin-guide'){")) ,/isSchoolAdmin\(\)/);
 assert.match(app,/if\(!state\.user&&!state\.demo\)return;/);
});

test('owner and users waiting for school access can read guide, without school access bypass',()=>{
 const app=read('app.js');
 assert.match(app,/data-action="user-guide"[^>]*>.*คู่มือผู้ใช้งาน/);
 assert.match(app,/btn\('คู่มือผู้ใช้งาน','user-guide','secondary'\)/);
 assert.match(app,/renderUniversalUserGuide\(\)/);
 assert.match(app,/staffGuideHtml\(selected,\{canOpenMenu:false\}\)/);
 assert.match(app,/if\(!state\.school&&!state\.demo\)return notify\('ต้องได้รับสิทธิ์เข้าถึงโรงเรียนก่อนเปิดเมนูทำงาน'/);
 assert.doesNotMatch(staffGuideHtml('records',{canOpenMenu:false}),/data-action="user-guide-open"/);
 assert.match(staffGuideHtml('records',{canOpenMenu:false}),/ทะเบียนจัดซื้อจัดจ้าง/);
});

test('existing admin-only manual and purchase/number registries are untouched',()=>{
 const app=read('app.js');
 assert.match(app,/if\(action==='admin-guide'\)\{\s*if\(!isSchoolAdmin\(\)\)/);
 assert.match(app,/if\(state\.page==='admin-guide'\)return renderAdminGuide\(\)/);
 for(const method of ['create_procurement','set_procurement_document_meta','loadOfficialNumbers','manage_official_number']){
  assert.ok(app.includes(method),method+' must still be present');
 }
 assert.match(app,/function renderStaffGuide\(\)/);
 assert.match(app,/function renderUniversalUserGuide\(\)/);
});

test('both production hosts bundle user manual from the same assets and styles',()=>{
 const pkg=JSON.parse(read('package.json')),index=read('index.html'),css=read('admin-guide.css');
 assert.match(pkg.scripts.build,/staff-guide\.test\.mjs/);
 assert.match(index,/admin-guide\.css\?v=20261023-staff-guide-v2/);
 assert.match(index,/app\.js\?v=20261024-equipment-auto-v2/);
 assert.match(css,/\.kp-ug-pending/);
 assert.match(read('build.mjs'),/bundle:true/);
 assert.match(read('build.mjs'),/staff-guide-create-1\.svg/);
 assert.match(read('build.mjs'),/staff-guide-create-2\.svg/);
 assert.match(css,/\.kp-ug-figure img/);
});
