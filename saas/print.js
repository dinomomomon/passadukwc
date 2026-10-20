/* Official school procurement templates: source forms, 20 Oct 2569.
   All changing facts come from the stored record/metadata; never infer approvals. */
export function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const e=escapeHtml, blank='........................................';
const v=(x,f=blank)=>x===undefined||x===null||String(x).trim()===''?f:e(x);
const amt=x=>Number(x||0)/100;
const cash=x=>Number(amt(x)).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
const baht=x=>Number(x).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
const monthThai=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
function thaiDate(date){if(!date)return blank;const m=/^(\d{4})-(\d\d)-(\d\d)$/.exec(String(date));if(!m)return e(date);return Number(m[3])+' '+monthThai[Number(m[2])-1]+' '+(Number(m[1])<2400?Number(m[1])+543:Number(m[1]));}
const digits=['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'],pos=['','สิบ','ร้อย','พัน','หมื่น','แสน'];
function sixWords(num){let s=String(num).padStart(1,'0'),out='';for(let i=0;i<s.length;i++){const n=Number(s[i]),place=s.length-i-1;if(!n)continue;if(place===1&&n===1){out+='สิบ';continue;}if(place===1&&n===2){out+='ยี่สิบ';continue;}if(place===0&&n===1&&s.length>1){out+='เอ็ด';continue;}out+=digits[n]+pos[place];}return out;}
function integerWords(n){n=Math.floor(Number(n)||0);if(n===0)return digits[0];const mil=Math.floor(n/1000000),rest=n%1000000;return (mil?integerWords(mil)+'ล้าน':'')+(rest?sixWords(rest):'');}
export function thaiBahtText(satang){let n=Math.round(Number(satang)||0);if(n<0)return 'ลบ'+thaiBahtText(-n);let b=Math.floor(n/100),s=n%100;return (b?integerWords(b):'ศูนย์')+'บาท'+(s?integerWords(s)+'สตางค์':'ถ้วน');}
/** The official prefix (พว.) is NOT itself a document number.
 * Old records may have saved "พว. 1/2569" in the prefix field.
 * Normalize at render time too, so printing historic records is safe.
 */
