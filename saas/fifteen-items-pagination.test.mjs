import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {OFFICIAL_ITEMS_PER_PAGE,buildDocuments} from './print.js';

const school={name:'โรงเรียนกาวิละวิทยาลัย',officer_name:'เจ้าหน้าที่พัสดุ',head_name:'หัวหน้าพัสดุ',director_name:'ผู้อำนวยการ'};
const rows=n=>Array.from({length:n},(_,i)=>({name:'รายการที่ '+(i+1),qty:1,unit:'ชิ้น',price_satang:10000}));
const record=(kind,n)=>({kind,title:'จัดซื้อพัสดุ',reason:'ใช้ในโรงเรียน',document_date:'2026-10-09',
 items:rows(n),total_satang:n*10000,document_meta:{}});
const pages=(html,cls)=>[...html.matchAll(new RegExp('<section class="paper-page official gov-doc '+cls+'">([\\s\\S]*?)<\\/section>','g'))].map(x=>x[1]);
const rowCounts=parts=>parts.map(s=>(s.match(/class="gov-data-row"/g)||[]).length);

test('maximum is 15 item lines per complete A4 form',()=>{
 assert.equal(OFFICIAL_ITEMS_PER_PAGE,15);
});

test('8 and 15 items do not split annex, order, or requisition forms unnecessarily',()=>{
 for(const count of [8,15])for(const kind of ['purchase','hire']){
  const html=buildDocuments(record(kind,count),school);
  for(const cls of ['gov-annex','gov-order',...(kind==='purchase'?['gov-requisition']:[])]){
   const items=pages(html,cls);
   assert.equal(items.length,1,cls+' '+kind+' '+count);
   assert.deepEqual(rowCounts(items),[count]);
   assert.match(items[0],/class="print-title"|class="order-heading"/);
  }
  assert.equal((html.match(/class="gov-annex-sign"/g)||[]).length,1);
  assert.equal((html.match(/class="order-signatures"/g)||[]).length,1);
  if(kind==='purchase')assert.equal((html.match(/class="gov-requisition-signatures"/g)||[]).length,1);
 }
});

test('16, 30 and 31 items split at 15 without missing items or final totals',()=>{
 for(const [count,expected] of [[16,[15,1]],[30,[15,15]],[31,[15,15,1]]]){
  const html=buildDocuments(record('purchase',count),school);
  for(const cls of ['gov-annex','gov-order','gov-requisition']){
   const parts=pages(html,cls);
   assert.deepEqual(rowCounts(parts),expected,cls+' for '+count);
   assert.equal(parts.reduce((n,p)=>(p.match(/class="gov-data-row"/g)||[]).length+n,0),count);
   parts.forEach(p=>assert.match(p,/class="print-title"|class="order-heading"/));
  }
  assert.equal((html.match(/class="gov-summary-start"/g)||[]).length,1);
  assert.equal((html.match(/class="order-totals"/g)||[]).length,1);
 }
});

test('repartitioning the order does not reduce the annex or requisition capacity',()=>{
 const html=buildDocuments({...record('purchase',8),
  __items_per_page_by_form:{annex:15,order:7,requisition:15}},school);
 assert.deepEqual(rowCounts(pages(html,'gov-annex')),[8]);
 assert.deepEqual(rowCounts(pages(html,'gov-order')),[7,1]);
 assert.deepEqual(rowCounts(pages(html,'gov-requisition')),[8]);
});

test('legacy numeric page overrides remain supported but capped at fifteen',()=>{
 const r=record('purchase',31);
 assert.deepEqual(rowCounts(pages(buildDocuments({...r,__items_per_page:3},school),'gov-annex')),
  [...Array(10).fill(3),1]);
 assert.deepEqual(rowCounts(pages(buildDocuments({...r,__items_per_page:500},school),'gov-annex')),[15,15,1]);
});

test('print measurement retries only the overflowing form while preserving other headers and signatures',async()=>{
 const src=await readFile(new URL('./app.js',import.meta.url),'utf8');
 assert.match(src,/const perFormLimit=\{annex:OFFICIAL_ITEMS_PER_PAGE,order:OFFICIAL_ITEMS_PER_PAGE,requisition:OFFICIAL_ITEMS_PER_PAGE\}/);
 assert.match(src,/__items_per_page_by_form:perFormLimit/);
 assert.match(src,/for\(const type of failedTypes\)perFormLimit\[type\]--/);
 assert.match(src,/if\(failedTypes.includes\(null\)\|\|failedTypes.some\(type=>perFormLimit\[type\]<=1\)\)break/);
});
