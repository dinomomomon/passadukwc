import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {adminGuideTopics,adminGuideIds,adminGuideHtml} from './admin-guide.js';

const read=(filename)=>readFileSync(new URL('./'+filename,import.meta.url),'utf8');
const svgWebp=(filename)=>{
 const svg=read(filename);
 const match=svg.match(/href="data:image\/webp;base64,([A-Za-z0-9+/=]+)"/);
 assert.ok(match&&match[1].length>150000,'approved image asset should exist and not be empty: '+filename);
 const buffer=Buffer.from(match[1],'base64');
 assert.equal(buffer.toString('ascii',0,4),'RIFF');
 assert.equal(buffer.toString('ascii',8,12),'WEBP');
 return svg;
};

test('five admin subtopics including future asset setup; no separate signer or overview',()=>{
 assert.deepEqual(adminGuideIds,['school','numbers','templates','users','assets']);
 assert.deepEqual(adminGuideTopics.map(t=>t.title),[
  'การตั้งค่าข้อมูลโรงเรียน','การตั้งค่าเลขทะเบียนคุม','แก้ไขแม่แบบเอกสาร','จัดการผู้ใช้งานและสิทธิ์','การตั้งค่าทะเบียนคุมครุภัณฑ์'
 ]);
 assert.equal(adminGuideTopics.length,5);
 assert.equal(adminGuideTopics.reduce((n,t)=>n+t.steps.length,0),18);
 const first=adminGuideHtml();
 assert.match(first,/การตั้งค่าข้อมูลโรงเรียน/);
 assert.match(first,/src="\/admin-guide-school-infographic\.svg"/);
 assert.doesNotMatch(first,/ภาพรวมคู่มือ|ตั้งค่าผู้ลงนาม|data-section="overview"|kp-ag-topic-card/);
 assert.equal((first.match(/data-action="admin-guide-section"/g)||[]).length,6,'five topic tabs plus return to first');
 for(const topic of adminGuideTopics){
  const html=adminGuideHtml(topic.id);
  assert.match(html,new RegExp('data-section="'+topic.id+'"'));
  assert.match(html,new RegExp('data-target="'+topic.action+'"'));
  assert.match(html,/\/ 05/);
  assert.doesNotMatch(html,/data-section="signers"|data-section="overview"|kp-ag-graphic|kp-ag-mini-sidebar/);
 }
 const bad=adminGuideHtml('signers');
 assert.match(bad,/การตั้งค่าข้อมูลโรงเรียน/);
 assert.doesNotMatch(bad,/ตั้งค่าผู้ลงนาม/);
});

test('school guide image is retained unchanged and can open full size',()=>{
 const markup=adminGuideHtml('school');
 assert.match(markup,/src="\/admin-guide-school-infographic\.svg"/);
 assert.match(markup,/href="\/admin-guide-school-infographic\.svg"/);
 assert.match(markup,/width="1448" height="1086"/);
 assert.match(markup,/ตัวอย่างข้อมูลสมมติ/);
 assert.doesNotMatch(markup,/id="school-form"|kp-ag-live-form/);
 const svg=svgWebp('admin-guide-school-infographic.svg');
 assert.match(svg,/width="1448" height="1086"/);
});

test('new registry guide uses infographic based on four numbering controls in actual admin screen',()=>{
 const markup=adminGuideHtml('numbers');
 assert.match(markup,/การตั้งค่าเลขทะเบียนคุม/);
 assert.match(markup,/src="\/admin-guide-registry-infographic\.svg\?v=20261023-orange-title-v2"/);
 assert.match(markup,/href="\/admin-guide-registry-infographic\.svg\?v=20261023-orange-title-v2"/);
 assert.match(markup,/width="1536" height="1024"/);
 assert.match(markup,/หนังสือรายงานผลและเบิกจ่าย/);
 assert.match(markup,/ใบตรวจรับ และใบเบิกพัสดุ/);
 assert.match(markup,/เลขถัดไปเป็นเพียงเลขลำดับ/);
 assert.match(markup,/เลขที่เคยใช้หรือจองแล้วกลับมาใช้ซ้ำ/);
 assert.match(markup,/เปิดเมนูจริง/);
 assert.doesNotMatch(markup,/kp-ag-mini-sidebar|kp-ag-live-form|id="registry-form"/);
 const svg=svgWebp('admin-guide-registry-infographic.svg');
 assert.match(svg,/viewBox="0 0 1536 1024"/);
 assert.match(svg,/width="1536" height="1024"/);
 const desc=adminGuideTopics.find(x=>x.id==='numbers').steps.map(s=>s.desc).join(' ');
 assert.match(desc,/พว\.\/พค\. ใช้ลำดับร่วมกัน/);
 assert.match(desc,/หนังสือทั่วไป/);
 assert.match(desc,/ดูเลขของปีนี้/);
});

