import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {safeSignatureOffset,signatureVerticalLimit} from './template-rich-editor.js';
import {safeTemplateDraft} from './template-builder.js';

test('request director may move down 30mm but lateral and upper limits stay at 15mm',()=>{
 assert.equal(signatureVerticalLimit('director','request'),30);
 assert.deepEqual(safeSignatureOffset({x:99,y:99},'director','request'),{x:15,y:30});
 assert.deepEqual(safeSignatureOffset({x:-99,y:-99},'director','request'),{x:-15,y:-15});
});
test('all other signatures and director on different forms retain 15mm limits',()=>{
 for(const [id,page] of [['staff0','request'],['director','approval'],['director','payment'],['finance','payment'],['requisition0','requisition']]){
  assert.equal(signatureVerticalLimit(id,page),15);
  assert.equal(safeSignatureOffset({y:30},id,page).y,15);
 }
});
test('draft sanitizer only allows extended director Y on request memo, preserves existing offsets',()=>{
 const raw={signatureOffsets:{director:{x:0,y:28},staff0:{x:0,y:30}}};
 assert.equal(safeTemplateDraft(raw,'request').signatureOffsets.director.y,28);
 assert.equal(safeTemplateDraft(raw,'request').signatureOffsets.staff0.y,15);
 assert.equal(safeTemplateDraft(raw,'approval').signatureOffsets.director.y,15);
 assert.deepEqual(safeTemplateDraft({signatureOffsets:{director:{x:2,y:12}}},'request').signatureOffsets.director,{x:2,y:12});
});
test('editor field, preview drag and publishing all honor the same request-specific limit',async()=>{
 const editor=await readFile(new URL('./template-builder.js',import.meta.url),'utf8');
 const app=await readFile(new URL('./app.js',import.meta.url),'utf8');
 assert.match(editor,/signatureVerticalLimit\(activeSignature,selected\)/);
 assert.match(editor,/data-tpl-field="signatureY"/);
 assert.match(editor,/maxSignatureY/);
 assert.match(editor,/safeSignatureOffset\(\{x:now\.x\+x,y:now\.y\+y\},id,selected\)/);
 assert.match(editor,/applySignatureOffsets\(section,t\.signatureOffsets,key\)/);
 assert.match(app,/classList\.contains\('gov-request'\)\?30:15/);
 assert.match(app,/Math\.min\(tePointer\.maxY,/);
 assert.match(app,/Math\.min\(drag\.maxY,/);
});
test('request only gets five millimetres more bottom space in editor, fit check and print',async()=>{
 const css=await readFile(new URL('./request-memo-bottom.css',import.meta.url),'utf8');
 const end=css; // Dedicated stylesheet: all selectors must be limited to request memos.
 assert.match(end,/\.paper-page\.official\.gov-doc\.gov-request\{\s*padding-bottom:10mm;/);
 assert.match(end,/body\.print-measuring #print-area \.paper-page\.official\.gov-doc\.gov-request\{\s*padding-bottom:10mm!important;/);
 assert.match(end,/@media print\{\s*#print-area \.paper-page\.official\.gov-doc\.gov-request\{\s*padding-bottom:10mm!important;/);
 assert.doesNotMatch(end,/padding-top:|padding-left:|padding-right:|font-size:|line-height:/);
});
