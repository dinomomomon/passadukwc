/* Per-school purchasing categories; issued numbers remain unchanged. */
import {normalizeMemoPrefix} from './print.js';
export const MAX_SCHOOL_CATEGORIES=10;
const legacy=s=>{
 const first=normalizeMemoPrefix(s?.memo_prefix||'พว.')||'พว.';
 return first==='พค.'?[{name:'หมวดพัสดุทั่วไป',prefix:first}]:[{name:'วัสดุ',prefix:first},{name:'ครุภัณฑ์',prefix:'พค.'}];
};
const hireLegacy=()=>[{name:'งานจ้างทั่วไป',prefix:'พจ'}];
/** Purchase and hire have independent per-school categories; purchasing
 * retains its original storage and defaults for backwards compatibility. */
export function schoolProcurementCategories(s={},kind='purchase'){
 const hire=kind==='hire';
 const raw=hire?s?.procurement_hire_categories:s?.procurement_categories;
 if(!Array.isArray(raw)||!raw.length)return hire?hireLegacy():legacy(s);
 const rows=raw.filter(x=>x&&typeof x.name==='string'&&typeof x.prefix==='string')
  .map(x=>({name:x.name.trim(),prefix:normalizeMemoPrefix(x.prefix)}))
  .filter(x=>x.name&&x.prefix);
 return rows.length?rows:(hire?hireLegacy():legacy(s));
}
export function validateSchoolProcurementCategories(rows){
 if(!Array.isArray(rows)||rows.length<1||rows.length>MAX_SCHOOL_CATEGORIES)throw Error('ต้องมีหมวดพัสดุอย่างน้อย 1 หมวด และไม่เกิน '+MAX_SCHOOL_CATEGORIES+' หมวด');
 const output=rows.map((row,i)=>{
  const name=String(row?.name??'').trim().replace(/\s+/g,' ');
  const raw=String(row?.prefix??'').trim(),prefix=normalizeMemoPrefix(raw);
  if(!name||name.length>60)throw Error('ชื่อหมวดลำดับที่ '+(i+1)+' ต้องมี 1–60 ตัวอักษร');
  if(!prefix||prefix.length>24||prefix!==raw||!/^[\p{L}\p{N}.()_-]+$/u.test(prefix))throw Error('รหัสหมวดลำดับที่ '+(i+1)+' ต้องเป็นคำย่อ เช่น พว. ห้ามใส่เลขหนังสือหรือช่องว่าง');
  return {name,prefix};
 });
 if(new Set(output.map(x=>x.name.toLowerCase())).size!==output.length)throw Error('ชื่อหมวดพัสดุต้องไม่ซ้ำกัน');
 return output;
}
export function requestPrefixOptions(s={},savedPrefix='',kind='purchase'){
 const grouped=new Map();
 for(const {name,prefix} of schoolProcurementCategories(s,kind)){
  if(!grouped.has(prefix))grouped.set(prefix,[]);
  grouped.get(prefix).push(name);
 }
 const selected=normalizeMemoPrefix(savedPrefix);
 if(selected&&!grouped.has(selected))grouped.set(selected,['รหัสเดิมของเอกสารนี้']);
 return [...grouped].map(([prefix,names])=>({prefix,name:names.join(' / ')}));
}