export function normalizeMemoPrefix(raw){
 let prefix=String(raw??'').trim().replace(/\s+/g,' ');
 const firstReference=prefix.search(/[0-9๐-๙]+\s*\/\s*[0-9๐-๙]{2,4}/u);
 if(firstReference>=0)prefix=prefix.slice(0,firstReference).trim();
 return prefix.replace(/\s*[0-9๐-๙]+$/u,'').replace(/[\s,;]+$/u,'').trim();
}
export function memoNumberTokens(raw){
 return [...String(raw??'').matchAll(/[0-9๐-๙]+\s*\/\s*[0-9๐-๙]{2,4}/gu)]
  .map(match=>match[0].replace(/\s/g,''));
}
export function normalizeMemoNumber(raw,prefix=''){
 const original=String(raw??'').trim();
 const numbers=memoNumberTokens(original);
 if(numbers.length)return numbers[numbers.length-1];
 const normalizedPrefix=normalizeMemoPrefix(prefix);
 let value=original;
 if(normalizedPrefix&&value.startsWith(normalizedPrefix))value=value.slice(normalizedPrefix.length).trim();
 return value.replace(/^ที่\s*/u,'').trim();
}
export function renderMemoReference(prefix,number){
 const code=normalizeMemoPrefix(prefix);
 const ref=normalizeMemoNumber(number,code)||'........../........';
 return [code,ref].filter(Boolean).join(' ');
}
function meta(r){return r.document_meta&&typeof r.document_meta==='object'&&!Array.isArray(r.document_meta)?r.document_meta:{};}
const numericMoney=x=>x!==undefined&&x!==null&&String(x).trim()!==''&&Number.isFinite(Number(x))&&Number(x)>=0;
function moneyField(m,key){return numericMoney(m[key])?baht(Number(m[key])):'–';}
function paymentNetSatang(r){const m=meta(r);if(numericMoney(m.payable_baht))return Math.round(Number(m.payable_baht)*100);const withholding=numericMoney(m.withholding_baht)?Number(m.withholding_baht):0,fine=numericMoney(m.fine_baht)?Number(m.fine_baht):0;return Math.max(0,Number(r.total_satang)-Math.round(withholding*100)-Math.round(fine*100));}
function payableAmount(r){const n=paymentNetSatang(r);return n===null?'–':cash(n);}
function basePriceAmount(r){const m=meta(r);if(numericMoney(m.vat_baht))return baht(Math.max(0,amt(r.total_satang)-Number(m.vat_baht)));return numericMoney(m.item_base_baht)?moneyField(m,'item_base_baht'):cash(r.total_satang);}
function officer(r,s){return v(r.signers?.officer||s.officer_name);}
function head(r,s){return v(r.signers?.head||s.head_name);}
function director(r,s){return v(r.signers?.director||s.director_name);}
function officialLocation(s){const d=String(s.district||'').trim(),p=String(s.province||'').trim();return [d?(/^(อ\.|อำเภอ)/.test(d)?d:'อ.'+d):'',p?(/^(จ\.|จังหวัด|กรุงเทพมหานคร)/.test(p)?p:'จ.'+p):''].filter(Boolean).join('  ');}
function department(s){return e(s.name||'โรงเรียน')+(officialLocation(s)?'  '+e(officialLocation(s)):'');}
function schoolAddress(s){return v(s.address||officialLocation(s));}
function signatureBlock(name,role='',date=false,opts={}){
 const kind=opts.kind||'';
 const label=(kind==='director'||kind==='payment')?'<div class="gov-director-position kp-signature-position kp-director-one-line">ผู้อำนวยการ'+e(opts.schoolName||'โรงเรียน')+'</div>':
 '<div class="signature-role kp-signature-position">'+role+'</div>'+
 (opts.position?'<div class="signature-subrole kp-signature-position">'+opts.position+'</div>':'');
 const css=kind==='director'?' gov-director-card':kind==='payment'?' gov-payment-signature':'';
 const write=kind==='director'?'gov-director-writing':kind==='payment'?'gov-payment-signline':'signature-writing';
 const line=kind==='director'||kind==='payment'?'gov-director-rule':'signature-rule';
 const nameLen=String(name).replace(/<[^>]*>/g,'').length;
 const compact=nameLen>35?' kp-signature-compact':'';
 return '<div class="signature-card kp-signature'+css+compact+'">'+
 '<div class="'+write+'">ลงชื่อ <span class="'+line+'"></span></div>'+
 '<div class="signature-name">('+name+')</div>'+label+
 (date?'<div class="signature-date">วันที่ <span class="date-rule"></span></div>':'')+'</div>';
}
function sign(name,role,date=false,position=''){return signatureBlock(name,role,date,{position});}
function directorSign(r,s,actions){return '<div class="director-sign"><div class="director-action">'+actions+'</div>'+
 signatureBlock(director(r,s),'',true,{kind:'director',schoolName:s.name||'โรงเรียน'})+'</div>';}
