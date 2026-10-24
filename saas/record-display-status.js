// UI-only status derived from persisted procurement content.
// A saved procurement is NOT the same as official approval or inspection.
// Keep database state='draft' for edit/delete rights, registry audit, and paper workflow.
export function isCompleteSavedProcurement(record){
 if(!record || record.deleted_at || record.state!=='draft')return false;
 if(!['purchase','hire'].includes(record.kind))return false;
 if(!String(record.title||'').trim()||!String(record.budget_source||'').trim())return false;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(record.document_date||'')))return false;
 if(!Number.isSafeInteger(Number(record.document_number))||Number(record.document_number)<1)return false;
 if(!Number.isSafeInteger(Number(record.fiscal_year))||Number(record.fiscal_year)<2500)return false;
 const items=record.items;
 if(!Array.isArray(items)||items.length<1)return false;
 if(!items.every(item=>item && String(item.name||'').trim() && String(item.unit||'').trim() &&
    Number.isFinite(Number(item.qty)) && Number(item.qty)>0 &&
    Number.isSafeInteger(Number(item.price_satang)) && Number(item.price_satang)>0))return false;
 const total=Number(record.total_satang);
 return Number.isSafeInteger(total)&&total>0;
}

export function procurementDisplayStatus(record){
 const labels={
  review:['รอตรวจสอบ',''],
  approved:['อนุมัติแล้ว',''],
  received:['ตรวจรับแล้ว',''],
  completed:['เสร็จสิ้น',''],
  cancelled:['ยกเลิก','gray']
 };
 if(record?.state==='draft'){
  return isCompleteSavedProcurement(record)?
   {label:'บันทึกเรียบร้อย',className:'kp-saved-complete'}:
   {label:'ฉบับร่าง',className:'amber'};
 }
 const [label,className]=labels[record?.state]||['รอตรวจสอบ','gray'];
 return {label,className};
}
