import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {calculatePricing,savedPricing,payable,formatSatang} from './tax-calculator.js';
import {buildDocuments} from './print.js';
import {docMetaValue,docMetaWizardInputs,docMetaInputs} from './document-meta.js';
const one={name:'โต๊ะเรียน',qty:1,unit:'ตัว',price:'3100.00'};
const s={name:'โรงเรียนตัวอย่าง',head_name:'หัวหน้าพัสดุ'};
const rec={kind:'purchase',document_date:'2026-10-27',title:'ซื้อโต๊ะ',reason:'ใช้ในโรงเรียน',vendor_name:'ร้านค้า',items:[],total_satang:0,document_meta:{}};
test('VAT included 7/107 is extracted correctly',()=>{
 const x=calculatePricing([one],'included');
 assert.deepEqual([x.base_satang,x.vat_satang,x.total_satang],[289720,20280,310000]);
});
test('VAT added 7% is saved as gross, and editing never adds VAT twice',()=>{
 const x=calculatePricing([one],'added');
 assert.deepEqual([x.base_satang,x.vat_satang,x.total_satang],[310000,21700,331700]);
 const again=calculatePricing(x.items.map(item=>({...item,price:formatSatang(item.entered_price_satang)})),'added');
 assert.deepEqual(again,x);
});
test('no VAT and mixed VAT line modes reconcile without hidden rounding',()=>{
 const none=calculatePricing([one],'none');
 assert.deepEqual([none.base_satang,none.vat_satang,none.total_satang],[310000,0,310000]);
 const mixed=calculatePricing([{...one,vat_treatment:'included'}, {name:'บริการ',qty:1,unit:'งาน',price:'100',vat_treatment:'added'}, {name:'ไม่คิดภาษี',qty:1,unit:'ชิ้น',price:'50',vat_treatment:'none'}],'mixed');
 assert.deepEqual([mixed.base_satang,mixed.vat_satang,mixed.total_satang],[304720,20980,325700]);
 assert.equal(mixed.items.reduce((n,x)=>n+Math.round(x.qty*x.price_satang),0),mixed.total_satang);
 assert.equal(savedPricing({...rec,items:mixed.items,total_satang:mixed.total_satang,document_meta:{vat_mode:'mixed'}}).vat_satang,mixed.vat_satang);
});
test('both official printed forms show VAT and discounted payment without changing contract price',()=>{
 for(const kind of ['purchase','hire']){
  const x=calculatePricing([one],'included');
  const meta={vat_mode:'included',vat_baht:'202.80',item_base_baht:'2897.20',discount_baht:'50.00',withholding_baht:'20.00',fine_baht:'10.00'};
  const html=buildDocuments({...rec,kind,items:x.items,total_satang:x.total_satang,document_meta:meta},s);
  assert.match(html,/2,897.20/);assert.match(html,/202.80/);assert.match(html,/3,100.00/);
  assert.match(html,/หัก ส่วนลดจากยอดจ่าย/);
  assert.match(html,/3,020.00/);
  assert.equal(payable(x.total_satang,meta).net,302000);
 }
});
test('legacy records are not recalculated and invalid money is blocked',()=>{
 const old={...rec,items:[{name:'โต๊ะ',qty:1,unit:'ตัว',price_satang:310000}],total_satang:310000};
 assert.equal(savedPricing(old),null);
 assert.throws(()=>calculatePricing([one],'mixed'),/เลือก VAT/);
 assert.throws(()=>calculatePricing([one],'random'),/VAT/);
 assert.throws(()=>payable(10000,{discount_baht:'100',fine_baht:'1'}),/เกิน/);
 assert.throws(()=>docMetaValue({doc_discount_baht:'-0.01'}),/ไม่ติดลบ/);
 assert.equal(docMetaValue({doc_vat_mode:'legacy'}).vat_mode,'legacy');
});
test('finance panels are shared in purchase and hire, VAT selections on second wizard step',async()=>{
 for(const kind of ['purchase','hire']){
  assert.match(docMetaWizardInputs({},4,kind),/name="doc_discount_baht"/);
  assert.match(docMetaInputs({},{kind}),/name="doc_discount_baht"/);
 }
 const app=await readFile(new URL('./app.js',import.meta.url),'utf8');
 assert.match(app,/id="kp-vat-mode"/);
 assert.match(app,/data-key="vat_treatment"/);
 assert.match(app,/entered_price_satang\?\?x\.price_satang/);
 assert.match(app,/meta\.doc_vat_baht=formatSatang\(pricing\.vat_satang\)/);
 assert.match(app,/calculatePricing\(state\.items,taxMode\)/);
});
