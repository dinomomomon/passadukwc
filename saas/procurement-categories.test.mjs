import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {schoolProcurementCategories,validateSchoolProcurementCategories,requestPrefixOptions,MAX_SCHOOL_CATEGORIES} from './procurement-categories.js';
import {docMetaInputs} from './document-meta.js';
import {renderMemoReference} from './print.js';

test('legacy school uses existing prefix with equipment fallback, without touching records',()=>{
 assert.deepEqual(schoolProcurementCategories({memo_prefix:'พว.'}),[{name:'วัสดุ',prefix:'พว.'},{name:'ครุภัณฑ์',prefix:'พค.'}]);
 assert.equal(schoolProcurementCategories({memo_prefix:'พก.'})[0].prefix,'พก.');
});
test('one custom category, multiple categories and same-code categories are supported',()=>{
 const only=validateSchoolProcurementCategories([{name:'พัสดุทุกประเภท',prefix:'ศธ.'}]);
 assert.deepEqual(requestPrefixOptions({procurement_categories:only}),[{name:'พัสดุทุกประเภท',prefix:'ศธ.'}]);
 const many=validateSchoolProcurementCategories([{name:'วัสดุ',prefix:'พ.'},{name:'ครุภัณฑ์',prefix:'พ.'},{name:'งานบริการ',prefix:'จบ.'}]);
 assert.deepEqual(requestPrefixOptions({procurement_categories:many}),[{name:'วัสดุ / ครุภัณฑ์',prefix:'พ.'},{name:'งานบริการ',prefix:'จบ.'}]);
 assert.deepEqual(requestPrefixOptions({procurement_categories:only},'พค.')[1],{name:'รหัสเดิมของเอกสารนี้',prefix:'พค.'});
});
test('categories reject empty, too many, duplicate label and an embedded document number',()=>{
 for(const bad of [[],Array.from({length:MAX_SCHOOL_CATEGORIES+1},(_,i)=>({name:'หมวด'+i,prefix:'ก.'})),
   [{name:'วัสดุ',prefix:'พว. 5/2570'}],[{name:'วัสดุ',prefix:''}],
   [{name:'วัสดุ',prefix:'ก.'},{name:'วัสดุ',prefix:'ข.'}]])
  assert.throws(()=>validateSchoolProcurementCategories(bad));
});
test('historical document prefix survives removal or change of current school categories',()=>{
 const school={procurement_categories:[{name:'ทุกหมวด',prefix:'กก.'}]};
 const html=docMetaInputs({memo_prefix:'พค.'},{kind:'purchase',categories:schoolProcurementCategories(school)});
 assert.match(html,/value="พค\." selected/);
 assert.match(html,/รหัสเดิมของเอกสารนี้/);
 assert.equal(renderMemoReference('พค.','5/2570'),'พค. 5/2570');
});
test('UI writes only school configuration and does not change request registry sequence',()=>{
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 assert.match(app,/school-categories-form/);
 assert.match(app,/requestPrefixOptions\(state\.school,chosenRequestPrefix\)/);
 assert.match(app,/procurement_categories:categories,memo_prefix:categories\[0\]\.prefix/);
 assert.match(app,/if\(row\.series==='request'\)return \(normalizeMemoPrefix\(row\.procurements\?\.document_meta\?\.memo_prefix/);
 assert.match(app,/create_procurement/);
});