test('admin role checks and live navigation are unchanged, no registry data updated by guide',()=>{
 const app=read('app.js');
 assert.match(app,/visibleAdminLinks\(opts\)/);
  assert.match(app,/adminGuideTopics\.map\(topic=>/);
 assert.match(app,/if\(state\.page==='admin-guide'\)return renderAdminGuide\(\)/);
 assert.match(app,/function renderAdminGuide\(\)\{\s*if\(!isSchoolAdmin\(\)\)/);
 assert.match(app,/if\(action==='admin-guide'\)\{\s*if\(!isSchoolAdmin\(\)\)/);
 assert.match(app,/if\(action==='admin-guide-section'\)\{\s*if\(!isSchoolAdmin\(\)\)/);
 assert.match(app,/if\(action==='admin-guide-open'\)\{\s*if\(!isSchoolAdmin\(\)\)/);
 assert.match(app,/adminGuideHtml\(section\)/);
 assert.doesNotMatch(app,/section==='signers'/);
 assert.match(app,/state\.adminGuideSection='school';state\.page='admin-guide'/);
 assert.match(app,/return go\(topic\.action,\{dataset:\{\}\}\)/);
 const guide=read('admin-guide.js');
 assert.doesNotMatch(guide,/supabase\.|db\.from\(|db\.rpc\(|fetch\(/);
 assert.equal(adminGuideTopics.find(x=>x.id==='numbers').action,'registry');
});

test('infographic assets get built and displayed in responsive container on both hosts',()=>{
 const css=read('admin-guide.css');
 const index=read('index.html');
 const build=read('build.mjs');
 const publicPages=read('marketing-pages.js');
 assert.match(css,/\.kp-ag-infographic-link img\{display:block;width:100%;height:auto;object-fit:contain/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(build,/'admin-guide-registry-infographic\.svg'/);
 assert.match(build,/'admin-guide-school-infographic\.svg'/);
 assert.match(build,/'admin-guide-templates-1\.svg'/);
 assert.match(build,/'admin-guide-templates-2\.svg'/);
 assert.match(build,/'admin-guide-users-infographic\.svg'/);
 assert.match(index,/admin-guide\.css\?v=20261023-staff-guide-v2/);
 assert.match(index,/app\.js\?v=20261024-equipment-v1/);
 assert.doesNotMatch(publicPages,/\['guide','คู่มือการใช้งาน'\]/);
});


test('template editor admin tutorial presents six accurate steps across two real-screen graphics',()=>{
 const html=adminGuideHtml('templates');
 assert.match(html,/src="\/admin-guide-templates-1\.svg\?v=20261023-real-editor-v1"/);
 assert.match(html,/src="\/admin-guide-templates-2\.svg\?v=20261023-real-editor-v1"/);
 assert.match(html,/href="\/admin-guide-templates-1\.svg\?v=20261023-real-editor-v1"/);
 assert.match(html,/href="\/admin-guide-templates-2\.svg\?v=20261023-real-editor-v1"/);
 assert.equal((html.match(/class="kp-ag-manual-figure"/g)||[]).length,2);
 assert.match(html,/width="1600" height="1520"/);
 assert.match(html,/บันทึกฉบับร่างก่อนกดประกาศใช้/);
 assert.match(html,/ข้อความสีฟ้าเป็นฟิลด์จากระบบที่แก้ในแม่แบบไม่ได้/);
 assert.match(html,/PDF ทั้งข้อความสั้นและข้อความยาว/);
 assert.match(html,/data-action="admin-guide-open" data-target="templates"/);
 for(const n of [1,2]){
  const svg=svgWebp('admin-guide-templates-'+n+'.svg');
  assert.match(svg,/viewBox="0 0 1600 1520"/);
  assert.match(svg,/width="1600" height="1520"/);
 }
 const editor=read('template-builder.js');
 for(const label of ['tpl-page','tpl-block','tpl-up','tpl-down','tpl-format','tpl-save','tpl-publish','tpl-history','tpl-reset']){
  assert.ok(editor.includes(label),'Missing actual editor action: '+label);
 }
 assert.match(editor,/กรุณาบันทึกฉบับร่างก่อนประกาศใช้/);
 assert.match(editor,/ชื่อบุคคล ตำแหน่ง เลขเอกสาร วันที่ และยอดเงินส่วนนี้ดึงจากฐานข้อมูล/);
});


test('administrator user and permissions guide shows a full-size, anonymous five-step infographic',()=>{
 const html=adminGuideHtml('users');
 assert.match(html,/จัดการผู้ใช้งานและสิทธิ์/);
 assert.match(html,/src="\/admin-guide-users-infographic\.svg\?v=20261023-users-guide-v1"/);
 assert.match(html,/href="\/admin-guide-users-infographic\.svg\?v=20261023-users-guide-v1"/);
 assert.match(html,/width="1700" height="1490"/);
 assert.match(html,/ชื่อและอีเมลเป็นข้อมูลสมมติ/);
 assert.match(html,/รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร/);
 assert.match(html,/การลบผู้ใช้จะถอนสิทธิ์ออกจากโรงเรียนแต่เก็บประวัติเอกสารไว้/);
 assert.match(html,/ไม่สามารถปิดสิทธิ์หรือลบบัญชีตนเองได้/);
 assert.match(html,/data-action="admin-guide-open" data-target="members"/);
 assert.doesNotMatch(html,/kp-ag-real-form|kp-ag-mini-sidebar|id="member-form"/);
 const svg=svgWebp('admin-guide-users-infographic.svg');
 assert.match(svg,/width="1700" height="1490"/);
 assert.match(svg,/viewBox="0 0 1700 1490"/);
 const steps=adminGuideTopics.find(x=>x.id==='users').steps;
 assert.equal(steps.length,5);
 assert.match(steps.map(s=>s.heading).join(' '),/เพิ่ม/);
 assert.match(steps.map(s=>s.desc).join(' '),/ปิดสิทธิ์/);
 assert.match(steps.map(s=>s.desc).join(' '),/เปิดสิทธิ์/);
 const app=read('app.js');
 for(const action of ['edit-staff','password-staff','toggle-staff','remove-staff','member-form']){
  assert.ok(app.includes(action),'Existing admin UI action must match manual: '+action);
 }
 for(const label of ['อีเมลสำหรับเข้าสู่ระบบ','กำหนดรหัสผ่าน','ยืนยันรหัสผ่าน','หน้าที่ในระบบ','+ สร้างบัญชีและให้สิทธิ์ใช้งาน']){
  assert.ok(app.includes(label),'Form label not found in actual UI: '+label);
 }
 assert.match(app,/minlength="6"/);
 assert.match(app,/const isSchoolAdmin=/);
});
