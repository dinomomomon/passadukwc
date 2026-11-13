/**
 * A single unobtrusive, accessible notification popup for all system saves.
 * Reads existing state.flash / state.error writes so every existing save flow
 * gets consistent acknowledgement, without changing database operations.
 */
export function installStateNotices(state,doc=typeof document!=='undefined'?document:null){
 let current=null,clock=null,latest=null,queued=false;
 const copy={flash:String(state.flash||''),error:String(state.error||'')};
 const allowed=['flash','error'];
 function clear(){
  if(clock!==null){clearTimeout(clock);clock=null;}
  if(current?.isConnected)current.remove();
  current=null;
 }
 function show(message,kind='success'){
  if(!doc||!message)return;
  clear();
  const notice=doc.createElement('div');
  notice.className='kp-popup kp-popup-'+(kind==='error'?'error':'success');
  notice.setAttribute('role',kind==='error'?'alert':'status');
  notice.setAttribute('aria-live',kind==='error'?'assertive':'polite');
  notice.setAttribute('aria-atomic','true');
  const emblem=doc.createElement('span');
  emblem.className='kp-popup-emblem';
  emblem.textContent=kind==='error'?'!':'✓';
  emblem.setAttribute('aria-hidden','true');
  const details=doc.createElement('span');
  details.className='kp-popup-details';
  const title=doc.createElement('strong');
  title.textContent=kind==='error'?'ดำเนินการไม่สำเร็จ':(/บันทึก|แก้ไข|อัปเดต|ปรับข้อมูล|ตั้งค่าเลข|สร้างรายการ|สร้างโรงเรียน/.test(String(message))?'บันทึกสำเร็จ':'ดำเนินการสำเร็จ');
  const body=doc.createElement('span');
  body.className='kp-popup-message';
  body.textContent=String(message).slice(0,1200);
  details.append(title,body);
  const close=doc.createElement('button');
  close.type='button';
  close.className='kp-popup-close';
  close.setAttribute('aria-label','ปิดข้อความแจ้งเตือน');
  close.textContent='×';
  close.addEventListener('click',clear);
  const progress=doc.createElement('span');
  progress.className='kp-popup-progress';
  progress.setAttribute('aria-hidden','true');
  notice.append(emblem,details,close,progress);
  doc.body.appendChild(notice);
  current=notice;
  clock=setTimeout(clear,kind==='error'?6500:4500);
 }
 function schedule(message,kind){
  if(!message)return;
  // Error wins if both success and failure are set in one operation.
  if(!latest||kind==='error'||latest.kind!=='error')latest={message,kind};
  if(queued)return;
  queued=true;
  queueMicrotask(()=>{
   queued=false;
   if(latest){const item=latest;latest=null;show(item.message,item.kind);}
  });
 }
 for(const key of allowed){
  Object.defineProperty(state,key,{
   configurable:true,enumerable:true,
   get(){return copy[key];},
   set(value){
    copy[key]=String(value??'');
    if(copy[key])schedule(copy[key],key==='error'?'error':'success');
   }
  });
 }
 return {show,clear};
}
