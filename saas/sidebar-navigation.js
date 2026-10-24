/* Grouped navigation for procurement and school-scoped equipment registration. Permission checks remain server-side in Supabase RLS. */
export const assetTopics=[
 {id:'overview',label:'ภาพรวมครุภัณฑ์'},
 {id:'registry',label:'ทะเบียนครุภัณฑ์'},
 {id:'import',label:'เพิ่ม / นำเข้าครุภัณฑ์'},
 {id:'depreciation',label:'คำนวณค่าเสื่อมราคา'},
 {id:'report',label:'รายงานทะเบียนครุภัณฑ์ A4'},
 {id:'settings',label:'ตั้งค่าประเภทและรหัสครุภัณฑ์',adminOnly:true}
];
export const sidebarGroups=[
 {id:'procurement',label:'ระบบการจัดซื้อจัดจ้าง',icon:'file',items:[
  {id:'dashboard',label:'ภาพรวมจัดซื้อจัดจ้าง',action:'dashboard'},
  {id:'create',label:'สร้างรายการใหม่',action:'create'},
  {id:'records',label:'ทะเบียนจัดซื้อจัดจ้าง',action:'records'},
  {id:'registry',label:'ทะเบียนคุมเลขเอกสาร',action:'registry'},
  {id:'guide-shortcut',label:'คู่มือการจัดซื้อจัดจ้าง (ทางลัด)',action:'user-guide',shortcut:true},
  {id:'templates',label:'แม่แบบเอกสาร',action:'templates',adminOnly:true}
 ]},
 {id:'assets',label:'ทะเบียนครุภัณฑ์',icon:'package',items:assetTopics.map(item=>({...item,action:'asset-section',section:item.id,comingSoon:false}))},
 {id:'guides',label:'คู่มือผู้ใช้งาน',icon:'book',items:[
  {id:'procurement-guide',label:'คู่มือระบบจัดซื้อจัดจ้าง',action:'user-guide'},
  {id:'assets-guide',label:'คู่มือระบบทะเบียนคุมครุภัณฑ์',action:'asset-guide'}
 ]}
];
export const adminNavLinks=[
 {id:'members',label:'จัดการผู้ใช้งาน',action:'members',icon:'users',schoolAdminOnly:true},
 {id:'settings',label:'ข้อมูลโรงเรียน',action:'settings',icon:'settings',adminOnly:true},
 {id:'admin-guide',label:'คู่มือผู้ดูแลระบบ',action:'admin-guide',icon:'book',schoolAdminOnly:true}
];
export const navGroupIds=sidebarGroups.map(g=>g.id);
export function visibleSidebarGroups({schoolAdmin=false,admin=false}={}){
 return sidebarGroups.map(group=>({
  ...group,items:group.items.filter(item=>!item.adminOnly||schoolAdmin)
 }));
}
export function visibleAdminLinks({schoolAdmin=false,admin=false}={}){
 return adminNavLinks.filter(item=>item.schoolAdminOnly?schoolAdmin:item.adminOnly?admin:true);
}
export function groupForPage(page){
 if(['dashboard','create','records','registry','detail','docmeta','preview','templates'].includes(page))return 'procurement';
 if(page==='assets')return 'assets';
 if(['user-guide','asset-guide'].includes(page))return 'guides';
 return '';
}
export function validAssetTopic(id){
 return assetTopics.some(topic=>topic.id===id);
}
