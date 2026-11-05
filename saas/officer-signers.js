/* School-scoped officer signer choices. Published A4 documents keep procurements.signers snapshots. */
export const MAX_OFFICER_SIGNERS=30;
const cleanName=value=>String(value??'').trim().replace(/\s+/g,' ');
export function schoolOfficerSigners(s={}){
 if(Array.isArray(s?.officer_signers)){
  return s.officer_signers.filter(r=>r&&typeof r.name==='string').map(r=>({
   name:cleanName(r.name),active:r.active===true,is_default:r.is_default===true
  })).filter(r=>r.name);
 }
 const fallback=cleanName(s?.officer_name);
 return fallback?[{name:fallback,active:true,is_default:true}]:[];
}
export function activeOfficerSigners(s={}){
 return schoolOfficerSigners(s).filter(r=>r.active);
}
export function selectedOfficerSigner(s={},preferred=''){
 const active=activeOfficerSigners(s);
 if(!active.length)return '';
 const matched=active.find(r=>r.name===cleanName(preferred));
 return matched?.name||active.find(r=>r.is_default)?.name||active[0].name;
}
export function validateOfficerSigners(rows){
 if(!Array.isArray(rows)||rows.length<1||rows.length>MAX_OFFICER_SIGNERS)
  throw Error('ต้องมีรายชื่อเจ้าหน้าที่พัสดุอย่างน้อย 1 คน และไม่เกิน '+MAX_OFFICER_SIGNERS+' คน');
 const normalized=rows.map((v,i)=>{
  const name=cleanName(v?.name);
  if(!name||name.length>200)throw Error('ชื่อเจ้าหน้าที่ลำดับที่ '+(i+1)+' ต้องมี 1–200 ตัวอักษร');
  return {name,active:v.active===true,is_default:v.is_default===true};
 });
 if(new Set(normalized.map(r=>r.name.toLocaleLowerCase())).size!==normalized.length)
  throw Error('มีชื่อเจ้าหน้าที่พัสดุซ้ำกัน กรุณาตรวจสอบ');
 const active=normalized.filter(r=>r.active);
 if(!active.length)throw Error('ต้องมีเจ้าหน้าที่พัสดุเปิดใช้งานอย่างน้อย 1 คน');
 const defaults=normalized.filter(r=>r.is_default);
 if(defaults.length>1)throw Error('เลือกเจ้าหน้าที่เริ่มต้นได้เพียง 1 คน');
 if(defaults.length&&defaults[0].active!==true)
  throw Error('เจ้าหน้าที่เริ่มต้นต้องอยู่ในสถานะเปิดใช้งาน');
 if(!defaults.length)active[0].is_default=true;
 return normalized;
}
