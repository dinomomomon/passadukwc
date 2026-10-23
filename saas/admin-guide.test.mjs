import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {adminGuideTopics,adminGuideIds,adminGuideHtml} from './admin-guide.js';

test('admin manual opens school data first and has no overview or mock screenshots',()=>{
 assert.deepEqual(adminGuideIds,['school','signers','numbers','templates','users']);
 assert.equal(adminGuideTopics.length,5);
 assert.equal(adminGuideTopics[0].title,'การตั้งค่าข้อมูลโรงเรียน');
 assert.equal(adminGuideTopics.reduce((n,t)=>n+t.steps.length,0),20);
 const first=adminGuideHtml();
 assert.match(first,/การตั้งค่าข้อมูลโรงเรียน/);
 assert.doesNotMatch(first,/ภาพรวมคู่มือ|data-section="overview"|kp-ag-welcome|kp-ag-topic-card/);
 assert.doesNotMatch(first,/kp-ag-graphic|ภาพจำลองหน้าจอ|kp-ag-mini-sidebar/);
 assert.equal((first.match(/data-section="(?:school|signers|numbers|templates|users)"/g)||[]).length,6,'five submenu buttons plus return to first chapter');
 const fallback=adminGuideHtml('overview');
 assert.match(fallback,/การตั้งค่าข้อมูลโรงเรียน/);
 assert.doesNotMatch(fallback,/data-section="overview"/);
 for(const topic of adminGuideTopics){
  const html=adminGuideHtml(topic.id);
  assert.ok(html.includes('data-target="'+topic.action+'"'));
  assert.ok(html.includes('data-section="'+topic.id+'"'));
  assert.ok(html.includes(topic.title));
  assert.ok(html.includes(topic.note));
  assert.doesNotMatch(html,/kp-ag-graphic|ภาพจำลองหน้าจอ|kp-ag-mini-sidebar/);
 }
});
test('school chapter uses exact user-provided infographic, not a live form or generic mock',()=>{
 const fakeActualSchoolMarkup='<form id="school-form"><input name="name"></form>';
 const html=adminGuideHtml('school',fakeActualSchoolMarkup);
 assert.match(html,/src="\/admin-guide-school-infographic\.svg"/);
 assert.match(html,/href="\/admin-guide-school-infographic\.svg"/);
 assert.match(html,/width="1448" height="1086"/);
 assert.match(html,/ตัวอย่างข้อมูลสมมติ/);
 assert.match(html,/คลิกที่ภาพเพื่อดูขนาดเต็ม/);
 assert.doesNotMatch(html,/id="school-form"|kp-ag-live-form|data-action="admin-guide-focus"/);
 assert.match(html,/data-action="admin-guide-open" data-target="settings"/);
 const svg=readFileSync(new URL('./admin-guide-school-infographic.svg',import.meta.url),'utf8');
 const embedded=svg.match(/href="data:image\/webp;base64,([A-Za-z0-9+/=]+)"/);
 assert.ok(embedded && embedded[1].length>150000,'full artwork must be bundled, not a placeholder');
 const img=Buffer.from(embedded[1],'base64');
 assert.equal(img.toString('ascii',0,4),'RIFF');
 assert.equal(img.toString('ascii',8,12),'WEBP');
 assert.match(svg,/width="1448" height="1086"/);
});

test('signatory chapter retains actual school signatory form, while other sections avoid fictitious screenshots',()=>{
 const realSchoolMarkup='<form id="school-logo-form"><input type="file" name="school_logo"></form>'+
  '<form id="school-form"><input name="officer_name"><input name="head_name">'+
  '<input name="director_name"><input name="finance_name"><button type="submit">บันทึกข้อมูลโรงเรียน</button></form>';
 const signers=adminGuideHtml('signers',realSchoolMarkup);
 assert.match(signers,/id="school-logo-form"/);
 assert.match(signers,/id="school-form"/);
 assert.match(signers,/ใช้งานและบันทึกจริง/);
 assert.match(signers,/data-action="admin-guide-focus"/);
 assert.equal((signers.match(/class="kp-ag-real-step"/g)||[]).length,4);
 for(const field of ['officer_name','head_name','director_name','submit'])
  assert.ok(signers.includes('data-field="'+field+'"'));
 for(const section of ['numbers','templates','users']){
  const html=adminGuideHtml(section);
  assert.doesNotMatch(html,/admin-guide-school-infographic|kp-ag-graphic|kp-ag-mini-sidebar/);
 }
});

test('real settings markup remains shared and actions preserve admin checks and saving',()=>{
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 assert.match(app,/function schoolSettingsMarkup\(\)/);
 assert.match(app,/function settings\(\)\{if\(!isAdmin\(\)\)/);
 assert.match(app,/shell\('ข้อมูลโรงเรียน','ตั้งค่าผู้ลงนาม',schoolSettingsMarkup\(\)\)/);
 assert.match(app,/adminGuideSection:'school'/);
 assert.match(app,/state\.adminGuideSection='school';state\.page='admin-guide'/);
 assert.match(app,/const section=adminGuideIds\.includes\(state\.adminGuideSection\)\?state\.adminGuideSection:'school'/);
 assert.match(app,/adminGuideHtml\(section,section==='signers'\?schoolSettingsMarkup\(\):''\)/);
 assert.match(app,/if\(action==='admin-guide-focus'\)\{\s*if\(!isSchoolAdmin\(\)\)/);
 assert.match(app,/if\(!adminGuideIds\.includes\(section\)\)/);
 assert.match(app,/if\(action==='admin-guide'\)\{\s*if\(!isSchoolAdmin\(\)\)/);
 assert.match(app,/if\(action==='admin-guide-section'\)\{\s*if\(!isSchoolAdmin\(\)\)/);
 assert.match(app,/if\(action==='admin-guide-open'\)\{\s*if\(!isSchoolAdmin\(\)\)/);
 assert.match(app,/if\(isSchoolAdmin\(\)\)items\.push\(\['admin-guide'/);
 assert.match(app,/if\(form\.id==='school-logo-form'\)/);
 assert.match(app,/if\(form\.id==='school-form'\)/);
 assert.match(app,/db\.from\('schools'\)\.update\(f\)/);
 for(const name of ['name','district','province','memo_prefix','address','officer_name','head_name','director_name','finance_name']){
  assert.ok(app.includes("'"+name+"'"),'Real settings must include '+name);
 }
});
test('infographic is bundled and responsive while actual school controls remain separate',()=>{
 const css=readFileSync(new URL('./admin-guide.css',import.meta.url),'utf8');
 const index=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 const build=readFileSync(new URL('./build.mjs',import.meta.url),'utf8');
 const pages=readFileSync(new URL('./marketing-pages.js',import.meta.url),'utf8');
 assert.match(css,/\.kp-ag-live-form/);
 assert.match(css,/\.kp-ag-field-focus/);
 assert.match(css,/\.kp-ag-real-step/);
 assert.match(css,/@media\(max-width:780px\)/);
 assert.match(build,/'admin-guide\.css'/);
 assert.match(css,/\.kp-ag-infographic-link img/);
 assert.match(css,/\.kp-ag-infographic-guide/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(index,/admin-guide\.css\?v=20261023-school-infographic-v1/);
 assert.match(index,/app\.js\?v=20261023-school-infographic-v1/);
 assert.match(build,/'admin-guide-school-infographic\.svg'/);
 assert.doesNotMatch(pages,/guide:guidePageHtml/);
 assert.doesNotMatch(pages,/\['guide','คู่มือการใช้งาน'\]/);
});
