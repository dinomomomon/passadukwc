import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sidebarGroups,assetTopics,visibleSidebarGroups,visibleAdminLinks,navGroupIds,groupForPage,validAssetTopic} from './sidebar-navigation.js';
import {staffGuideIds} from './staff-guide.js';
import {adminGuideIds,adminGuideHtml} from './admin-guide.js';
const read=filename=>readFileSync(new URL('./'+filename,import.meta.url),'utf8');
test('navigation has three collapsible groups and exactly the six intended top-level sections for a school admin',()=>{
 assert.deepEqual(navGroupIds,['procurement','assets','guides']);
 assert.deepEqual(sidebarGroups.map(x=>x.label),['ระบบการจัดซื้อจัดจ้าง','ทะเบียนครุภัณฑ์','คู่มือผู้ใช้งาน']);
 const first=visibleSidebarGroups({schoolAdmin:true,admin:true});
 assert.deepEqual(first[0].items.map(x=>x.action),['dashboard','create','records','registry','user-guide','templates']);
 assert.deepEqual(first[1].items.map(x=>x.label),['ภาพรวมครุภัณฑ์','ทะเบียนครุภัณฑ์','เพิ่ม / นำเข้าครุภัณฑ์','คำนวณค่าเสื่อมราคา','รายงานทะเบียนครุภัณฑ์ A4','ตั้งค่าประเภทและรหัสครุภัณฑ์']);
 assert.deepEqual(first[2].items.map(x=>x.label),['คู่มือระบบจัดซื้อจัดจ้าง','คู่มือระบบทะเบียนคุมครุภัณฑ์']);
 assert.deepEqual(visibleAdminLinks({schoolAdmin:true,admin:true}).map(x=>x.label),['จัดการผู้ใช้งาน','ข้อมูลโรงเรียน','คู่มือผู้ดูแลระบบ']);
});
test('regular school users and demonstration mode cannot see school-admin-only functions',()=>{
 const regular=visibleSidebarGroups({schoolAdmin:false,admin:false});
 assert.ok(!regular[0].items.some(x=>x.id==='templates'));
 assert.ok(!regular[1].items.some(x=>x.id==='settings'));
 assert.equal(visibleAdminLinks({schoolAdmin:false,admin:false}).length,0);
 assert.deepEqual(visibleAdminLinks({schoolAdmin:false,admin:true}).map(x=>x.id),['settings']);
 assert.equal(regular[2].items.length,2);
 assert.equal(regular[0].items.find(x=>x.id==='guide-shortcut').action,'user-guide');
 assert.equal(regular[2].items[0].action,'user-guide');
 assert.deepEqual(staffGuideIds,['create','records','registry']);
});
test('asset items are clearly marked future and cannot be confused with real procurement records',()=>{
 assert.equal(assetTopics.length,6);
 assert.ok(assetTopics.every(x=>validAssetTopic(x.id)));
 assert.equal(validAssetTopic('made-up-action'),false);
 assert.ok(visibleSidebarGroups({schoolAdmin:true,admin:true})[1].items.every(x=>x.comingSoon));
 const app=read('app.js');
 assert.match(app,/function renderAssetModulePlaceholder\(\)/);
 assert.match(app,/อยู่ระหว่างการพัฒนา/);
 assert.match(app,/if\(action==='asset-section'\|\|action==='assets-settings'\)/);
 assert.match(app,/section==='settings'&&!isSchoolAdmin\(\)/);
 assert.match(app,/if\(action==='asset-guide'\)/);
 assert.match(app,/state\.page='assets'/);
 assert.doesNotMatch(app.slice(app.indexOf('function renderAssetModulePlaceholder(){'),app.indexOf('function renderUniversalUserGuide(){')),/db\.from\(|db\.rpc\(/);
});
test('navigation remembers expanded groups and handles mobile drawer without changing core actions',()=>{
 const app=read('app.js'),css=read('brand-theme.css'),index=read('index.html');
 assert.match(app,/kp-sidebar-expanded-v1/);
 assert.match(app,/aria-expanded/);
 assert.match(app,/aria-controls/);
 assert.match(app,/if\(action==='nav-toggle'\)/);
 assert.match(app,/if\(action==='nav-mobile'\)/);
 assert.match(app,/if\(action==='nav-mobile-close'\)/);
 assert.match(app,/kp-bottom-navigation/);
 assert.match(css,/\.kp-sidebar-mobile-open/);
 assert.match(css,/\.kp-nav-overlay/);
 assert.match(css,/\.kp-side-children\[hidden\]/);
 assert.match(index,/app\.js\?v=20261024-equipment-v1/);
 assert.match(index,/brand-theme\.css\?v=20261024-equipment-v1/);
 for(const name of ["'create'","'records'","'registry'","'templates'","'user-guide'","'admin-guide'"]){
  assert.ok(app.includes(name),'Existing action preserved: '+name);
 }
 assert.match(app,/create_procurement_with_officer/);
 assert.match(app,/manage_official_number/);
});
test('admin guide has a fifth asset configuration topic, still school-admin gated',()=>{
 assert.deepEqual(adminGuideIds,['school','numbers','templates','users','assets']);
 const markup=adminGuideHtml('assets');
 assert.match(markup,/การตั้งค่าทะเบียนคุมครุภัณฑ์/);
 assert.match(markup,/ยังไม่เปิด/);
 assert.match(markup,/data-action="admin-guide-open" data-target="assets-settings"/);
 const app=read('app.js');
 assert.match(app,/if\(action==='admin-guide-section'\)\{\s*if\(!isSchoolAdmin\(\)\)/);
 assert.match(app,/adminGuideTopics\.map\(topic=>/);
});
test('page-to-group mapping supports existing documents and future asset guide',()=>{
 for(const page of ['dashboard','create','records','registry','detail','docmeta','preview','templates'])
  assert.equal(groupForPage(page),'procurement');
 assert.equal(groupForPage('assets'),'assets');
 assert.equal(groupForPage('user-guide'),'guides');
 assert.equal(groupForPage('asset-guide'),'guides');
});
