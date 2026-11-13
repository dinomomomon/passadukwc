/**
 * Dashboard numbers and latest records. All inputs are already scoped to the
 * authenticated school by loadRecords; never call this for another tenant.
 */
const safeTime=row=>{
 const timestamp=Date.parse(String(row?.created_at||row?.document_date||''));
 return Number.isFinite(timestamp)?timestamp:0;
};
export function latestDashboardRecords(records,limit=10){
 const cap=Number.isFinite(Number(limit))?Math.max(0,Math.min(10,Math.trunc(Number(limit)))):10;
 return (Array.isArray(records)?records:[])
  .filter(row=>row&&!row.deleted_at)
  .slice()
  .sort((a,b)=>safeTime(b)-safeTime(a))
  .slice(0,cap);
}
export function dashboardRecordTotals(records){
 const active=(Array.isArray(records)?records:[]).filter(row=>row&&!row.deleted_at);
 return {
  total:active.length,
  purchase:active.filter(row=>row.kind==='purchase').length,
  hire:active.filter(row=>row.kind==='hire').length,
  satang:active.reduce((sum,row)=>{
   const n=Number(row.total_satang);
   return sum+(Number.isFinite(n)&&n>=0?n:0);
  },0)
 };
}
