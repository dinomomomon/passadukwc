import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicPageIds,publicPageHtml,featureData,filterPublicContent,sampleDocumentHtml} from './marketing-pages.js';
import {buildDocuments} from './print.js';

test('six public pages provide functional Thai nav links and calls to action',()=>{
 assert.deepEqual(publicPageIds,['home','features','examples','guide','faq','contact']);
 for(const page of publicPageIds){
  const html=publicPageHtml(page);
  assert.match(html,/lang=|<main id="main-content">/);
  assert.match(html,/data-action="public-page"/);
  assert.match(html,/data-action="login"/);
  assert.match(html,/data-action="demo"/);
  assert.match(html,/kru-pasadu-icon.svg/);
  for(const name of ['หน้าแรก','ฟีเจอร์','ตัวอย่างเอกสาร','คู่มือการใช้งาน','คำถามที่พบบ่อย','ติดต่อเรา']){
   assert.ok(html.includes(name),'Missing nav: '+name+' on '+page);
  }
  assert.ok(!/70%|60%|100%/.test(html),'Marketing claims must not invent measured impact metrics');
 }
});
test('home sells actual repeatable procurement workflow without inventing official approvals',()=>{
 const html=publicPageHtml('home');
 for(const text of ['กรอกข้อมูลครั้งเดียว','ทะเบียนคุมเลข','ลดภาระงานครู','ตัวอย่าง A4 ก่อนพิมพ์',
 'สร้างรายการ','กรอกข้อมูล','ตรวจเอกสาร','พิมพ์หรือบันทึก PDF']){
  assert.ok(html.includes(text),text);
 }
 assert.match(html,/ข้อมูลสมมติเพื่อการสาธิต/);
 assert.equal(featureData.length,10);
});
test('all six supported government A4 document types are discoverable in public gallery',()=>{
 const html=publicPageHtml('examples');
 for(const t of ['รายงานขอซื้อ / ขอจ้าง','รายละเอียดพัสดุ / งานจ้างแนบท้าย',
 'รายงานผลการพิจารณา','ใบตรวจรับพัสดุ / งานจ้าง',
 'ทราบผลและขออนุมัติเบิกจ่าย','ใบเบิกพัสดุ']){
  assert.ok(html.includes(t),'Missing example '+t);
 }
 assert.equal((html.match(/data-public-doc-card="/g)||[]).length,6);
 assert.match(html,/id="kp-public-doc-frame"/);
 assert.match(html,/ข้อมูลและชื่อบุคคลในตัวอย่างเป็นข้อมูลสมมติ/);
});
test('complete online manual replaces placeholder while contact remains honestly pending',()=>{
 const guide=publicPageHtml('guide'),contact=publicPageHtml('contact');
 assert.match(guide,/คู่มือการใช้งาน/);
 assert.match(guide,/15 บทเรียน/);
 assert.match(guide,/กรอกข้อมูล/);
 assert.match(guide,/ขั้นที่ 1 — ข้อมูลการจัดหา/);
 assert.match(guide,/ขั้นที่ 4 — เลขที่หนังสือและตรวจสอบ/);
 assert.doesNotMatch(guide,/คู่มือการใช้งาน<br><em>กำลังอัปเดต/);
 assert.match(contact,/ติดต่อเรา/);
 assert.match(contact,/รออัปเดต/);
 assert.match(contact,/LINE \/ แชต/);
 assert.doesNotMatch(contact,/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
});
test('faq is a native keyboard-accessible expandable disclosure with grounded responses',()=>{
 const html=publicPageHtml('faq');
 assert.equal((html.match(/<details class="kp-pub-faq-item"/g)||[]).length,11);
 assert.match(html,/<summary>/);
 for(const q of ['ลดภาระงาน','เลขเอกสารอัตโนมัติ','แม่แบบเอกสาร','สิทธิ์ผู้ใช้งาน','ต้องติดตั้งโปรแกรมหรือไม่','ใช้งานฟรีได้ตลอดไปหรือไม่']){
  assert.ok(html.includes(q),'Missing FAQ '+q);
 }
 assert.match(html,/ไม่ได้แทนการตรวจรับ การอนุมัติ หรือการลงนามจริง/);
});
test('real preview is produced by official renderer from fictional record only',()=>{
 const module=readFileSync(new URL('./marketing-pages.js',import.meta.url),'utf8');
 assert.match(module,/buildDocuments\(exampleRecord,exampleSchool\)/);
 assert.match(module,/container\.content\.querySelectorAll\('section\.paper-page'\)/);
 assert.match(module,/sandbox=""/);
 assert.match(module,/srcdoc=/);
 assert.match(module,/ข้อมูลสมมติสำหรับแสดงตัวอย่าง/);
 assert.doesNotMatch(module,/state\.records|db\.from\('procurements'\)/);
 // Independently verify the renderer remains capable of rendering the six purchase forms.
 const example={kind:'purchase',title:'ทดสอบ',reason:'ทดสอบ',document_date:'2026-10-20',
  document_number:1,fiscal_year:2570,items:[{name:'วัสดุตัวอย่าง',qty:1,unit:'ชิ้น',price_satang:5000}],
  total_satang:5000,document_meta:{}};
 const out=buildDocuments(example,{name:'โรงเรียนตัวอย่าง'});
 assert.equal((out.match(/<section class="paper-page/g)||[]).length,6);
});
test('marketing assets are included in build, cached safely, and preserve internal app route/auth',()=>{
 const build=readFileSync(new URL('./build.mjs',import.meta.url),'utf8');
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 const index=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('./marketing-pages.css',import.meta.url),'utf8');
 assert.match(build,/'marketing-pages\.css'/);
 assert.match(index,/marketing-pages\.css\?v=20261022-[a-z0-9-]+/);
 assert.match(index,/app\.js\?v=20261022-[a-z0-9-]+/);
 assert.match(app,/from '\.\/marketing-pages\.js'/);
 assert.match(app,/if\(action==='public-page'\)/);
 assert.match(app,/if\(action==='public-document'\)/);
 assert.match(app,/if\(action==='login'\|\|action==='signup'\)/);
 assert.match(app,/if\(action==='demo'\)return startDemo\(\)/);
 assert.match(app,/state\.page=state\.recoveryMode\?'auth':publicQueryPage\(\)/);
 assert.match(app,/filterPublicContent\(el\.value\)/);
 assert.match(css,/\.kp-pub-faq-item/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/@media print/);
});


test('guide exposes all 15 searchable chapters, deep links, and accurate 4-step field names',async()=>{
 const {guideChapters,guidePageHtml}=await import('./user-guide.js');
 const html=guidePageHtml();
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 const meta=readFileSync(new URL('./document-meta.js',import.meta.url),'utf8');
 assert.equal(guideChapters.length,15);
 assert.equal(new Set(guideChapters.map(c=>c.id)).size,15);
 assert.equal((html.match(/data-guide-chapter="/g)||[]).length,15);
 assert.equal((html.match(/class="kp-guide-chapter-no"/g)||[]).length,15);
 for(const id of ['start','school','step1','step2','step3','step4','record','evidence',
   'docs','pdf','numbers','templates','staff','trial','help']){
  assert.match(html,new RegExp('id="guide-'+id+'"'));
  assert.match(html,new RegExp('href="#guide-'+id+'"'));
 }
 assert.match(html,/id="kp-public-search"/);
 assert.match(html,/id="kp-guide-search-result"/);
 assert.match(html,/id="kp-guide-no-results"/);
 assert.match(html,/data-action="demo"/);
 for(const field of ['ประเภทการจัดหา','หมวดของที่จะจัดซื้อ','วันที่เอกสาร','ปีงบประมาณ',
  'กลุ่มงาน/ฝ่ายที่ขอ','เรื่องที่จัดซื้อ/จัดจ้าง','เหตุผลและความจำเป็น',
  'แผนงาน/โครงการ/แหล่งเงิน','รายละเอียดพัสดุ','จำนวน','หน่วยนับ',
  'ราคาต่อหน่วย','ชื่อร้านค้า/ผู้รับจ้าง','ชื่อผู้ตรวจรับ','เลขที่หนังสือ']){
  assert.ok(html.includes(field),'Missing actual field in guide: '+field);
  assert.ok(app.includes(field)||meta.includes(field),'Guide field is not grounded in active form: '+field);
 }
 assert.match(html,/วันที่บนหัวบันทึกเว้นว่างให้ฝ่ายการเงิน/);
 assert.match(html,/ระบบออกเลขจากทะเบียนทั่วไปต่อเนื่อง/);
 assert.match(html,/พว\./);
 assert.match(html,/พค\./);
 assert.match(html,/สร้างบัญชีและให้สิทธิ์ใช้งาน/);
 assert.match(html,/บันทึกฉบับร่าง/);
 assert.match(html,/ประกาศใช้แม่แบบนี้/);
 assert.match(html,/บันทึกข้อมูลเอกสาร/);
 assert.match(html,/Ctrl \+ Shift \+ R/);
 assert.doesNotMatch(html,/โรงเรียนกาวิละวิทยาลัย|primstore589@/);
});

test('guide filtering and responsive stylesheet are packaged for public route',async()=>{
 const app=readFileSync(new URL('./marketing-pages.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('./user-guide.css',import.meta.url),'utf8');
 const build=readFileSync(new URL('./build.mjs',import.meta.url),'utf8');
 const index=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 assert.match(app,/import \{guidePageHtml\} from '\.\/user-guide\.js'/);
 assert.match(app,/guide:guidePageHtml/);
 assert.match(app,/\[data-guide-chapter\]/);
 assert.match(app,/kp-guide-search-result/);
 assert.match(app,/kp-guide-no-results/);
 assert.match(css,/\.kp-guide-sidebar/);
 assert.match(css,/position:sticky/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/@media print/);
 assert.match(build,/'user-guide\.css'/);
 assert.match(index,/user-guide\.css\?v=20261022-guide-complete-v1/);
});
