import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {depreciation,yearDepreciation,assetInput,cents,parseCsv,rowsToAssets,shiftMonths} from './asset-engine.js';
const read=p=>readFileSync(new URL('./'+p,import.meta.url),'utf8');
const base={asset_code:'คพ-001/2570',name:'คอมพิวเตอร์',acquired_on:'2026-10-01',placed_in_service_on:'2026-10-01',cost_baht:'30,000.00',salvage_baht:'0',useful_life_months:'60',asset_status:'active'};
test('currency parsing preserves integer satang and disallows imprecise inputs',()=>{
 assert.equal(cents('30,000.50'),3000050);assert.equal(cents('0'),0);
 for(const v of ['-1','1.234','hello','1e8'])assert.throws(()=>cents(v));
});
test('school threshold separates controlled register from depreciable capital assets',()=>{
 let a=assetInput(base,{threshold:1000000});
 assert.equal(a.accounting_class,'capitalized');
 assert.equal(assetInput({...base,cost_baht:'9,999.99'},{threshold:1000000}).accounting_class,'controlled');
 assert.throws(()=>assetInput({...base,asset_code:'',cost_baht:'0'}));
 assert.throws(()=>assetInput({...base,salvage_baht:'31,000'}));
 assert.throws(()=>assetInput({...base,placed_in_service_on:'2026-09-30'}));
});
test('straight-line annual and total accumulated depreciation use real dates and clamp by salvage',()=>{
 const a={...assetInput({...base,useful_life_months:'12'},{}),school_id:'demo-school'};
 assert.equal(shiftMonths('2026-10-01',12),'2027-10-01');
 assert.equal(depreciation(a,'2026-09-30').depreciation_satang,0);
 assert.equal(depreciation(a,'2027-10-01').depreciation_satang,3000000);
 assert.equal(depreciation(a,'2028-10-01').net_satang,0);
 const fy=yearDepreciation(a,2570);
 assert.equal(fy.year_satang+yearDepreciation(a,2571).year_satang,3000000);
});
test('controlled and disposed assets are not represented as depreciable balances',()=>{
 let x=assetInput({...base,cost_baht:'8,000'}, {threshold:1000000});
 assert.equal(depreciation(x,'2027-10-01').eligible,false);
 x={...x,accounting_class:'capitalized',asset_status:'disposed'};
 assert.equal(depreciation(x,'2027-10-01').eligible,false);
});
test('CSV parser honors quoted delimiters and Thai UTF-8 characters',()=>{
 const csv='\ufeff"รหัสครุภัณฑ์","ชื่อครุภัณฑ์"\r\n"คพ-001","เครื่องพิมพ์, เลเซอร์"\r\n';
 assert.deepEqual(parseCsv(csv),[['รหัสครุภัณฑ์','ชื่อครุภัณฑ์'],['คพ-001','เครื่องพิมพ์, เลเซอร์']]);
 assert.throws(()=>parseCsv('"unclosed'));
});
test('spreadsheet import validates required headers, duplicate codes, categories and dates before insert',()=>{
 const headers=['รหัสครุภัณฑ์','ชื่อครุภัณฑ์','ราคาทุน','วันที่ได้มา','วันที่พร้อมใช้งาน','อายุใช้งาน(เดือน)','มูลค่าคงเหลือ','ประเภท','เลขเครื่อง','สถานที่','ผู้รับผิดชอบ','หมายเหตุ'];
 const item=['คพ-001','คอมพิวเตอร์','30000','2026-10-01','2026-10-01','60','0','','SN1','ห้อง1','ครูตัวอย่าง',''];
 const ok=rowsToAssets([headers,item],[],1000000);
 assert.equal(ok.assets.length,1);assert.equal(ok.errors.length,0);
 const wrong=rowsToAssets([headers,item,item],[],1000000);assert.match(wrong.errors.join(''),/รหัสครุภัณฑ์ซ้ำ/);
 assert.throws(()=>rowsToAssets([headers.slice(1),item],[],1000000),/ไม่พบหัวคอลัมน์/);
});
test('equipment module provides all five functional pages, CRUD, policies, source, Excel and A4',()=>{
 const ui=read('equipment-module.js'),app=read('app.js');
 for(const s of ['ภาพรวมครุภัณฑ์','ทะเบียนครุภัณฑ์','เพิ่ม / นำเข้าครุภัณฑ์','คำนวณค่าเสื่อมราคา','รายงานทะเบียนครุภัณฑ์ A4','ตั้งค่าประเภทและรหัสครุภัณฑ์'])assert.ok(ui.includes(s),s);
 for(const s of ['equipment_assets','asset_categories','asset_policies','asset-import-confirm','asset-pick-source','asset-print','asset-export','eq-asset-form'])assert.ok(ui.includes(s),s);
 assert.match(ui,/source_procurement_id:store\.source\.record\.id/);
 assert.match(ui,/source_item_index:store\.source\.index/);
 assert.match(ui,/store\.source\.available\[i\]/);
 assert.match(ui,/item\.accounting_class=store\.editing\.accounting_class/);
 assert.match(ui,/asset-category-edit/);
 assert.match(ui,/\['received','completed'\]\.includes\(r\.state\)/);
 assert.match(app,/if\(state\.page==='assets'\|\|state\.page==='asset-guide'\)return equipmentModule\.view\(\)/);
 assert.match(app,/equipmentModule\.submit\(form\)/);
 assert.match(app,/await equipmentModule\.load\(\)/);
});
test('migration is tenant-isolated, preserves procurement rows and captures audit history',()=>{
 const sql=read('../supabase/migrations/20261024013403_equipment_assets_register_20261024.sql');
 for(const name of ['equipment_assets','asset_categories','asset_policies','equipment_asset_history'])assert.match(sql,new RegExp('alter table public\\.'+name+' enable row level security'));
 assert.match(sql,/unique\(school_id,asset_code\)/);
 assert.match(sql,/foreign key\(school_id,category_id\)/);
 assert.match(sql,/source_procurement_id uuid references public\.procurements/);
 assert.match(sql,/is_school_member\(school_id\)/);
 assert.match(sql,/is_school_admin\(school_id\)/);
 assert.match(sql,/equipment_history_trigger/);
 assert.doesNotMatch(sql,/(alter table public\.procurements|delete from public\.procurements|update public\.procurements)/i);
});
