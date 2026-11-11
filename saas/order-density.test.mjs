import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDocuments,OFFICIAL_ITEMS_PER_PAGE} from './print.js';

const school={name:'โรงเรียนกาวิละวิทยาลัย',head_name:'หัวหน้าเจ้าหน้าที่',director_name:'ผู้อำนวยการ'};
const descriptions=[
 'เครื่องปริ้น Canon G2010 หัวพิมพ์ดำ (รับซ่อม)',
 'เครื่องปริ้น Canon G2010 หัวพิมพ์สีไม่ออกและหัวพิมพ์ดำ (รับซ่อม)',
 'เครื่องปริ้น Canon G2000 หัวพิมพ์ (ตรวจสอบและซ่อม)',
 'เครื่องปริ้น Canon G2000 หัวพิมพ์สี Clear Counter',
 'เครื่องปริ้น Epson L3110 หัวพิมพ์ไม่ออก ทุกหน้าเป็นจุด',
 'เครื่องปริ้น Canon G2000 หัวพิมพ์ดำ (ซ่อมบำรุง)'
];
const rec={kind:'hire',document_date:'2026-11-03',title:'งานซ่อมบำรุงเครื่องพิมพ์',
 vendor_name:'ร้านซ่อมเครื่องพิมพ์',vendor_address:'เชียงใหม่',
 items:descriptions.map(name=>({name,qty:1,unit:'เครื่อง',price_satang:171200})),
 total_satang:1027200,document_meta:{}};
const orderPages=html=>[...html.matchAll(/<section class="paper-page official gov-doc gov-order">([\s\S]*?)<\/section>/g)].map(x=>x[1]);
test('15 is a hard maximum, six descriptive hire items start on one complete order page',()=>{
 assert.equal(OFFICIAL_ITEMS_PER_PAGE,15);
 const pages=orderPages(buildDocuments(rec,school));
 assert.equal(pages.length,1);
 assert.equal((pages[0].match(/class="gov-data-row"/g)||[]).length,6);
 for(const name of ['order-totals','order-terms','order-signatures'])assert.ok(pages[0].includes('class="'+name+'"'));
});
test('non-final order pages have no artificial blank 80mm filler',()=>{
 const twenty={...rec,items:Array.from({length:20},(_,i)=>({
 name:'เครื่องพิมพ์ รายการที่ '+(i+1),qty:1,unit:'เครื่อง',price_satang:171200
 })),total_satang:3424000};
 const pages=orderPages(buildDocuments(twenty,school));
 assert.equal(pages.length,2);
 assert.match(pages[0],/class="table-filler" style="height:0mm"/);
 assert.doesNotMatch(pages[0],/class="order-terms"/);
 assert.match(pages[1],/class="order-terms"/);
});
test('only order forms get second fit pass before the item count is reduced',async()=>{
 const js=await readFile(new URL('./app.js',import.meta.url),'utf8');
 const css=await readFile(new URL('./order-forms.css',import.meta.url),'utf8');
 const start=js.indexOf("if(sheet.classList.contains('gov-order'))");
 const retry=js.indexOf('const perFormLimit=',start);
 assert.ok(start>0&&retry>start);
 assert.match(js.slice(start,retry),/sheet\.dataset\.orderFit='compact'/);
 assert.match(js.slice(start,retry),/filler\.style\.height='0mm'/);
 assert.match(js.slice(start,retry),/if\(doesFit\(\)\)return true/);
 assert.match(css,/\.gov-order\[data-order-fit="compact"\] \.order-terms li/);
 assert.match(css,/\.gov-order\[data-order-fit="compact"\] \.order-signatures/);
 assert.doesNotMatch(css.slice(css.indexOf('Order-specific fallback')),/font-size:\s*[0-9.]+/);
});
