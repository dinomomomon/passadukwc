import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDocuments} from './print.js';
import {docMetaWizardInputs,docMetaInputs,docMetaValue} from './document-meta.js';
const school={name:'โรงเรียนกาวิละวิทยาลัย',officer_name:'เจ้าหน้าที่',head_name:'หัวหน้าเจ้าหน้าที่',director_name:'ผู้อำนวยการ',finance_name:'การเงิน'};
const r={kind:'purchase',document_date:'2026-10-26',fiscal_year:2570,document_number:1,title:'ซื้อวัสดุ',department:'กลุ่มบริหารทั่วไป',reason:'ใช้ในโรงเรียน',budget_source:'งบดำเนินงาน',inspector_name:'ผู้ตรวจรับ',vendor_name:'ร้านค้า',items:[{name:'กระดาษ',qty:1,unit:'รีม',price_satang:310000}],total_satang:310000,document_meta:{}};
const dates={sign_request_date:'2026-10-27',sign_annex_date:'2026-10-28',sign_approval_date:'2026-10-29',sign_acceptance_date:'2026-10-30',payment_document_date:'2026-10-31',sign_payment_date:'2026-11-01',sign_requisition_date:'2026-11-02'};
test('user can choose all document dates with date picker',()=>{
 const wizard=docMetaWizardInputs({},4,'purchase'),editor=docMetaInputs({},{kind:'purchase'});
 for(const key of Object.keys(dates)){assert.match(wizard,new RegExp('name="doc_'+key+'" type="date"'));assert.match(editor,new RegExp('name="doc_'+key+'" type="date"'));}
 assert.doesNotMatch(docMetaWizardInputs({},4,'hire'),/name="doc_sign_requisition_date"/);
});
test('date entry validates, persists and can be cleared',()=>{
 const m=docMetaValue(Object.fromEntries(Object.entries(dates).map(([k,v])=>['doc_'+k,v])));
 assert.equal(m.sign_acceptance_date,dates.sign_acceptance_date);
 assert.equal(docMetaValue({doc_sign_acceptance_date:''},m).sign_acceptance_date,undefined);
 for(const x of ['2026-02-30','2026-13-01','27/10/2026'])assert.throws(()=>docMetaValue({doc_sign_request_date:x}),/วันที่ลงนาม/);
});
test('print all six forms with selected signature dates, preserving header document date',()=>{
 const html=buildDocuments({...r,document_meta:dates},school),pages=html.split(/(?=<section class="paper-page)/).filter(x=>x.includes('class="paper-page'));
 assert.equal(pages.length,6);
 [['27 ตุลาคม 2569',3],['28 ตุลาคม 2569',2],['29 ตุลาคม 2569',3],['30 ตุลาคม 2569',4],['1 พฤศจิกายน 2569',2],['2 พฤศจิกายน 2569',4]].forEach(([date,n],i)=>assert.equal(pages[i].split('class="kp-signature-date-value">'+date+'</span>').length-1,n,'sheet '+(i+1)));
 assert.match(pages[4],/class="memo-value">31 ตุลาคม 2569<\/span>/);
 assert.match(pages[0],/class="memo-value">26 ตุลาคม 2569<\/span>/);
});
test('unknown later-stage signature dates remain blank',()=>{
 const pages=buildDocuments(r,school).split(/(?=<section class="paper-page)/).filter(x=>x.includes('class="paper-page'));
 for(const index of [3,4,5])assert.doesNotMatch(pages[index],/kp-signature-date-value/);
 assert.match(pages[4],/kp-payment-date-writein/);
});
