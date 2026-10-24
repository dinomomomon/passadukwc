/* Pure equipment registry rules; Thai school accounting dates, no implied compensation valuation. */
const MS=86400000;
export function toUtcDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s||'')))return null;const [y,m,d]=s.split('-').map(Number);const t=Date.UTC(y,m-1,d);const z=new Date(t);return z.getUTCFullYear()===y&&z.getUTCMonth()+1===m&&z.getUTCDate()===d?t:null;}
export function shiftMonths(s,n){const ms=toUtcDate(s);if(ms===null||!Number.isInteger(n))return null;const d=new Date(ms);const first=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+n,1));const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();first.setUTCDate(Math.min(last,d.getUTCDate()));return first.toISOString().slice(0,10);}
export function depreciation(asset,asOf){
 const cost=Number(asset.cost_satang||0),salvage=Number(asset.salvage_satang||0);
 const useful=Number(asset.useful_life_months||0);
 const start=toUtcDate(asset.placed_in_service_on),end=toUtcDate(asOf);
 const finish=shiftMonths(asset.placed_in_service_on,useful),finishMs=toUtcDate(finish);
 if(!Number.isSafeInteger(cost)||!Number.isSafeInteger(salvage)||cost<0||salvage<0||salvage>cost||!Number.isInteger(useful)||useful<1||useful>600||start===null||end===null||finishMs===null)throw Error('ข้อมูลต้นทุนหรือวันที่คำนวณค่าเสื่อมไม่ถูกต้อง');
 if(asset.accounting_class!=='capitalized')return {depreciation_satang:0,net_satang:cost,base_satang:0,eligible:false,life_end:finish};
 if(asset.asset_status==='disposed'||asset.asset_status==='lost')return {depreciation_satang:0,net_satang:cost,base_satang:0,eligible:false,life_end:finish,note:'จำหน่าย/สูญหาย ต้องพิจารณาบันทึกบัญชีแยกจากตารางค่าเสื่อม'};
 const base=cost-salvage;
 const share=Math.max(0,Math.min(1,(end-start)/Math.max(1,finishMs-start)));
 const dep=Math.max(0,Math.min(base,Math.round(base*share)));
 return {depreciation_satang:dep,net_satang:cost-dep,base_satang:base,eligible:true,life_end:finish};
}
export function yearDepreciation(asset,yearBe){
 const n=Number(yearBe);if(!Number.isInteger(n)||n<2500||n>2700)throw Error('ปีงบประมาณไม่ถูกต้อง');
 const end=(n-543)+'-09-30',prev=(n-544)+'-09-30';
 const a=depreciation(asset,end),b=depreciation(asset,prev);
 return {year_satang:Math.max(0,a.depreciation_satang-b.depreciation_satang),accumulated_satang:a.depreciation_satang,net_satang:a.net_satang,eligible:a.eligible};
}
export const cents=v=>{const raw=String(v??'').trim().replace(/,/g,'');if(!/^\d{1,11}(\.\d{1,2})?$/.test(raw))throw Error('จำนวนเงินต้องเป็นตัวเลขบวก ทศนิยมไม่เกิน 2 ตำแหน่ง');const [a,b='']=raw.split('.');const sat=Number(a)*100+Number((b+'00').slice(0,2));if(!Number.isSafeInteger(sat))throw Error('จำนวนเงินสูงเกินขอบเขต');return sat;};
export function assetInput(data,{threshold=1000000,categories=[]}={}){
 const v=k=>String(data[k]??'').trim(),cost=cents(v('cost_baht')),salvage=cents(v('salvage_baht')||'0');
 if(!v('asset_code')||v('asset_code').length>80||!v('name')||v('name').length>250)throw Error('กรุณากรอกรหัสและชื่อครุภัณฑ์');
 if(cost<=0||salvage>cost)throw Error('ต้นทุนต้องมากกว่า 0 และมูลค่าคงเหลือต้องไม่เกินต้นทุน');
 const life=Number(v('useful_life_months'));if(!Number.isInteger(life)||life<1||life>600)throw Error('อายุใช้งานต้องอยู่ระหว่าง 1–600 เดือน');
 const bought=v('acquired_on'),service=v('placed_in_service_on');
 if(toUtcDate(bought)===null||toUtcDate(service)===null||toUtcDate(service)<toUtcDate(bought))throw Error('วันที่พร้อมใช้งานต้องไม่ก่อนวันที่ได้มา');
 const cat=v('category_id')||null;
 if(cat&&!categories.some(x=>x.id===cat))throw Error('ไม่พบประเภทครุภัณฑ์ของโรงเรียน');
 if(!['active','repair','transferred','disposed','lost'].includes(v('asset_status')||'active'))throw Error('สถานะครุภัณฑ์ไม่ถูกต้อง');
 return {asset_code:v('asset_code'),name:v('name'),category_id:cat,serial_number:v('serial_number').slice(0,150),
  acquired_on:bought,placed_in_service_on:service,cost_satang:cost,salvage_satang:salvage,useful_life_months:life,
  accounting_class:cost>=Number(threshold)?'capitalized':'controlled',
  asset_status:v('asset_status')||'active',location:v('location').slice(0,250),
  responsible_person:v('responsible_person').slice(0,250),notes:v('notes').slice(0,1500)};
}
export function parseCsv(text){
 const s=String(text).replace(/^\uFEFF/,'');const out=[];let row=[],value='',quote=false;
 for(let i=0;i<s.length;i++){const c=s[i];
  if(quote){if(c==='"'&&s[i+1]==='"'){value+='"';i++;}else if(c==='"')quote=false;else value+=c;}
  else if(c==='"'&&value==='')quote=true;else if(c===','||c==='\t'){row.push(value);value='';}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&s[i+1]==='\n')i++;row.push(value);if(row.some(x=>x.trim()))out.push(row);row=[];value='';}
  else value+=c;
 }
 if(quote)throw Error('ไฟล์ CSV มีเครื่องหมายอัญประกาศเปิดไม่ครบ');
 row.push(value);if(row.some(x=>x.trim()))out.push(row);
 return out;
}
export const importHeaders=['รหัสครุภัณฑ์','ชื่อครุภัณฑ์','ราคาทุน','วันที่ได้มา','วันที่พร้อมใช้งาน','อายุใช้งาน(เดือน)','มูลค่าคงเหลือ','ประเภท','เลขเครื่อง','สถานที่','ผู้รับผิดชอบ','หมายเหตุ'];
export function rowsToAssets(rows,categories,threshold){
 if(!Array.isArray(rows)||rows.length<2)throw Error('ไม่พบแถวข้อมูลในไฟล์');
 const headers=rows[0].map(x=>String(x??'').trim()),required=importHeaders.slice(0,6);
 for(const item of required)if(!headers.includes(item))throw Error('ไม่พบหัวคอลัมน์ "'+item+'"');
 const output=[],errors=[];
 for(const [index,values] of rows.slice(1).entries()){
  const record=Object.fromEntries(headers.map((key,i)=>[key,String(values[i]??'').trim()]));
  try{
   const categoryName=record['ประเภท'],cat=categoryName?categories.find(x=>x.name===categoryName||x.code_prefix===categoryName):null;
   if(categoryName&&!cat)throw Error('ไม่พบประเภท '+categoryName+' ในการตั้งค่าโรงเรียน');
   const x=assetInput({asset_code:record['รหัสครุภัณฑ์'],name:record['ชื่อครุภัณฑ์'],cost_baht:record['ราคาทุน'],
    acquired_on:record['วันที่ได้มา'],placed_in_service_on:record['วันที่พร้อมใช้งาน'],
    useful_life_months:record['อายุใช้งาน(เดือน)'],salvage_baht:record['มูลค่าคงเหลือ']||'0',
    category_id:cat?.id||'',serial_number:record['เลขเครื่อง'],location:record['สถานที่'],
    responsible_person:record['ผู้รับผิดชอบ'],notes:record['หมายเหตุ']},{threshold,categories});
   output.push(x);
  }catch(ex){errors.push('แถว '+(index+2)+': '+ex.message);}
 }
 if(new Set(output.map(x=>x.asset_code.toLowerCase())).size!==output.length)errors.push('รหัสครุภัณฑ์ซ้ำกันภายในไฟล์');
 return {assets:output,errors};
}