function signRow(r,s){return '<div class="sign-grid">'+sign(officer(r,s),'เจ้าหน้าที่',true)+sign(head(r,s),'หัวหน้าเจ้าหน้าที่',true)+'</div>';}
function memo(r,s,title,body,signatureHtml,cls=''){const m=meta(r);const numberKey=cls==='gov-approval'?'approval_memo_number':cls==='gov-payment'?'payment_memo_number':'memo_number';const prefix=m.memo_prefix||s.memo_prefix;const no=numberKey==='memo_number'?renderMemoReference(prefix,m[numberKey]):(normalizeMemoNumber(m[numberKey],prefix)||'........../........');
 return '<section class="paper-page official gov-doc memo-page '+cls+'"><div class="doc-sheet-body">'+
 '<div class="memo-top"><img class="garuda-emblem" src="/garuda-memo.svg" alt="ตราครุฑ"><h1>บันทึกข้อความ</h1></div>'+
 '<div class="memo-field memo-field-agency"><strong>ส่วนราชการ</strong><span class="memo-value">'+department(s)+'</span></div>'+
 '<div class="memo-field memo-field-number"><strong>ที่</strong><span class="memo-value">'+e(no)+'</span><strong class="date-label">วันที่</strong><span class="memo-value">'+thaiDate(r.document_date)+'</span></div>'+
 '<div class="memo-field memo-field-subject"><strong>เรื่อง</strong><span class="memo-value">'+e(title)+'</span></div>'+
 '<div class="memo-line"></div><div class="memo-field memo-field-to"><strong>เรียน</strong><span class="memo-value">ผู้อำนวยการ'+e(s.name||'โรงเรียน')+'</span></div>'+
 '<div class="memo-content">'+body+'</div><div class="memo-signatures">'+signatureHtml+'</div></div></section>';}
function page(title,body,cls=''){return '<section class="paper-page official gov-doc '+cls+'"><div class="doc-sheet-body"><h2 class="print-title">'+e(title)+'</h2>'+body+'</div></section>';}
function lawLine(text){return '<p class="gov-law">'+e(text)+'</p>';}
function dataHead(r,s,kind){const m=meta(r),isAcceptance=kind==='acceptance';
 const number=isAcceptance?(m.acceptance_number||'ร. ........../'+String((Number(String(r.document_date||'').slice(0,4))||2026)+543)):(m.requisition_number||blank);
 const date=isAcceptance?(m.acceptance_date||m.inspection_date||m.delivery_date):(m.requisition_date||m.delivery_date);
 return '<div class="gov-right-head"><div>'+(isAcceptance?'ใบตรวจรับ เลขที่':'ใบเบิก เลขที่')+' '+v(number)+'</div><div>วันที่ '+(date?thaiDate(date):blank)+'</div><div>ส่วนราชการ '+e(s.name||'โรงเรียน')+'</div><div>ที่อยู่ '+schoolAddress(s)+'</div></div>';
}
function itemTable(r,kind='annex',height=85){
 const priced=kind==='annex',items=r.items||[],offset=r.__item_offset||0,showTotals=r.__show_totals!==false;
 const rows=items.map((x,i)=>'<tr class="gov-data-row"><td class="center">'+(offset+i+1)+'</td><td>'+e(x.name)+'</td><td class="center">'+e(x.qty)+'</td><td class="center">'+e(x.unit)+'</td>'+(priced?'<td class="right">'+cash(x.price_satang)+'</td><td class="right">'+cash(Math.round(Number(x.qty)*Number(x.price_satang)))+'</td>':'<td></td>')+'</tr>').join('');
 const filler=height>0?'<tr class="table-filler" style="height:'+height+'mm">'+Array.from({length:priced?6:5},()=>'<td>&nbsp;</td>').join('')+'</tr>':'';
 const m=meta(r),subtotal=basePriceAmount(r);
 const total=priced&&showTotals?'<tr class="gov-summary-start"><td rowspan="3" colspan="4" class="gov-money-words">('+e(thaiBahtText(r.total_satang))+')</td><td class="gov-summary-label">รวมเป็นเงิน</td><td class="right">'+subtotal+'</td></tr><tr><td class="gov-summary-label">ภาษีมูลค่าเพิ่ม</td><td class="right">'+moneyField(m,'vat_baht')+'</td></tr><tr><td class="gov-summary-label">รวมเป็นเงินทั้งสิ้น</td><td class="right">'+cash(r.total_satang)+'</td></tr>':'';
 // Each A4 table has fixed, explicit column widths. Previous order column
 // was only 7%, causing the Thai word "ลำดับ" to break after two characters.
 const cols='<colgroup><col class="col-order"><col class="col-description"><col class="col-quantity"><col class="col-unit">'+
  (priced?'<col class="col-price"><col class="col-total">':'<col class="col-note">')+'</colgroup>';
 return '<table class="official-table official-table-ruled gov-items '+(priced?'gov-price-table':'gov-requisition-table')+'">'+cols+
 '<thead><tr><th class="col-order">ลำดับ</th><th class="col-description">รายละเอียดและคุณลักษณะ</th><th class="col-quantity">จำนวน</th><th class="col-unit">หน่วย</th>'+
 (priced?'<th class="col-price">ราคาต่อหน่วย</th><th class="col-total">จำนวนเงิน</th>':'<th class="col-note">หมายเหตุ</th>')+'</tr></thead><tbody>'+rows+filler+total+'</tbody></table>';
}
function pageChunks(items,size){const all=Array.isArray(items)?items:[],chunks=[];for(let i=0;i<all.length;i+=size)chunks.push({items:all.slice(i,i+size),offset:i});return chunks.length?chunks:[{items:[],offset:0}];}
function fillerHeight(items,baseline,perItem){const arr=items||[],lines=arr.reduce((n,x)=>n+Math.max(0,Math.ceil(String(x.name||'').length/55)-1),0);return Math.max(0,baseline-Math.max(0,arr.length-1)*perItem-lines*7);}

