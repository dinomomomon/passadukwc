/* Safe satang calculations for purchasing and hiring; no historical backfill. */
export const VAT_MODES=['included','added','none','mixed'];
export const LINE_VAT_MODES=['included','added','none'];
const round=Math.round;
export const satang=v=>round(Number(v)*100);
export const formatSatang=v=>(Number(v)/100).toFixed(2);
const valid=v=>Number.isSafeInteger(v)&&v>=0;
export function calculatePricing(lines,mode='legacy'){
 if(!Array.isArray(lines)||!lines.length||lines.length>100)throw Error('กรุณากรอกจำนวนรายการ 1–100 รายการ');
 if(!['legacy',...VAT_MODES].includes(mode))throw Error('กรุณาเลือกประเภท VAT');
 let total_satang=0,base_satang=0,vat_satang=0;
 const items=lines.map((line,i)=>{
  const qty=Number(line.qty);
  const entered=satang(line.price??(Number(line.entered_price_satang??line.price_satang)/100));
  if(!Number.isFinite(qty)||qty<=0||qty>100000||!valid(entered)||entered<1)throw Error('ราคา/จำนวนรายการที่ '+(i+1)+' ไม่ถูกต้อง');
  const treatment=mode==='mixed'?String(line.vat_treatment||''):mode;
  if(mode!=='legacy'&&!LINE_VAT_MODES.includes(treatment))throw Error('กรุณาเลือก VAT สำหรับรายการที่ '+(i+1));
  const grossUnit=treatment==='added'?round(entered*107/100):entered;
  const gross=round(qty*grossUnit);
  const base=treatment==='included'?gross-round(gross*7/107):treatment==='added'?round(qty*entered):gross;
  if(!valid(grossUnit)||!valid(gross)||gross<=0||!valid(base)||base>gross)throw Error('วงเงินไม่ถูกต้อง');
  total_satang+=gross;base_satang+=base;vat_satang+=gross-base;
  return {name:String(line.name||'').trim(),qty,unit:String(line.unit||'').trim(),price_satang:grossUnit,
   ...(mode==='legacy'?{}:{entered_price_satang:entered,vat_treatment:treatment})};
 });
 if(!valid(total_satang)||!valid(base_satang)||!valid(vat_satang)||total_satang<1)throw Error('วงเงินรวมไม่ถูกต้อง');
 return {items,total_satang,base_satang,vat_satang,mode};
}
export function savedPricing(r){
 const mode=String(r?.document_meta?.vat_mode||'');
 if(!VAT_MODES.includes(mode)||!Array.isArray(r?.items)||!r.items.length)return null;
 let total_satang=0,base_satang=0,vat_satang=0;
 for(const line of r.items){
  const qty=Number(line.qty),gross=round(qty*Number(line.price_satang));
  const entered=Number(line.entered_price_satang);
  const treatment=mode==='mixed'?line.vat_treatment:mode;
  if(!Number.isFinite(qty)||qty<=0||!valid(gross)||!valid(entered)||!LINE_VAT_MODES.includes(treatment))return null;
  const base=treatment==='included'?gross-round(gross*7/107):treatment==='added'?round(qty*entered):gross;
  if(!valid(base)||base>gross)return null;
  total_satang+=gross;base_satang+=base;vat_satang+=gross-base;
 }
 if(!valid(total_satang)||total_satang!==Number(r.total_satang))return null;
 return {total_satang,base_satang,vat_satang,mode};
}
export function payable(gross,meta={}){
 const get=key=>{const x=meta[key];if(x===undefined||x===null||x==='')return 0;const n=satang(x);if(!valid(n))throw Error('จำนวนเงินไม่ถูกต้อง '+key);return n;};
 const discount=get('discount_baht'),tax=get('withholding_baht'),fine=get('fine_baht');
 const expected=Number(gross)-discount-tax-fine;
 if(!valid(Number(gross))||expected<0)throw Error('ยอดหักเกินวงเงินรวม');
 const overridden=meta.payable_baht!==undefined&&meta.payable_baht!=='';
 const net=overridden?get('payable_baht'):expected;
 if(net>gross)throw Error('ยอดจ่ายจริงเกินวงเงิน');
 return {net,expected,discount,tax,fine,overridden};
}
