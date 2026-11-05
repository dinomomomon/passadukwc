import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicPageIds,publicPageHtml,featureData,filterPublicContent,sampleDocumentHtml} from './marketing-pages.js';
import {buildDocuments} from './print.js';

test('five public pages retain marketing navigation without private admin guide',()=>{
 assert.deepEqual(publicPageIds,['home','features','examples','faq','contact']);
 for(const page of publicPageIds){
  const html=publicPageHtml(page);
  assert.match(html,/lang=|<main id="main-content">/);
  assert.match(html,/data-action="public-page"/);
  assert.match(html,/data-action="login"/);
  assert.match(html,/data-action="demo"/);
  assert.match(html,/kru-pasadu-icon.svg/);
  for(const name of ['หน้าแรก','ฟีเจอร์','ตัวอย่างเอกสาร','คำถามที่พบบ่อย','ติดต่อเรา']){
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
test('public pages no longer expose the administrator guide',()=>{
 for(const page of [...publicPageIds,'guide']){
  const html=publicPageHtml(page);
  assert.doesNotMatch(html,/data-page="guide"/);
  assert.doesNotMatch(html,/คู่มือการใช้งาน/);
 }
 assert.deepEqual(publicPageIds,['home','features','examples','faq','contact']);
 const contact=publicPageHtml('contact');
 assert.match(contact,/รออัปเดต/);
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
 // Independently verify the renderer remains capable of rendering the seven purchase forms.
 const example={kind:'purchase',title:'ทดสอบ',reason:'ทดสอบ',document_date:'2026-10-20',
  document_number:1,fiscal_year:2570,items:[{name:'วัสดุตัวอย่าง',qty:1,unit:'ชิ้น',price_satang:5000}],
  total_satang:5000,document_meta:{}};
 const out=buildDocuments(example,{name:'โรงเรียนตัวอย่าง'});
 assert.equal((out.match(/<section class="paper-page/g)||[]).length,7);
});
test('marketing assets are included in build, cached safely, and preserve internal app route/auth',()=>{
 const build=readFileSync(new URL('./build.mjs',import.meta.url),'utf8');
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 const index=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('./marketing-pages.css',import.meta.url),'utf8');
 assert.match(build,/'marketing-pages\.css'/);
 assert.match(index,/marketing-pages\.css\?v=20261022-[a-z0-9-]+/);
 assert.match(index,/app\.js\?v=2026102[234]-[a-z0-9-]+/);
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