function purchaseRequest(r,s,buy){const verb=buy?'ซื้อ':'จ้าง',item=buy?'พัสดุ':'งานจ้าง',title=buy?'รายงานขอซื้อพัสดุ':'รายงานขอจ้าง';
const law='พระราชบัญญัติการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 มาตรา 56 วรรคหนึ่ง (2) (ข) และระเบียบกระทรวงการคลังฯ พ.ศ. 2560 ข้อ 22 ข้อ 79 และข้อ 25 (5)';
const line='<p class="indent">ด้วย '+v(r.department,'กลุ่มงาน/ฝ่ายที่ขอ')+' มีความประสงค์จะ'+(buy?'ซื้อพัสดุ':'จ้าง')+' จำนวน '+(r.items||[]).length+' รายการ เพื่อ '+v(r.reason,'ใช้ในการดำเนินงานของโรงเรียน')+' ซึ่งได้รับอนุมัติเงินจาก '+v(r.budget_source) +' เป็นเงิน '+cash(r.total_satang)+' บาท</p>';
const body=line+'<p class="indent">งานพัสดุได้ตรวจสอบแล้วเห็นควรจัด'+verb+'ตามเสนอ และเพื่อให้เป็นไปตาม'+law+' จึงขอรายงานขอ'+verb+' ดังนี้</p>'+
 '<ol class="gov-numbered"><li>เหตุผลและความจำเป็นที่ต้อง'+verb+' คือ '+v(r.reason)+'</li>'+
 '<li>รายละเอียด'+item+' จำนวน '+(r.items||[]).length+' รายการ ตามรายละเอียดแนบท้าย</li>'+
 '<li>ราคากลางของ'+item+'ที่จะ'+verb+' เป็นเงิน '+cash(r.total_satang)+' บาท</li>'+
 '<li>วงเงินที่จะ'+verb+'ครั้งนี้ '+cash(r.total_satang)+' บาท ('+e(thaiBahtText(r.total_satang))+')</li>'+
 '<li>กำหนดเวลาที่ต้องการใช้'+item+' ในวันที่ '+(r.due_date?thaiDate(r.due_date):blank)+'</li>'+
 '<li>จัด'+verb+'โดยวิธีเฉพาะเจาะจง เนื่องจากวงเงินไม่เกิน 500,000 บาท ตามกฎกระทรวงกำหนดวงเงินการจัดซื้อจัดจ้างพัสดุโดยวิธีเฉพาะเจาะจงฯ พ.ศ. 2560 ข้อ 1</li>'+
 '<li>หลักเกณฑ์การพิจารณาคัดเลือกข้อเสนอ คือ ใช้เกณฑ์ราคา</li>'+
 '<li>ข้อเสนออื่น ๆ เห็นควรแต่งตั้งผู้ตรวจรับ'+item+' ตามเสนอ</li></ol>'+
 '<p class="indent">จึงเรียนมาเพื่อโปรดพิจารณา</p>'+
 '<ol class="gov-numbered"><li>เห็นชอบในรายงานขอ'+verb+'ดังกล่าวข้างต้น</li>'+
 '<li>อนุมัติให้แต่งตั้ง '+v(r.inspector_name)+' ตำแหน่ง '+v(meta(r).inspector_position)+' เป็นผู้ตรวจรับ'+item+'</li></ol>';
return memo(r,s,title,body,signRow(r,s)+directorSign(r,s,'เห็นชอบ &nbsp;&nbsp; อนุมัติ'),'gov-request');}
function annex(r,s,buy){const noun=buy?'พัสดุที่จะซื้อ':'งานจ้าง',subject=buy?'รายงานขอซื้อ':'รายงานขอจ้าง',chunks=pageChunks(r.items,Math.max(1,Math.min(9,Number(r.__items_per_page)||9)));
 return chunks.map((part,i)=>page('รายละเอียดของ'+noun+' แนบท้าย'+subject,
 lawLine('ตามระเบียบกระทรวงการคลัง ว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560')+'<p class="gov-law gov-law-second">ข้อ 22 วรรคหนึ่ง (2) และข้อ 22 วรรคสอง</p>'+
 '<p class="gov-count">จำนวน'+(buy?'พัสดุ':'งานจ้าง')+' '+(r.items||[]).length+' รายการ'+(chunks.length>1?' (หน้าที่ '+(i+1)+'/'+chunks.length+')':'')+'</p>'+
 itemTable({...r,items:part.items,__item_offset:part.offset,__show_totals:i===chunks.length-1},'annex',fillerHeight(part.items,90,9))+
 '<div class="gov-annex-sign">'+signRow(r,s)+'</div>','gov-annex')).join('');
}
function approval(r,s,buy){const verb=buy?'ซื้อ':'จ้าง',noun=buy?'พัสดุ':'งานจ้าง',m=meta(r),vendor=v(r.vendor_name);
const body='<p class="indent">ตามที่ ผู้อำนวยการ'+e(s.name||'โรงเรียน')+' เห็นชอบ'+(buy?'รายงานขอซื้อพัสดุ':'รายงานขอจ้าง')+' จำนวน '+(r.items||[]).length+' รายการ เป็นเงิน '+cash(r.total_satang)+' บาท ('+e(thaiBahtText(r.total_satang))+') ตามระเบียบกระทรวงการคลังฯ พ.ศ. 2560 ข้อ 24 รายละเอียดดังแนบ</p>'+
 '<p class="indent">ในการนี้เจ้าหน้าที่ได้เจรจาตกลงราคากับ '+vendor+' ซึ่งมีอาชีพ'+(buy?'ขาย':'รับจ้าง')+'แล้ว ปรากฏว่าเสนอราคาเป็นเงิน '+cash(r.total_satang)+' บาท ('+e(thaiBahtText(r.total_satang))+')</p>'+
 '<p class="indent">ดังนั้น เพื่อให้เป็นไปตามระเบียบกระทรวงการคลัง ว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 79 จึงเห็นควรจัด'+verb+'จากผู้เสนอราคารายดังกล่าว</p>'+
 '<p class="indent">จึงเรียนมาเพื่อโปรดทราบ และพิจารณาเห็นชอบ</p>'+
 '<ol class="gov-numbered"><li>ให้สั่ง'+verb+(buy?'พัสดุ':'')+'จาก '+vendor+' ในวงเงิน '+cash(r.total_satang)+' บาท ('+e(thaiBahtText(r.total_satang))+') กำหนดส่งมอบภายในวันที่ '+(r.due_date?thaiDate(r.due_date):blank)+'</li>'+
 '<li>ลงนามใน'+(buy?'ใบสั่งซื้อ':'ใบสั่งจ้าง')+' ดังแนบ</li></ol>';
const signatures='<div class="gov-vertical-sign">'+sign(officer(r,s),'เจ้าหน้าที่',true)+sign(head(r,s),'หัวหน้าเจ้าหน้าที่',true)+'</div>'+directorSign(r,s,'เห็นชอบ<br>ลงนามแล้ว');
return memo(r,s,'รายงานผลการพิจารณาและขออนุมัติสั่ง'+verb,body,signatures,'gov-approval');}
function acceptance(r,s,buy){const noun=buy?'พัสดุ':'งานจ้าง',vendor=v(r.vendor_name),m=meta(r);const dd= r.due_date?thaiDate(r.due_date):blank;
const body=lawLine('ตามระเบียบกระทรวงการคลัง ว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 175')+
 dataHead(r,s,'acceptance')+
 '<p class="indent">ตามที่ '+e(s.name||'โรงเรียน')+' ได้'+(buy?'จัดซื้อพัสดุ':'จัดจ้าง')+' จำนวน '+(r.items||[]).length+' รายการ จาก '+vendor+' ตาม'+(buy?'ใบสั่งซื้อ':'ใบสั่งจ้าง')+'เลขที่ '+v(m.order_number)+' ลงวันที่ '+(m.order_date?thaiDate(m.order_date):blank)+' ผู้ตรวจรับได้ดำเนินการตรวจรับ'+noun+' ตามรายละเอียด ดังนี้</p>'+
 '<ol class="gov-numbered gov-inspection-list"><li>'+noun+'ครบกำหนดส่งมอบในวันที่ '+dd+'</li>'+
 '<li>ผู้'+(buy?'ขาย':'รับจ้าง')+' ทำการส่งมอบเมื่อวันที่ '+(m.delivery_date?thaiDate(m.delivery_date):blank)+' ณ '+v(m.inspection_location,'สถานที่ส่งมอบตามเอกสาร')+'</li>'+
 '<li>ได้ทำการตรวจรับตามใบส่งของ/ใบสำคัญรับเงิน/ใบเสร็จรับเงิน เลขที่ '+v(m.invoice_number)+' ลงวันที่ '+(m.invoice_date?thaiDate(m.invoice_date):blank)+'</li>'+
 '<li>ได้ถือว่า'+noun+'ถูกต้องครบถ้วนเมื่อวันที่ '+((m.inspection_date||m.delivery_date)?thaiDate(m.inspection_date||m.delivery_date):blank)+'</li>'+
 '<li>ได้เชิญผู้ชำนาญการหรือผู้ทรงคุณวุฒิมาปรึกษาด้วยคือ '+v(m.inspection_expert,'–')+'</li>'+
 '<li>ได้มอบ'+noun+'ที่ตรวจรับให้เจ้าหน้าที่ พร้อมทำใบตรวจรับโดยลงชื่อไว้เป็นหลักฐาน มอบให้แก่ผู้ขาย/ผู้รับจ้าง 1 ฉบับ และเจ้าหน้าที่ 1 ฉบับ</li></ol>'+
 '<p class="indent">จึงเรียนมาเพื่อโปรดทราบ และพิจารณาให้ดำเนินการเบิกจ่ายเงินให้แก่ผู้'+(buy?'ขาย':'รับจ้าง')+' ตามระเบียบของหน่วยงานต่อไป</p>'+
 '<div class="gov-inspector-sign">'+sign(v(r.inspector_name),'ผู้ตรวจรับ'+noun,true)+'</div>'+
 '<div class="gov-half-rule"></div><p><b>เรียน</b> &nbsp; ผู้อำนวยการ'+e(s.name||'โรงเรียน')+'</p>'+
 '<p class="indent">ผู้ตรวจรับได้ตรวจรับ'+noun+' ตามระเบียบกระทรวงการคลังฯ พ.ศ. 2560 ข้อ 175 แล้ว เห็นสมควรจ่ายเงินให้แก่ผู้'+(buy?'ขาย':'รับจ้าง')+' รายละเอียดดังนี้ มูลค่าสินค้า '+basePriceAmount(r)+' บาท ภาษีมูลค่าเพิ่ม '+moneyField(m,'vat_baht')+' บาท รวมจำนวนเงิน '+cash(r.total_satang)+' บาท หักภาษี ณ ที่จ่าย '+moneyField(m,'withholding_baht')+' บาท หักค่าปรับ '+moneyField(m,'fine_baht')+' บาท คงเหลือจ่ายจริง '+payableAmount(r)+' บาท</p>'+
 '<div class="gov-inspection-bottom">'+signRow(r,s)+directorSign(r,s,'เห็นชอบ<br>อนุมัติ')+'</div>';
return page('ใบตรวจรับ'+noun,body,'gov-acceptance');}
function payment(r,s,buy){const verb=buy?'ซื้อ':'จ้าง',noun=buy?'พัสดุ':'งานจ้าง',m=meta(r),vendor=v(r.vendor_name);
const body='<p class="indent">ตามที่ได้อนุมัติให้'+(buy?'จัดซื้อพัสดุ':'จัดจ้าง')+' จำนวน '+(r.items||[]).length+' รายการ จาก '+vendor+' เป็นเงิน '+cash(r.total_satang)+' บาท ตาม'+(buy?'ใบสั่งซื้อ':'ใบสั่งจ้าง')+'เลขที่ '+v(m.order_number)+' ลงวันที่ '+(m.order_date?thaiDate(m.order_date):blank)+' ซึ่งครบกำหนดส่งมอบเมื่อวันที่ '+(r.due_date?thaiDate(r.due_date):blank)+' นั้น</p>'+
 '<p class="indent">บัดนี้ ผู้'+(buy?'ขาย':'รับจ้าง')+'ได้ส่งมอบ'+noun+' ตามใบส่งของ/ใบเสร็จ เลขที่ '+v(m.invoice_number)+' ลงวันที่ '+(m.invoice_date?thaiDate(m.invoice_date):blank)+' ผู้ตรวจรับ'+noun+'ได้ทำการตรวจรับ'+noun+'ไว้แล้ว ปรากฏว่าครบถ้วนถูกต้อง เมื่อวันที่ '+((m.inspection_date||m.delivery_date)?thaiDate(m.inspection_date||m.delivery_date):blank)+' ดังหลักฐานการตรวจรับที่แนบ</p>'+
 '<p class="indent">จึงเรียนมาเพื่อโปรด</p><ol class="gov-numbered"><li>ทราบผลการตรวจรับ'+noun+'</li>'+
 '<li>อนุมัติจ่ายเงินให้แก่ '+vendor+' เป็นเงิน '+payableAmount(r)+' บาท ('+e(thaiBahtText(paymentNetSatang(r)))+') รายละเอียดดังนี้</li></ol>'+
 '<div class="gov-money-list">'+[
 ['มูลค่าสินค้า',basePriceAmount(r)],
 ['บวก ภาษีมูลค่าเพิ่ม',moneyField(m,'vat_baht')],['จำนวนเงินที่ขอเบิก',cash(r.total_satang)],
 ['หัก ภาษีเงินได้',moneyField(m,'withholding_baht')],['ค่าปรับ',moneyField(m,'fine_baht')],
 ['คงเหลือจ่ายจริง',payableAmount(r)]
 ].map(row=>'<div><span>'+row[0]+'</span><span>'+row[1]+'</span><span>บาท</span></div>').join('')+'</div>'+

 '<div class="gov-finance-title">ความเห็นของเจ้าหน้าที่การเงิน</div>'+
 '<p class="indent">ได้ตรวจสอบหลักฐานแล้ว มีเอกสารครบถ้วน และมีเงินตามกิจกรรม/โครงการ '+v(r.budget_source||m.budget_activity||m.budget_project)+' ปีงบประมาณ '+v(r.fiscal_year||m.budget_year)+'</p>'+
 '<p>เป็นเงิน '+moneyField(m,'budget_total_baht')+' บาท จ่ายไปแล้ว '+moneyField(m,'budget_paid_baht')+' บาท จ่ายครั้งนี้ '+payableAmount(r)+' บาท คงเหลืองบประมาณ '+(numericMoney(m.budget_total_baht)&&numericMoney(m.budget_paid_baht)&&paymentNetSatang(r)!==null?baht(Math.max(0,Number(m.budget_total_baht)-Number(m.budget_paid_baht)-paymentNetSatang(r)/100)):'–')+' บาท</p>'+
 '<p class="indent">เห็นสมควรอนุมัติเบิกจ่ายเงินให้แก่ '+vendor+' เป็นเงิน '+payableAmount(r)+' บาท ('+(paymentNetSatang(r)!==null?e(thaiBahtText(paymentNetSatang(r))):blank)+')</p>'+
 (String(m.finance_note||'').trim()?'<p class="gov-finance-extra-note">หมายเหตุเพิ่มเติม '+v(m.finance_note)+'</p>':'');
// Original form: approval decisions at left are horizontally aligned with the
// finance officer's signature at right. DIRECTOR signs underneath at left.
// Keep the three related blocks together; no absolute offsets or float hacks.
const approvalPart='<div class="gov-payment-director">'+
 '<div class="gov-payment-approval-top">'+
 '<div class="gov-payment-decision">1. ทราบ<br>2. อนุมัติจ่ายเงิน</div>'+
 '<div class="gov-finance-sign"><div class="gov-finance-wrap">'+
 signatureBlock(v(s.finance_name),'เจ้าหน้าที่การเงิน',true)+'</div></div>'+
 '</div><div class="gov-payment-director-sign">'+
 signatureBlock(director(r,s),'',true,{kind:'payment',schoolName:s.name||'โรงเรียน'})+
 '</div></div>';
return memo(r,s,'ทราบผลและขออนุมัติเบิกจ่าย',body,approvalPart,'gov-payment');}
function requisition(r,s){const m=meta(r),requester=v(m.requester_name),issuer=v(m.issuer_name,s.head_name?e(s.head_name):blank),receiver=v(m.receiver_name||m.delegate_name),chunks=pageChunks(r.items,Math.max(1,Math.min(9,Number(r.__items_per_page)||9)));
 return chunks.map((part,i)=>{
 const top=lawLine('ตามระเบียบกระทรวงการคลัง ว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 204 และ ข้อ 205')+
 dataHead(r,s,'requisition')+
 '<p class="gov-request-text">ข้าพเจ้าขอเบิกพัสดุ '+v(r.reason,'ใช้ในกิจกรรมภายในโรงเรียน')+' ตามรายการต่อไปนี้'+(chunks.length>1?' (หน้าที่ '+(i+1)+'/'+chunks.length+')':'')+'</p>'+
 itemTable({...r,items:part.items,__item_offset:part.offset},'requisition',fillerHeight(part.items,96,9));
 const signatures='<div class="gov-requisition-signatures">'+
 '<div>'+sign(requester,'ผู้เบิก',true,m.requester_position?v(m.requester_position):'')+'</div>'+
 '<div>'+sign(issuer,'ผู้สั่งจ่าย',true,v(m.issuer_position,'หัวหน้าหน่วยพัสดุ'))+'</div>'+
 '<div><p>ได้มอบให้ '+v(m.delegate_name)+' เป็นผู้รับของแทน</p>'+sign(blank,'ผู้มอบ',true)+'</div>'+
 '<div><p>ได้รับพัสดุครบถ้วนถูกต้องแล้ว</p>'+sign(receiver,'ผู้รับของ',true)+'</div></div>';
 return page('ใบเบิกพัสดุ',top+signatures,'gov-requisition');}).join('');
}
export function buildDocuments(r,s){const buy=r.kind==='purchase';return [
 purchaseRequest(r,s,buy),annex(r,s,buy),approval(r,s,buy),acceptance(r,s,buy),payment(r,s,buy)
 ].concat(buy?[requisition(r,s)]:[]).join('');}
