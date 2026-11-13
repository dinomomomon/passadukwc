import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {latestDashboardRecords,dashboardRecordTotals} from './dashboard-recent.js';

const mk=(n,extras={})=>({
 id:String(n),kind:n%2?'purchase':'hire',document_date:'2026-11-01',
 created_at:new Date(Date.UTC(2026,10,n,9,0,0)).toISOString(),
 total_satang:10000,...extras
});
test('dashboard shows latest TEN records in strictly descending saved time without mutating source',()=>{
 const originals=Array.from({length:14},(_,i)=>mk(i+1));
 const copy=originals.slice();
 const got=latestDashboardRecords(originals);
 assert.equal(got.length,10);
 assert.deepEqual(got.map(x=>x.id),['14','13','12','11','10','9','8','7','6','5']);
 assert.deepEqual(originals,copy);
});
test('deleted items never appear and fallbacks use document date for demo records',()=>{
 const data=[mk(1),mk(2,{deleted_at:'2026-11-10'}),{id:'old',document_date:'2026-01-01',kind:'purchase'}];
 assert.deepEqual(latestDashboardRecords(data).map(x=>x.id),['1','old']);
 assert.deepEqual(latestDashboardRecords(data,1).map(x=>x.id),['1']);
 assert.equal(latestDashboardRecords(data,500).length,2);
});
test('summary counts only active saved records and retains full satang values',()=>{
 const got=dashboardRecordTotals([mk(1),mk(2),mk(3,{deleted_at:'2026-11-05'}),mk(4,{total_satang:25000})]);
 assert.deepEqual(got,{total:3,purchase:1,hire:2,satang:45000});
 assert.deepEqual(dashboardRecordTotals([]),{total:0,purchase:0,hire:0,satang:0});
});
test('new dashboard is scoped, uses actual school records, and retains all existing actions',async()=>{
 const src=await readFile(new URL('./app.js',import.meta.url),'utf8');
 const start=src.indexOf('function dashboard(){'),end=src.indexOf('function records(){',start);
 assert.ok(start>0&&end>start);
 const dash=src.slice(start,end);
 assert.match(dash,/dashboardRecordTotals\(state\.records\)/);
 assert.match(dash,/latestDashboardRecords\(state\.records,10\)/);
 assert.match(dash,/recordTable\(recent\)/);
 assert.match(dash,/kp-ov-hero/);
 assert.match(dash,/kp-ov-metrics/);
 assert.match(dash,/data-action="registry"/);
 assert.match(dash,/data-action="settings"/);
 assert.match(dash,/data-action="records"/);
 assert.match(dash,/canCreate\(\)/);
 assert.doesNotMatch(dash,/recordTable\(rows\.slice\(0,6\)\)/);
 assert.match(src,/state\.page==='dashboard'\?'kp-dashboard-shell'/);
 assert.match(src,/\.eq\('school_id',state\.school\.id\).*?\.order\('created_at',\{ascending:false\}\)\.limit\(300\)/);
});
test('dashboard responsive CSS is an isolated stylesheet, not a change to A4 government documents',async()=>{
 const [css,html,build]=await Promise.all(['dashboard-pro.css','index.html','build.mjs'].map(name=>readFile(new URL('./'+name,import.meta.url),'utf8')));
 assert.match(html,/dashboard-pro\.css\?v=20261113-v1/);
 assert.match(build,/'dashboard-pro\.css'/);
 assert.match(css,/\.kp-ov-hero\{/);
 assert.match(css,/\.kp-ov-layout\{/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/@media print\{\.kp-dashboard/);
 assert.doesNotMatch(css,/\.paper-page|\.official-table|#print-area/);
});
