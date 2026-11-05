import {parseCsv} from './asset-engine.js';
const decoder=new TextDecoder('utf-8');
function bytesToText(u){return decoder.decode(u);}
async function unzipEntry(bytes,requested){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const u16=p=>v.getUint16(p,true),u32=p=>v.getUint32(p,true);
 let end=-1;
 for(let p=bytes.length-22;p>=Math.max(0,bytes.length-66000);p--){if(u32(p)===0x06054b50){end=p;break;}}
 if(end<0)throw Error('ไฟล์ Excel ไม่ใช่ XLSX ที่ถูกต้อง');
 const count=u16(end+10),offset=u32(end+16);
 if(count>5000||offset>=bytes.length)throw Error('โครงสร้าง XLSX ไม่ถูกต้อง');
 let pos=offset;
 for(let index=0;index<count;index++){
  if(pos+46>bytes.length||u32(pos)!==0x02014b50)throw Error('ข้อมูลส่วนประกอบ Excel ไม่ถูกต้อง');
  const method=u16(pos+10),size=u32(pos+20),rawsize=u32(pos+24);
  const filenameLen=u16(pos+28),extraLen=u16(pos+30),commentLen=u16(pos+32),local=u32(pos+42);
  const filename=bytesToText(bytes.slice(pos+46,pos+46+filenameLen));
  pos+=46+filenameLen+extraLen+commentLen;
  if(!requested.includes(filename))continue;
  if(rawsize>12*1024*1024||size>10*1024*1024)throw Error('ไฟล์ Excel มีข้อมูลภายในขนาดใหญ่เกินกำหนด');
  if(local+30>bytes.length||u32(local)!==0x04034b50)throw Error('ส่วนประกอบ XLSX เสียหาย');
  const start=local+30+u16(local+26)+u16(local+28);
  if(start+size>bytes.length)throw Error('ข้อมูล XLSX ไม่ครบ');
  const packed=bytes.slice(start,start+size);
  if(method===0)return bytesToText(packed);
  if(method!==8)throw Error('พบรูปแบบบีบอัด Excel ที่ไม่รองรับ');
  if(typeof DecompressionStream==='undefined')throw Error('เบราว์เซอร์นี้ไม่รองรับการอ่าน XLSX กรุณาใช้ Chrome รุ่นล่าสุด หรือบันทึกเป็น CSV UTF-8');
  try{
   const raw=await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
   if(raw.byteLength>12*1024*1024)throw Error('ไฟล์ที่คลายบีบอัดมีขนาดใหญ่เกินกำหนด');
   return bytesToText(new Uint8Array(raw));
  }catch(err){throw Error('เปิดข้อมูลใน XLSX ไม่ได้ กรุณาบันทึกเป็น CSV UTF-8 แล้วนำเข้าแทน ('+err.message+')');}
 }
 return null;
}
const xml=source=>{const doc=new DOMParser().parseFromString(source,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('โครงสร้าง XML ของ Excel ไม่ถูกต้อง');return doc;};
const textNodes=(node,tag)=>Array.from(node.getElementsByTagName(tag)).map(x=>x.textContent||'').join('');
const colNum=ref=>{const m=String(ref).match(/^[A-Z]+/i);if(!m)return -1;return [...m[0].toUpperCase()].reduce((v,x)=>v*26+x.charCodeAt(0)-64,0)-1;};
const excelDate=n=>{const t=Date.UTC(1899,11,30)+Math.round(Number(n))*86400000;return new Date(t).toISOString().slice(0,10);};
function normalizeDates(rows){
 const headers=(rows[0]||[]).map(x=>String(x).trim());
 const positions=['วันที่ได้มา','วันที่พร้อมใช้งาน'].map(k=>headers.indexOf(k));
 for(const row of rows.slice(1))for(const p of positions){if(p<0)continue;
  const value=String(row[p]||'').trim();
  if(/^\d{4,5}(\.\d+)?$/.test(value)&&Number(value)>10000&&Number(value)<100000)row[p]=excelDate(value);
  else if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)){
   const [d,m,y]=value.split('/').map(Number);row[p]=String(y>2400?y-543:y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  }
 }
 return rows;
}
export async function readSpreadsheet(file){
 if(!file||file.size>6*1024*1024)throw Error('ไฟล์ต้องไม่เกิน 6 MB');
 const ext=file.name.split('.').pop().toLowerCase();
 if(ext==='csv'||ext==='tsv'){
  const data=new Uint8Array(await file.arrayBuffer());
  let content=new TextDecoder('utf-8').decode(data);
  if(content.includes('\ufffd'))content=new TextDecoder('windows-874').decode(data);
  return normalizeDates(parseCsv(content));
 }
 if(ext!=='xlsx')throw Error('รองรับไฟล์ .xlsx, .csv และ .tsv เท่านั้น');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const [sheet,strings]=await Promise.all([
  unzipEntry(bytes,['xl/worksheets/sheet1.xml']),unzipEntry(bytes,['xl/sharedStrings.xml'])
 ]);
 if(!sheet)throw Error('ไม่พบแผ่นงานแรกในไฟล์ Excel');
 const shared=strings?Array.from(xml(strings).getElementsByTagName('si'),si=>textNodes(si,'t')):[];
 const doc=xml(sheet),output=[];
 for(const rowNode of doc.getElementsByTagName('row')){
  const row=[];
  for(const c of rowNode.getElementsByTagName('c')){
   const pos=colNum(c.getAttribute('r'));if(pos<0||pos>100)continue;
   const type=c.getAttribute('t')||'';
   const raw=c.getElementsByTagName('v')[0]?.textContent||'';
   row[pos]=type==='s'?(shared[Number(raw)]||''):type==='inlineStr'?textNodes(c,'t'):raw;
  }
  if(row.some(x=>x!==undefined&&String(x).trim()))output.push(Array.from({length:Math.max(row.length,12)},(_,i)=>row[i]??''));
  if(output.length>1001)throw Error('ไฟล์มีมากกว่า 1,000 รายการ กรุณาแยกนำเข้าเป็นหลายไฟล์');
 }
 return normalizeDates(output);
}
export function saveCsvFile(name,rows){
 const esc=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 const csv='\ufeff'+rows.map(r=>r.map(esc).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
}
