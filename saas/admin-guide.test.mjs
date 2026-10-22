import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {adminGuideTopics,adminGuideIds,adminGuideHtml} from './admin-guide.js';

test('school admin guide has five private subtopics and twenty accessible illustrated steps',()=>{
 assert.deepEqual(adminGuideIds,['school','signers','numbers','templates','users']);
 assert.equal(adminGuideTopics.length,5);
 assert.equal(adminGuideTopics.reduce((sum,t)=>sum+t.steps.length,0),20);
 assert.equal(new Set(adminGuideIds).size,5);
 const overview=adminGuideHtml('overview');
 assert.equal((overview.match(/class="kp-ag-topic-card"/g)||[]).length,5);
 assert.match(overview,/คู่มือแอดมิน/);
 for(const topic of adminGuideTopics){
  assert.equal(topic.steps.length,4);
  assert.ok(['settings','registry','templates','members'].includes(topic.action));
  const page=adminGuideHtml(topic.id);
  assert.equal((page.match(/class="kp-ag-graphic"/g)||[]).length,4,'each step has a visual illustration');
  assert.equal((page.match(/class="kp-ag-step-no"/g)||[]).length,4,'each step has a numbered pin');
  assert.equal((page.match(/class="kp-ag-mini-sidebar"/g)||[]).length,4);
  assert.match(page,/ภาพประกอบจำลองจากหน้าฟอร์มระบบ ไม่ใช่ข้อมูลผู้ใช้จริง/);
  assert.ok(page.includes('data-target="'+topic.action+'"'));
  assert.ok(page.includes('data-section="'+topic.id+'"'));
  assert.ok(page.includes(topic.title));
  assert.ok(page.includes(topic.note));
 }
});
test('real admin forms and numbering are described accurately without inventing controls',()=>{
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 const editor=readFileSync(new URL('./template-builder.js',import.meta.url),'utf8');
 const entire=adminGuideTopics.map(t=>t.steps.map(s=>s.heading+' '+s.desc+' '+s.fields.map(f=>f.join(' ')).join(' ')).join(' ')).join('\n');
 for(const exact of ['บันทึกข้อมูลโรงเรียน','ชื่อผู้ลงนาม','ผู้อำนวยการสถานศึกษา',
 'ทะเบียนคุมเลขเอกสาร','บันทึกเลขถัดไป','ดูเลขของปีนี้',
 'บันทึกฉบับร่าง','ประกาศใช้แม่แบบนี้','เพิ่มเจ้าหน้าที่โรงเรียน',
 'กำหนดรหัสผ่าน','เปลี่ยนรหัสผ่าน','เปิดสิทธิ์','แก้ไข','ลบ']){
  assert.ok(entire.includes(exact),'Guide missing '+exact);
  assert.ok(app.includes(exact)||editor.includes(exact),'Not grounded in product '+exact);
 }
 assert.match(entire,/พว\.\/พค\. ใช้ลำดับร่วมกัน/);
 assert.match(entire,/เลขหนังสือทั่วไป/);
 assert.match(entire,/อย่างน้อย 6 ตัวอักษร/);
 assert.match(entire,/ไม่ยอมให้ตั้งเลขย้อนกลับ/);
 assert.doesNotMatch(entire,/พว\.[^\n]{0,40}พค\.[^\n]{0,40}แยกเลขเริ่มต้น/);
});
test('admin guide is role-gated in sidebar, render path and click actions',()=>{
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 assert.match(app,/const isSchoolAdmin=\(\)=>!state\.demo&&!!state\.user/);
 assert.match(app,/if\(isSchoolAdmin\(\)\)items\.push\(\['admin-guide'/);
 assert.match(app,/if\(state\.page==='admin-guide'\)return renderAdminGuide\(\)/);
 assert.match(app,/function renderAdminGuide\(\)\{\s*if\(!isSchoolAdmin\(\)\)/);
 assert.match(app,/if\(action==='admin-guide'\)\{\s*if\(!isSchoolAdmin\(\)\)/);
 assert.match(app,/if\(action==='admin-guide-section'\)\{\s*if\(!isSchoolAdmin\(\)\)/);
 assert.match(app,/if\(action==='admin-guide-open'\)\{\s*if\(!isSchoolAdmin\(\)\)/);
 assert.match(app,/topic\.action!==String\(el\?\.dataset\?\.target\|\|''\)/);
 assert.match(app,/return go\(topic\.action,\{dataset:\{\}\}\)/);
 assert.doesNotMatch(adminGuideHtml('overview'),/name="password"|data-school-id=|Bearer /);
});
test('public guide is fully retired while app guide assets remain responsive',()=>{
 const index=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 const build=readFileSync(new URL('./build.mjs',import.meta.url),'utf8');
 const pages=readFileSync(new URL('./marketing-pages.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('./admin-guide.css',import.meta.url),'utf8');
 assert.doesNotMatch(pages,/guide:guidePageHtml/);
 assert.doesNotMatch(pages,/\['guide','คู่มือการใช้งาน'\]/);
 assert.doesNotMatch(pages,/from '\.\/user-guide\.js'/);
 assert.match(index,/admin-guide\.css\?v=20261022-admin-guide-v1/);
 assert.doesNotMatch(index,/<link rel="stylesheet" href="\/user-guide\.css/);
 assert.match(build,/'admin-guide\.css'/);
 assert.doesNotMatch(build,/'user-guide\.css'/);
 assert.match(css,/\.kp-ag-graphic/);
 assert.match(css,/\.kp-ag-highlight/);
 assert.match(css,/@media\(max-width:680px\)/);
 assert.match(css,/@media print/);
});
