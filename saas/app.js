// Resilient Supabase SDK loader: pinned version with independent CDN fallback.
// Chrome can hold a stale cache for an unpinned /@2/+esm dependency.
const SUPABASE_SDK_SOURCES=[
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm',
  'https://esm.sh/@supabase/supabase-js@2.116.0?bundle'
];
async function loadSupabaseSdk(){
  const attempts=SUPABASE_SDK_SOURCES.map(async url=>{
    let timer;
    try{
      const module=await Promise.race([
        import(/* @vite-ignore */ url),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('SDK CDN timeout')),8500);})
      ]);
      if(typeof module.createClient!=='function')throw new Error('Supabase SDK missing createClient');
      return module;
    }finally{clearTimeout(timer);}
  });
  try{return await Promise.any(attempts);}
  catch(error){
    console.error('Unable to load Supabase from either CDN',error);
    window.dispatchEvent(new CustomEvent('kru:dependency-error'));
    throw error;
  }
}
const {createClient}=await loadSupabaseSdk();
import {SUPABASE_URL,SUPABASE_KEY} from './config.js';
import {buildDocuments,escapeHtml as e,normalizeMemoPrefix} from './print.js';
import {docMetaInputs,docMetaValue,docMetaWizardInputs} from './document-meta.js';
import {createTemplateEditor,activeTemplateLayouts,applyDocumentTemplates} from './template-builder.js';
import {installStateNotices} from './notification-popup.js';
const db=createClient(SUPABASE_URL,SUPABASE_KEY);
const app=document.getElementById('app');
const bootStage=phase=>{try{window.__kruBootStage=phase;document.documentElement.dataset.kruBoot=phase;sessionStorage.setItem('kru_boot_stage',phase);}catch{}};
bootStage('client-ready');
const demoSchool={id:'demo-school',name:'โรงเรียนตัวอย่างวิทยาลัย',district:'อำเภอเมือง',province:'เชียงใหม่',director_name:'นายสมชาย ตัวอย่าง',head_name:'นางสาวสุภา ตัวอย่าง',officer_name:'นายมานะ ตั้งใจ',finance_name:'นางสาวการเงิน ตัวอย่าง'};
const mkDemo=(id,kind,no,title,vendor,total,date,items)=>({id,kind,document_number:no,fiscal_year:2570,document_date:date,title,reason:'ใช้ในการดำเนินงานตามแผนของสถานศึกษา',department:'กลุ่มบริหารงานวิชาการ',budget_source:'งบดำเนินงาน / กิจกรรมพัฒนาผู้เรียน',method:'วิธีเฉพาะเจาะจง',vendor_name:vendor,items,total_satang:total*100,state:'draft',signers:{officer:demoSchool.officer_name,head:demoSchool.head_name,director:demoSchool.director_name}});
const demoRecords=[
 mkDemo('demo-1','purchase',1,'จัดซื้อวัสดุสำนักงาน','ร้านค้าตัวอย่าง',3200,'2026-10-16',[{name:'กระดาษถ่ายเอกสาร A4',qty:5,unit:'รีม',price_satang:12000},{name:'หมึกเครื่องพิมพ์',qty:2,unit:'กล่อง',price_satang:130000}]),
 mkDemo('demo-2','hire',1,'จ้างทำป้ายประชาสัมพันธ์','ร้านป้ายตัวอย่าง',980,'2026-10-17',[{name:'งานออกแบบและจัดทำป้าย',qty:1,unit:'งาน',price_satang:98000}]),
 mkDemo('demo-3','purchase',2,'ซื้ออุปกรณ์การเรียน','ร้านศึกษาภัณฑ์',1250,'2026-10-18',[{name:'อุปกรณ์การเรียน',qty:5,unit:'ชุด',price_satang:25000}])
];
const state={demoLogoUrl:'',session:null,user:null,profile:null,owner:false,memberships:[],school:null,schools:[],schoolRequests:[],subscriptions:[],subscription:null,members:[],records:[],demo:false,page:'landing',currentRecord:null,flash:'',error:'',items:[{name:'',qty:'1',unit:'',price:''}],draft:{},authMode:'login',authForgot:false,authEmail:'',recoveryMode:(new URLSearchParams(window.location.search).get('auth')==='recovery'||/(?:^|&)type=recovery(?:&|$)/.test(window.location.hash.slice(1))),pendingSignupEmail:'',filter:'',memberEditingId:null,memberResetId:null,officialNumbers:[],numberFilter:'',numberSeries:'all',numberStatus:'all',numberYear:'all',schoolTemplates:{},templateVersions:{}};
installStateNotices(state);
const money=n=>(Number(n||0)/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
const dateThai=d=>d?new Date(d+'T12:00:00+07:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}):'-';
const dateToday=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
const fiscalYear=()=>{let d=new Date(Date.now()+7*3600000);return d.getUTCFullYear()+543+(d.getUTCMonth()>=9?1:0);};
// Personnel management is reserved for active school admins of this tenant.
// Super Admin may create schools and assign their initial admin, but cannot
// manage other schools' staff through school-scoped user controls.
const isSchoolAdmin=()=>!state.demo&&!!state.user&&state.memberships.some(x=>x.school_id===state.school?.id&&x.role==='school_admin');
const isAdmin=()=>state.demo||isSchoolAdmin();
const canEditMainRecord=r=>!!r&&r.state==='draft'&&!r.deleted_at&&canEditDocumentMeta(r);
const canDeleteMainRecord=r=>canEditMainRecord(r);
const canEditDocumentMeta=r=>state.demo||!!state.user&&state.memberships.some(m=>m.school_id===state.school?.id&&(m.role==='school_admin'||m.role==='procurement_head'||(m.role==='procurement_officer'&&r?.created_by===state.user.id)));

const accountFullName=()=>{
  if(state.demo)return 'ผู้ทดลองใช้งาน';
  return String(state.profile?.full_name||state.user?.user_metadata?.full_name||'').trim()||'เพิ่มชื่อ–นามสกุล';
};
const accountRoleLabel=()=>{
  if(state.demo)return 'โหมดสาธิต';
  if(state.owner&&!state.school)return 'เจ้าของแพลตฟอร์ม';
  const role=state.memberships.find(m=>m.school_id===state.school?.id)?.role;
  const labels={school_admin:'แอดมินโรงเรียน',procurement_officer:'เจ้าหน้าที่พัสดุ',procurement_head:'หัวหน้าเจ้าหน้าที่พัสดุ',director:'ผู้อำนวยการสถานศึกษา',finance:'เจ้าหน้าที่การเงิน',inspector:'ผู้ตรวจรับพัสดุ'};
  return labels[role]|| (state.owner?'เจ้าของแพลตฟอร์ม':'บัญชีผู้ใช้งาน');
};
function accountHeader(){
  const display=accountFullName(),role=accountRoleLabel();
  const content='<span class="account-user-icon">'+i('users')+'</span><span class="account-user-details"><strong title="'+e(display)+'">'+e(display)+'</strong><small>'+e(role)+'</small></span>';
  const identity=state.demo?'<div class="account-identity account-identity-demo">'+content+'</div>':
      '<button type="button" class="account-identity" data-action="profile" title="แก้ไขชื่อ–นามสกุลของฉัน">'+content+'<span class="account-pencil">แก้ไข</span></button>';
  return '<div class="top-actions"><span class="tag '+(state.demo?'amber':'')+'">'+(state.demo?'สาธิต':'ออนไลน์')+'</span>'+identity+
    '<button type="button" class="logout-button" data-action="signout" aria-label="ออกจากระบบ">'+i('logout')+'<span>ออกจากระบบ</span></button></div>';
}
function openProfileEditor(){
  if(!state.user||state.demo)return notify('โหมดตัวอย่างไม่มีโปรไฟล์จริง กรุณาสมัครหรือเข้าสู่ระบบ',true);
  document.getElementById('profile-dialog')?.remove();
  app.insertAdjacentHTML('beforeend','<dialog id="profile-dialog" class="profile-dialog" aria-labelledby="profile-title"><div class="profile-panel"><div class="profile-panel-head"><h2 id="profile-title">ข้อมูลบัญชีผู้ใช้งาน</h2><button type="button" class="profile-close" data-action="close-profile" aria-label="ปิด">×</button></div><p class="muted">แก้ไขชื่อ–นามสกุลที่แสดงมุมขวาบนของระบบ บทบาทผู้ใช้กำหนดโดยแอดมินโรงเรียน</p><form id="profile-form"><div class="field"><label for="profile-full-name">ชื่อ–นามสกุลเจ้าหน้าที่</label><input class="input" id="profile-full-name" name="full_name" autocomplete="name" maxlength="150" minlength="3" required value="'+e(state.profile?.full_name||state.user?.user_metadata?.full_name||'')+'"></div><div class="field"><label>อีเมลสำหรับเข้าสู่ระบบ</label><input class="input" disabled value="'+e(state.user.email||'')+'"></div><div class="field"><label>สิทธิ์ในระบบ</label><input class="input" disabled value="'+e(accountRoleLabel())+'"></div><div class="profile-controls"><button type="button" class="secondary" data-action="close-profile">ยกเลิก</button><button type="submit" class="primary">บันทึกชื่อ–นามสกุล</button></div></form></div></dialog>');
  const dialog=document.getElementById('profile-dialog');
  dialog.showModal();
  dialog.querySelector('#profile-full-name')?.focus();
}

const i=(name)=>{const paths={book:'<path d="M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 0-3 0z"/><path d="M4 4v17M8 8h8M8 12h7"/>',dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',plus:'<path d="M12 5v14M5 12h14"/>',users:'<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a6 6 0 0 1 12 0v2M16 4a4 4 0 0 1 0 8M17 15a6 6 0 0 1 5 6"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19 13a7 7 0 0 0 0-2l2-1-2-4-2 1a8 8 0 0 0-2-1l-1-3h-4L9 6a8 8 0 0 0-2 1L5 6 3 10l2 1a7 7 0 0 0 0 2l-2 1 2 4 2-1a8 8 0 0 0 2 1l1 3h4l1-3a8 8 0 0 0 2-1l2 1 2-4z"/>',logout:'<path d="M10 17l5-5-5-5M15 12H3M12 3h5a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4h-5"/>',building:'<rect x="3" y="7" width="18" height="14" rx="1"/><path d="M8 21V3h8v18M10 6h4M7 11h2M15 11h2M7 15h2M15 15h2"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',download:'<path d="M12 3v12M8 11l4 4 4-4M4 17v4h16v-4"/>',check:'<path d="m4 12 5 5L20 6"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',cloud:'<path d="M20 16a5 5 0 0 0-5-5h-1a6 6 0 0 0-12 1 4 4 0 0 0 2 8h14a4 4 0 0 0 2-4z"/>'};return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.file)+'</svg>';};

function logo(){return '<div class="brand"><span class="brand-mark"><img src="/kru-pasadu-icon.svg" alt="สัญลักษณ์ครูพัสดุ" loading="eager"></span><span class="brand-wording"><strong>ครูพัสดุ</strong><small>ทำเรื่องพัสดุให้เป็นเรื่องง่าย</small></span></div>';}
function schoolLogo(size='normal'){
  const path=state.school?.logo_path||'';
  const publicUrl=path ? db.storage.from('school-logos').getPublicUrl(path).data.publicUrl : '';
  const url=(state.demo&&state.demoLogoUrl)||publicUrl;
  return url ? '<span class="school-logo school-logo-'+size+'"><img src="'+e(url)+'" alt="โลโก้'+e(state.school?.name||'โรงเรียน')+'" loading="lazy"></span>' : '<span class="school-logo school-logo-'+size+' school-logo-fallback" aria-label="ยังไม่มีโลโก้โรงเรียน">🏫</span>';
}
function schoolIdentity(){
  return '<div class="school-identity">'+schoolLogo('sidebar')+'<div><b>'+e(state.school?.name||'ยังไม่เลือกโรงเรียน')+'</b><small>พื้นที่ทำงานของสถานศึกษา</small></div></div>';
}

function msg(){let x=(state.error?'<div class="alert danger-alert">'+e(state.error)+'</div>':'')+(state.flash?'<div class="alert success-alert">'+e(state.flash)+'</div>':'');state.error='';state.flash='';return x;}
function notify(text,bad=false){if(bad)state.error=text;else state.flash=text;render();}
function btn(text,action,cl='primary',attrs=''){return '<button type="button" class="'+cl+'" data-action="'+action+'" '+attrs+'>'+text+'</button>';}
function landmark(){return '<div class="preview-device"><div class="preview-top"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><div class="preview-content"><div class="preview-sidebar">'+Array(6).fill(0).map((_,ix)=>'<div class="preview-menu '+(ix===0?'active':'')+'"></div>').join('')+'</div><div class="preview-body"><div class="preview-title"></div><div class="preview-cards"><div class="preview-card"></div><div class="preview-card"></div><div class="preview-card"></div></div><div class="preview-rows">'+Array(7).fill('<div class="preview-row"></div>').join('')+'</div></div></div></div>';}
function landing(){app.innerHTML='<div class="landing"><div class="land-nav">'+logo()+btn('เข้าสู่ระบบ →','login','secondary')+'</div><div class="land-hero"><div><span class="pill">✦ ระบบพัสดุยุคใหม่สำหรับทุกโรงเรียน</span><h1>งานพัสดุง่ายขึ้น<br>ด้วย <em>ครูพัสดุ</em></h1><p class="lead">จัดซื้อ จัดจ้าง ออกเลขเอกสารจากฐานข้อมูลเดียวกัน สร้างเอกสารราชการและพิมพ์ PDF ได้ในไม่กี่ขั้นตอน</p><div class="land-actions">'+btn('ทดลองดูระบบตัวอย่าง →','demo','primary')+btn('สมัครบัญชีโรงเรียน','signup','secondary')+'</div><div class="land-details"><span>✓ ออนไลน์</span><span>✓ เลขไม่ซ้ำ</span><span>✓ แบบเอกสาร A4</span></div><p class="muted" style="font-size:12px;margin-top:22px">เวอร์ชันทดลอง ยังอยู่ระหว่างตรวจรับข้อความราชการและแบบเอกสาร</p></div>'+landmark()+'</div></div>';}

const KP_REMEMBER_EMAIL='kru_pasadu_remember_email';
function rememberedEmail(){
  try{return localStorage.getItem(KP_REMEMBER_EMAIL)||'';}catch{return '';}
}
function rememberLoginEmail(email,remember){
  try{if(remember)localStorage.setItem(KP_REMEMBER_EMAIL,String(email||'').trim());else localStorage.removeItem(KP_REMEMBER_EMAIL);}catch{}
}
const signupTabs=()=>'<div class="kp-auth-tabs" role="tablist" aria-label="เลือกการเข้าใช้งาน">'+
  '<button type="button" class="kp-auth-tab" role="tab" aria-selected="'+(state.authMode==='login')+'" data-action="login">เข้าสู่ระบบ</button>'+
  '<button type="button" class="kp-auth-tab" role="tab" aria-selected="'+(state.authMode==='signup')+'" data-action="signup">สมัครสมาชิก</button></div>';
function authHero(){
  const steps=[['file','สร้างรายการ','กรอกข้อมูลครั้งเดียว'],['check','ตรวจสอบ','ดำเนินการตามสิทธิ์'],['download','พิมพ์ PDF','จัดทำชุดเอกสาร'],['cloud','จัดเก็บ','ค้นหาทะเบียนย้อนหลัง']];
  const benefits=[['file','เอกสารเป็นระบบ','จัดซื้อ–จัดจ้าง พร้อมแบบฟอร์มสำหรับตรวจรับและเบิกจ่าย'],['users','ทำงานเป็นทีม','แยกสิทธิ์ผู้ใช้งานของแต่ละโรงเรียนอย่างชัดเจน'],['cloud','ออนไลน์ทุกที่','เลขรายการจากฐานข้อมูลกลาง ไม่ต้องรันเลขแยกเครื่อง']];
  return '<section class="kp-auth-intro"><div class="kp-auth-content">'+
   '<a class="kp-auth-brand" href="#" data-action="home"><img class="kp-auth-logo" src="/kru-pasadu-icon.svg" alt="โลโก้ครูพัสดุ"><span><strong>ครูพัสดุ</strong><small>ทำเรื่องพัสดุให้เป็นเรื่องง่าย</small></span></a>'+
   '<span class="kp-auth-eyebrow">✦ แพลตฟอร์มงานพัสดุยุคใหม่สำหรับสถานศึกษา</span>'+
   '<h1>งานพัสดุของโรงเรียน<br><em>ง่ายขึ้นในที่เดียว</em></h1>'+
   '<p class="kp-auth-lead">จัดซื้อ จัดจ้าง ออกเลขเอกสารกลาง และพิมพ์แบบฟอร์ม PDF ได้จากทุกที่ ให้ทีมเจ้าหน้าที่ทำงานร่วมกันอย่างเป็นระเบียบ</p>'+
   '<div class="kp-pipeline"><div class="kp-pipeline-title">'+i('dashboard')+' เส้นทางการทำงานที่เข้าใจง่าย</div><div class="kp-pipeline-track">'+
   steps.map((st,n)=>'<div class="kp-pipeline-node"><span class="kp-pipeline-icon">'+i(st[0])+'</span><b>'+(n+1)+'. '+st[1]+'</b><small>'+st[2]+'</small></div>').join('')+
   '</div></div><div class="kp-benefits">'+
   benefits.map(x=>'<article class="kp-benefit">'+i(x[0])+'<h3>'+x[1]+'</h3><p>'+x[2]+'</p></article>').join('')+
   '</div><div class="kp-intro-note">* ระบบอยู่ระหว่างพัฒนาและตรวจรับแม่แบบเอกสารราชการ PDF สามารถบันทึกลงคอมพิวเตอร์หรือพื้นที่จัดเก็บของเจ้าหน้าที่ได้ตามต้องการ</div>'+
   '</div></section>';
}
function auth(){
  const tab=state.authMode==='signup'?'signup':'login';
  const mode=state.recoveryMode?'recovery':state.authForgot?'forgot':tab;
  const mail=e(state.authEmail||rememberedEmail());
  const title={login:'ยินดีต้อนรับกลับ',signup:'เริ่มต้นกับครูพัสดุ',forgot:'ลืมรหัสผ่าน?',recovery:'ตั้งรหัสผ่านใหม่'}[mode];
  const subtitle={login:'เข้าสู่ระบบเพื่อจัดการงานพัสดุของโรงเรียน',signup:'สร้างบัญชีแล้วรอผู้ดูแลโรงเรียนกำหนดสิทธิ์',forgot:'กรอกอีเมลที่ใช้สมัคร เพื่อรับลิงก์ตั้งรหัสผ่านใหม่',recovery:'กำหนดรหัสผ่านใหม่สำหรับบัญชีของคุณ'}[mode];
  const password=(name,label,auto='current-password')=>'<div class="kp-field"><label for="kp-'+name+'">'+label+'</label><div class="kp-password-wrap"><input id="kp-'+name+'" name="'+name+'" type="password" '+(auto==='current-password'?'':'minlength="8" ')+'required autocomplete="'+auto+'" placeholder="อย่างน้อย 8 ตัวอักษร"><button type="button" class="kp-eye" data-action="show-password" data-target="kp-'+name+'" aria-label="แสดงรหัสผ่าน">แสดง</button></div></div>';
  let fields='';
  if(mode==='login')fields='<form id="auth-form" class="kp-login-form"><div class="kp-field"><label for="kp-email">อีเมล</label><input id="kp-email" name="email" type="email" autocomplete="email" required value="'+mail+'" placeholder="you@school.ac.th"></div>'+
    password('password','รหัสผ่าน')+
    '<div class="kp-auth-row"><label class="kp-remember"><input name="remember_email" type="checkbox" '+(rememberedEmail()?'checked':'')+'>จดจำอีเมลของฉัน</label><button type="button" class="kp-inline-link" data-action="forgot-password">ลืมรหัสผ่าน?</button></div>'+
    '<button class="kp-main-button" type="submit">เข้าสู่ระบบ →</button></form>';
  else if(mode==='signup')fields='<form id="auth-form" class="kp-login-form"><div class="kp-field"><label for="kp-fullname">ชื่อ–นามสกุลเจ้าหน้าที่</label><input id="kp-fullname" name="full_name" autocomplete="name" required minlength="3" maxlength="150" placeholder="ระบุชื่อ–นามสกุลจริง"></div>'+
    '<div class="kp-field"><label for="kp-email">อีเมล</label><input id="kp-email" name="email" type="email" autocomplete="email" value="'+mail+'" required placeholder="you@school.ac.th"></div>'+
    password('password','ตั้งรหัสผ่าน','new-password')+
    password('confirm_password','ยืนยันรหัสผ่าน','new-password')+
    '<div class="kp-password-note">อย่างน้อย 8 ตัวอักษร แนะนำใช้รหัสผ่านที่ไม่ซ้ำกับบริการอื่น</div>'+
    '<button class="kp-main-button" type="submit">สมัครสมาชิก →</button></form>';
  else if(mode==='forgot')fields='<div class="kp-auth-tip">เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลของคุณ หากมีบัญชีอยู่ในระบบ</div><form class="kp-login-form" id="forgot-form">'+
    '<div class="kp-field"><label for="kp-forgot-email">อีเมลบัญชี</label><input id="kp-forgot-email" name="email" type="email" autocomplete="email" required value="'+mail+'" placeholder="you@school.ac.th"></div>'+
    '<button class="kp-main-button" type="submit">ส่งลิงก์ตั้งรหัสผ่านใหม่</button></form>'+
    '<button class="kp-inline-link kp-back" data-action="login">← กลับไปเข้าสู่ระบบ</button>';
  else fields='<form class="kp-login-form" id="reset-password-form">'+
    password('password','รหัสผ่านใหม่','new-password')+password('confirm_password','ยืนยันรหัสผ่านใหม่','new-password')+
    '<button class="kp-main-button" type="submit">บันทึกรหัสผ่านใหม่</button></form>'+
    '<p class="kp-auth-footnote">ลิงก์ตั้งรหัสผ่านมีอายุจำกัด หากไม่สามารถบันทึกได้ กรุณาขอลิงก์ใหม่</p>';
  const note=mode==='login'||mode==='signup'?'<div class="kp-divider">หรือ</div><button class="kp-demo-button" data-action="demo">'+i('eye')+' ทดลองดูระบบโดยไม่ต้องสมัคร</button>':null;
  app.innerHTML='<main class="kp-auth-screen">'+authHero()+'<section class="kp-auth-right"><div class="kp-auth-right-inner">'+
    '<div class="kp-auth-identity" aria-label="ครูพัสดุ ทำเรื่องพัสดุให้เป็นเรื่องง่าย">'+
      '<img class="kp-auth-identity-image" src="/kru-pasadu-icon.svg" alt="โลโก้ครูพัสดุ">'+
      '<div class="kp-auth-identity-name">ครูพัสดุ</div>'+
      '<div class="kp-auth-identity-tagline">ทำเรื่องพัสดุให้เป็นเรื่องง่าย</div>'+
    '</div>'+
    '<div class="kp-login-card">'+
      '<div class="kp-form-heading"><h2>'+title+'</h2><p class="kp-login-subtitle">'+subtitle+'</p></div>'+
      (mode==='login'||mode==='signup'?signupTabs():'')+
      msg()+fields+(note||'')+
      (mode==='login'||mode==='signup'?'<p class="kp-auth-footnote">ใช้ตัวจัดการรหัสผ่านของเบราว์เซอร์ได้อย่างปลอดภัย ระบบจะจดจำเพียงอีเมลเมื่อคุณเลือกเท่านั้น</p>':'')+
    '</div></div></section></main>';
}

function verificationPending(){
 const email=e(state.pendingSignupEmail||'อีเมลที่ลงทะเบียน');
 app.innerHTML='<div class="auth-layout"><div class="auth-art"><h1>ครูพัสดุ<br>พร้อมให้คุณเริ่มต้น</h1><p>ระบบจัดซื้อจัดจ้างออนไลน์สำหรับโรงเรียน พร้อมการกำหนดสิทธิ์เฉพาะบุคลากรของสถานศึกษา</p></div>'+
 '<div class="auth-box"><a href="#" data-action="home">'+logo()+'</a>'+
 '<div class="verify-illustration">'+i('check')+'</div><h2>สมัครบัญชีเรียบร้อยแล้ว</h2>'+
 '<p>ระบบของโรงเรียนนี้ยังเปิดการยืนยันอีเมล กรุณาดำเนินการอีกเพียงขั้นตอนเดียวก่อนเข้าสู่ระบบ</p>'+
 '<div class="verify-email-box"><span>ส่งอีเมลยืนยันไปที่</span><strong>'+email+'</strong></div>'+
 msg()+
 '<div class="verify-steps"><p><b>1.</b> เปิดกล่องจดหมายของคุณ (ตรวจโฟลเดอร์สแปมด้วย)</p>'+
 '<p><b>2.</b> เปิดอีเมลจาก Supabase Auth แล้วคลิกลิงก์ <b>Confirm email address</b></p>'+
 '<p><b>3.</b> กลับมาที่ครูพัสดุและเข้าสู่ระบบ จากนั้นรอแอดมินโรงเรียนเพิ่มสิทธิ์ใช้งาน</p></div>'+
 '<div class="verify-actions">'+btn('เข้าสู่ระบบ','login','primary')+btn('ส่งอีเมลยืนยันอีกครั้ง','resend-confirmation','secondary')+'</div>'+
 '<p class="hint">ระบบจะไม่ขอรหัสผ่านจากคุณผ่านอีเมล และเมื่อผู้ดูแลระบบปิดการยืนยันอีเมล ขั้นตอนนี้จะไม่ปรากฏสำหรับผู้สมัครใหม่</p>'+
 '</div></div>';
}
const menu=[['dashboard','ภาพรวม',i('dashboard')],['records','ทะเบียนจัดซื้อจัดจ้าง',i('file')],['registry','ทะเบียนคุมเลขเอกสาร',i('book')],['create','สร้างรายการใหม่',i('plus')]];

function subscriptionDate(v){return v?new Date(v).toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Bangkok'}):'–';}
function subscriptionLabel(status){return ({trial:'ทดลองใช้ฟรี',active:'สมาชิกรายปี',expired:'หมดสิทธิ์ใช้งาน',suspended:'ถูกระงับใช้งาน'})[status]||'รอเปิดใช้งาน';}
function subscriptionBanner(){
 if(state.demo||!state.school)return '';
 const a=state.subscription;
 if(!a)return '<div class="sub-banner sub-neutral">กำลังตรวจสอบสิทธิ์โรงเรียน กรุณาโหลดหน้าใหม่</div>';
 const status=String(a.status||'expired'),remaining=Math.max(0,Number(a.trial_limit||10)-Number(a.used_count||0));
 const expiry=status==='active'?a.paid_until:(a.plan==='trial'?a.trial_ends_at:a.paid_until);
 const detail=status==='trial'
  ?'ใช้ไป '+a.used_count+' / '+a.trial_limit+' ชุด • คงเหลือ '+remaining+' ชุด • ทดลองได้ถึง '+subscriptionDate(a.trial_ends_at)+' (อย่างใดถึงก่อน)'
  :status==='active'?'ใช้งานได้ถึง '+subscriptionDate(a.paid_until)+' • แพ็กเกจรายปี'
  :'ไม่สามารถสร้างชุดเอกสารใหม่ได้ แต่ยังดูและพิมพ์เอกสารย้อนหลังได้';
 return '<div class="sub-banner sub-'+e(status)+'"><div><strong>'+e(subscriptionLabel(status))+'</strong><p>'+e(detail)+'</p></div>'+
  (a.can_create?'<span class="sub-expiry">สิ้นสุด '+e(subscriptionDate(expiry))+'</span>':
   '<button type="button" class="sub-contact" data-action="subscription-help">ติดต่อเพื่อต่ออายุ</button>')+'</div>';
}
async function refreshSubscription(){
 if(state.demo||!state.school){state.subscription=null;return;}
 const {data,error}=await db.rpc('get_school_subscription_status',{p_school_id:state.school.id});
 if(error){state.subscription=null;throw error;}
 state.subscription=data;
}
const canCreate=()=>state.demo||state.subscription?.can_create===true;
function createAction(){return canCreate()?btn(i('plus')+' สร้างรายการใหม่','create'):
 '<button type="button" class="secondary" data-action="subscription-help">สิทธิ์สร้างเอกสารหมดอายุ</button>';}
function sidebar(){let items=[...menu];if(isSchoolAdmin()){items.push(['members','จัดการผู้ใช้งาน',i('users')]);items.push(['templates','แม่แบบเอกสาร',i('file')]);}if(isAdmin())items.push(['settings','ข้อมูลโรงเรียน',i('settings')]);return '<aside class="sidebar"><div class="side-brand">'+logo()+'</div>'+schoolIdentity()+'<div class="side-menu-label">งานพัสดุ</div>'+items.map(([act,label,icon])=>'<button class="navlink '+(state.page===act?'active':'')+'" data-action="'+act+'">'+icon+label+'</button>').join('')+(state.owner?'<div class="side-menu-label">เจ้าของระบบ</div><button data-action="owner" class="navlink">'+i('building')+'บริหารโรงเรียน</button>':'')+'<div class="side-footer">'+(state.demo?'โหมดตัวอย่าง (ไม่เก็บข้อมูล)':'บัญชีโรงเรียนออนไลน์')+'<br>ครูพัสดุ v0.1 · รุ่นทดลอง</div></aside>';}
function shell(title,sub,body){const top='<header class="topbar"><div class="top-school">'+schoolLogo('topbar')+'<div><h2>'+e(state.school?.name||'ครูพัสดุ')+'</h2><p>'+e(sub||'ระบบจัดซื้อจัดจ้างออนไลน์')+'</p></div></div>'+accountHeader()+'</header>';app.innerHTML='<div class="shell">'+sidebar()+'<div class="workspace">'+top+'<div class="content">'+(state.demo?'<div class="alert">โหมดตัวอย่าง — ข้อมูลและเอกสารไม่ถูกบันทึกบนเซิร์ฟเวอร์ กรุณาเข้าสู่ระบบเพื่อใช้งานจริง</div>':subscriptionBanner())+msg()+body+'<div class="footer">ครูพัสดุ • KRU PASADU — ระบบทดลองสำหรับพัฒนาและตรวจรับ</div></div></div></div><div class="mobile-menu">'+menu.map(([a,t,ic])=>'<button data-action="'+a+'">'+ic+'<span>'+t.replace('ทะเบียนจัดซื้อจัดจ้าง','ทะเบียน')+'</span></button>').join('')+'</div>';}
function heading(title,sub,action=''){return '<div class="page-title"><div><h1>'+title+'</h1><p>'+sub+'</p></div>'+action+'</div>';}
const badge=r=>'<span class="tag '+(r.state==='draft'?'amber':'')+'">'+({draft:'ฉบับร่าง',review:'รอตรวจสอบ',approved:'อนุมัติ',received:'ตรวจรับแล้ว',completed:'เสร็จสิ้น',cancelled:'ยกเลิก'}[r.state]||'ร่าง')+'</span>';
function recordTable(rows){return '<div class="table-scroller"><table><thead><tr><th>เลขที่</th><th>วันที่</th><th>รายการ</th><th>ประเภท</th><th>วงเงิน</th><th>สถานะ</th><th></th></tr></thead><tbody>'+ (rows.length?rows.map(r=>'<tr><td><b>'+e(r.document_number)+'/'+e(r.fiscal_year)+'</b></td><td>'+dateThai(r.document_date)+'</td><td><button class="linkish" data-action="open" data-id="'+e(r.id)+'">'+e(r.title)+'</button><br><small class="muted">'+e(r.vendor_name||'ยังไม่ระบุผู้ขาย')+'</small></td><td><span class="tag gray">'+(r.kind==='purchase'?'จัดซื้อ':'จัดจ้าง')+'</span></td><td class="amount">'+money(r.total_satang)+'</td><td>'+badge(r)+'</td><td>'+btn('เปิดดู','open','mini-btn','data-id="'+e(r.id)+'"')+(canEditMainRecord(r)?btn('แก้ไข','open-edit','mini-btn','data-id="'+e(r.id)+'"'):'')+(canDeleteMainRecord(r)?btn('ลบ','delete-record','mini-btn kp-danger-button','data-id="'+e(r.id)+'" title="ลบรายการฉบับร่าง"'):'')+'</td></tr>').join(''):'<tr><td colspan="7" class="empty">ยังไม่มีรายการ เริ่มต้นสร้างรายการใหม่ได้เลย</td></tr>')+'</tbody></table></div>';}

function openDeleteRecordDialog(rec){
 if(!canDeleteMainRecord(rec))return notify('ลบได้เฉพาะรายการฉบับร่างที่คุณมีสิทธิ์แก้ไข',true);
 document.getElementById('kp-delete-record-dialog')?.remove();
 const id=e(rec.id),title=e(rec.title);
 app.insertAdjacentHTML('beforeend',
  '<dialog id="kp-delete-record-dialog" class="kp-delete-dialog" aria-labelledby="kp-delete-record-title">'+
   '<div class="kp-delete-dialog-panel"><div class="kp-delete-icon" aria-hidden="true">!</div>'+
   '<h2 id="kp-delete-record-title">ยืนยันลบรายการฉบับร่าง?</h2>'+
   '<p>ต้องการนำรายการ <strong>'+title+'</strong> เลขที่ <strong>'+rec.document_number+'/'+rec.fiscal_year+'</strong> ออกจากทะเบียนที่แสดงหรือไม่?</p>'+
   '<div class="kp-delete-warning">ลบได้เฉพาะฉบับร่างที่ยังไม่มีเอกสารใช้จริง · เลขทะเบียนที่ออกแล้วและประวัติจะถูกเก็บไว้ตรวจสอบ และไม่นำเลขกลับมาใช้ซ้ำ</div>'+
   '<div class="kp-delete-dialog-actions">'+btn('ยกเลิก','cancel-delete-record','secondary')+
    btn('ยืนยันลบรายการ','confirm-delete-record','kp-danger-confirm','data-id="'+id+'"')+'</div></div></dialog>');
 document.getElementById('kp-delete-record-dialog')?.showModal();
}

const registrySeriesLabels={
 request:'รายงานขอซื้อ/ขอจ้าง (พว.)',
 general:'หนังสือรายงานผล / เบิกจ่าย (เลขร่วม)',
 acceptance:'ใบตรวจรับพัสดุ (ร.)',
 requisition:'ใบเบิกพัสดุ (จ.)',
 procurement_purchase:'ทะเบียนจัดซื้อ',
 procurement_hire:'ทะเบียนจัดจ้าง'
};
const registryFields={
 memo_number:'รายงานขอซื้อ/ขอจ้าง',
 approval_memo_number:'รายงานผลการพิจารณาฯ',
 payment_memo_number:'ทราบผลและขออนุมัติเบิกจ่าย',
 acceptance_number:'ใบตรวจรับพัสดุ',
 requisition_number:'ใบเบิกพัสดุ',
 procurement_number:'ทะเบียนจัดซื้อ/จัดจ้าง'
};
const registryStatusLabel={reserved:'จองเลข',used:'ใช้แล้ว',void:'ยกเลิก',conflict:'ต้องตรวจสอบ',resolved:'แก้รายการเดิมแล้ว'};
function registryDisplayNumber(row){
 if(!row)return '';
 const suffix=row.serial_no?row.serial_no+'/'+row.year_be:row.original_text||'เลขเดิมผิดรูปแบบ';
 if(row.series==='request')return (normalizeMemoPrefix(state.school?.memo_prefix||'พว.')||'พว.')+' '+suffix;
 if(row.series==='acceptance')return 'ร. '+suffix;
 if(row.series==='requisition')return 'จ. '+suffix;
 return suffix;
}
async function loadOfficialNumbers(){
 if(state.demo){state.officialNumbers=[];return;}
 if(!state.school)return;
 const all=[];let offset=0;const size=500;
 for(;;){
  const {data,error}=await db.from('official_number_registry').select('*,procurements(title,vendor_name,kind)')
   .eq('school_id',state.school.id).order('created_at',{ascending:false})
   .order('id',{ascending:false}).range(offset,offset+size-1);
  if(error)throw Error('โหลดทะเบียนคุมเลขไม่สำเร็จ: '+error.message);
  all.push(...(data||[]));if(!data||data.length<size)break;offset+=size;
 }
 state.officialNumbers=all;
}
async function loadOfficialNumberStarts(){
 if(state.demo||!isSchoolAdmin()||!state.school?.id){state.numberStarts=[];return;}
 const year=Number(state.numberSetupYear)||(new Date().getFullYear()+543);
 const {data,error}=await db.rpc('get_official_number_starts',{p_school_id:state.school.id,p_year:year});
 if(error)throw Error('โหลดเลขถัดไปไม่สำเร็จ: '+error.message);
 state.numberStarts=data||[];
}
function officialRegistry(){
 const all=state.officialNumbers||[],q=String(state.numberFilter||'').toLowerCase();
 const recordsById=new Map(state.records.map(r=>[r.id,r]));
 const filtered=all.filter(n=>{
  const linked=recordsById.get(n.procurement_id)||n.procurements;
  if(state.numberSeries!=='all'&&n.series!==state.numberSeries)return false;
  if(state.numberStatus!=='all'&&n.status!==state.numberStatus)return false;
  if(state.numberYear!=='all'&&String(n.year_be)!==String(state.numberYear))return false;
  return !q||[registryDisplayNumber(n),n.original_text,registryFields[n.document_field],linked?.title,linked?.vendor_name,n.note]
   .some(t=>String(t||'').toLowerCase().includes(q));
 });
 const options=(set,current)=>set.map(([value,label])=>'<option value="'+e(value)+'" '+(current===value?'selected':'')+'>'+e(label)+'</option>').join('');
 const years=[...new Set(all.map(n=>String(n.year_be)))].sort().reverse();
 const fmt=n=>'<span class="tag '+(n.status==='reserved'?'amber':n.status==='conflict'?'red':n.status==='void'?'gray':'')+'">'+registryStatusLabel[n.status]+'</span>';
 const rows=filtered.map(n=>{
  const rec=recordsById.get(n.procurement_id)||n.procurements,canUse=n.status==='reserved'&&(isSchoolAdmin()||state.memberships.some(m=>m.school_id===state.school?.id&&m.role==='procurement_head')||n.created_by===state.user?.id),canAdmin=isSchoolAdmin();
  const controls=(canUse?btn('ใช้เลข','registry-use','mini-btn','data-id="'+e(n.id)+'"'):'')+
   (canAdmin&&['reserved','used'].includes(n.status)?btn('แก้เลข','registry-edit','mini-btn','data-id="'+e(n.id)+'"')+btn('ยกเลิก','registry-void','mini-btn','data-id="'+e(n.id)+'"'):canAdmin&&n.status==='conflict'?btn('แก้เลขเดิมที่ผิดรูปแบบ','registry-resolve','mini-btn','data-id="'+e(n.id)+'"'):'');
  const title=rec?.title||'เลขเดิมจากรายการที่บันทึกไว้';
  return '<tr><td><strong>'+e(registryDisplayNumber(n))+'</strong><small class="muted" style="display:block">'+e(registrySeriesLabels[n.series]||n.series)+'</small></td>'+
  '<td>'+e(registryFields[n.document_field]||n.document_field)+'</td>'+
  '<td>'+e(title)+(n.note?'<small class="muted" style="display:block">'+e(n.note)+'</small>':'')+'</td>'+
  '<td>'+dateThai(n.created_at?.slice(0,10))+'</td><td>'+fmt(n)+'</td>'+
  '<td>'+((rec)?btn('เปิดรายการ','registry-open','mini-btn','data-id="'+e(rec.id)+'"'):'')+controls+'</td></tr>';
 }).join('');
 const summary='<div class="stats-grid">'+[
  ['เลขทั้งหมด',all.length],['ใช้แล้ว',all.filter(n=>n.status==='used').length],
  ['จองเลข',all.filter(n=>n.status==='reserved').length],['ต้องตรวจสอบ',all.filter(n=>n.status==='conflict').length]
 ].map(([title,n])=>'<div class="stat"><div class="stat-top">'+title+'</div><strong>'+n+'</strong></div>').join('')+'</div>';
 const filter='<form id="registry-filter-form" class="kp-registry-filters">'+
 '<input class="input" name="query" aria-label="ค้นหาเลขที่หรือเรื่อง" placeholder="ค้นหาเลขที่ / เรื่อง / ผู้ขาย..." value="'+e(state.numberFilter)+'">'+
 '<select class="select" name="series">'+options([['all','ทุกประเภท'],...Object.entries(registrySeriesLabels)],state.numberSeries)+'</select>'+
 '<select class="select" name="year">'+options([['all','ทุกปี'],...years.map(y=>[y,y])],state.numberYear)+'</select>'+
 '<select class="select" name="status">'+options([['all','ทุกสถานะ'],...Object.entries(registryStatusLabel)],state.numberStatus)+'</select>'+
 '<button class="secondary" type="submit">ค้นหา</button></form>';
 const setupYear=Number(state.numberSetupYear)||(new Date().getFullYear()+543);
 const setup=(state.numberStarts||[]).reduce((obj,x)=>(obj[x.series]=x,obj),{});
 const setupSeries=['request','general','acceptance','requisition'];
 const setupNotes={
  request:'เลข พว. สำหรับรายงานขอซื้อและขอจ้าง ใช้ลำดับเดียวกัน',
  general:'ทะเบียนร่วมของรายงานผลการพิจารณาฯ และบันทึกเบิกจ่าย ออกตามลำดับจริง ไม่แยกเลขตามแบบฟอร์ม',
  acceptance:'เลข ร. ของใบตรวจรับพัสดุและงานจ้าง',
  requisition:'เลข จ. ของใบเบิกพัสดุ เฉพาะรายการจัดซื้อ'
 };
 const configs=isSchoolAdmin()?'<details class="card kp-registry-admin" open>'+
  '<summary>กำหนดเลขถัดไปอัตโนมัติ (แอดมินโรงเรียน)</summary>'+
  '<p class="hint">ตั้งเลขเริ่มต้นแยกตามโรงเรียน / ปี พ.ศ. / ประเภททะเบียนได้ทีละประเภท ระบบจะนับเลขต่อเนื่อง ไม่ย้อนกลับไปใช้เลขที่เคยจองหรือยกเลิก</p>'+
  '<form id="registry-setup-year-form" class="kp-registry-year"><label for="registry-setup-year">ปี พ.ศ. ที่ต้องการตั้งเลข</label>'+
  '<input id="registry-setup-year" class="input" type="number" min="2500" max="2700" name="year" value="'+setupYear+'" required>'+
  '<button class="secondary" type="submit">ดูเลขของปีนี้</button></form>'+
  '<div class="kp-number-setup-grid">'+setupSeries.map(series=>{
   const item=setup[series]||{last_number:0,registry_max:0,next_number:1};
   const next=Number(item.next_number)||1;
   return '<form class="kp-number-setup-card" data-number-setup-series="'+series+'" id="registry-start-form-'+series+'" data-registry-start-form>'+
    '<h3>'+e(registrySeriesLabels[series])+'</h3>'+
    '<p class="hint">'+e(setupNotes[series])+'</p>'+
    '<div class="kp-number-setup-next"><span>เลขถัดไปตามทะเบียน</span><strong>'+next+'/'+setupYear+'</strong></div>'+
    '<p class="kp-number-setup-used">เลขสูงสุดที่จัดสรร/จองแล้ว '+Math.max(Number(item.last_number)||0,Number(item.registry_max)||0)+'</p>'+
    '<input type="hidden" name="series" value="'+series+'"><input type="hidden" name="year" value="'+setupYear+'">'+
    '<label for="registry-next-'+series+'">กำหนดเลขถัดไป (เฉพาะลำดับ)</label>'+
    '<div class="kp-number-setup-actions"><input id="registry-next-'+series+'" class="input" name="next" type="number" min="'+next+'" max="9999999" step="1" required value="'+next+'">'+
    '<button class="primary" type="submit">บันทึกเลขถัดไป</button></div>'+
    '</form>';
  }).join('')+'</div>'+
  '<p class="hint kp-number-setup-notice">เช่น เลขล่าสุด 3/2569 ต้องการให้ใบถัดไปเป็น 4/2569 ให้ใส่ 4 • ไม่แก้เลขที่ออกแล้ว • คำนำหน้า พว., ร., จ. ระบบจัดให้เอง</p>'+
  '</details>':'';
 shell('ทะเบียนคุมเลขเอกสาร','โรงเรียน / งานพัสดุ',heading('ทะเบียนคุมเลขเอกสาร','ตรวจสอบเลขที่ ใช้กับเรื่องอะไร ใครจองและสถานะล่าสุด',btn('รีเฟรช','registry-refresh','secondary'))+
  '<div class="alert">เลขที่ใหม่ออกจากฐานข้อมูลกลาง ป้องกันเลขซ้ำระหว่างเจ้าหน้าที่ เลขยกเลิกจะไม่ถูกนำกลับมาใช้ ข้อมูลเดิมที่ซ้ำต้องตรวจสอบก่อนออกเลขใหม่</div>'+
 summary+'<section class="card"><h2>รายการเลขเอกสาร '+filtered.length+' รายการ</h2>'+filter+
 '<div class="table-scroller"><table><thead><tr><th>เลขที่ / ทะเบียน</th><th>เอกสาร</th><th>เรื่อง</th><th>วันที่ลงทะเบียน</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>'+
 (rows||'<tr><td colspan="6" class="empty">ไม่พบเลขตามเงื่อนไขการค้นหา</td></tr>')+
 '</tbody></table></div></section>'+configs);
}


const templateEditor=createTemplateEditor({db,state,shell,heading,btn,buildDocuments,notify});
function liveTemplateLayouts(record){return activeTemplateLayouts(state.schoolTemplates||{},state.templateVersions||{},record);}
async function ensurePinnedTemplateVersions(record){
 if(state.demo||!record||record.state==='draft')return;
 const pins=Object.entries(record.document_template_versions||{}).filter(([,v])=>Number(v)>0);
 const needed=pins.filter(([key,version])=>!state.templateVersions[key+':'+version]);
 if(!needed.length)return;
 const {data,error}=await db.from('school_document_template_versions').select('template_key,version,layout')
  .eq('school_id',state.school.id).in('template_key',needed.map(([key])=>key))
  .in('version',needed.map(([,version])=>Number(version)));
 if(error)throw Error('โหลดแม่แบบเวอร์ชันเอกสารเก่าไม่สำเร็จ: '+error.message);
 for(const row of data||[])state.templateVersions[row.template_key+':'+row.version]=row;
 if(needed.some(([key,v])=>!state.templateVersions[key+':'+v]))
  throw Error('ไม่พบแม่แบบที่ใช้กับเอกสารฉบับเดิม กรุณาติดต่อแอดมินโรงเรียน');
}
function dashboard(){const rows=state.records.filter(r=>!r.deleted_at);const purch=rows.filter(r=>r.kind==='purchase'),hire=rows.filter(r=>r.kind==='hire');const total=rows.reduce((s,r)=>s+Number(r.total_satang||0),0);const block=(t,n,ico,note)=>'<div class="stat"><div class="stat-top"><span>'+t+'</span><span class="stat-ico">'+ico+'</span></div><strong>'+n+'</strong><small>'+note+'</small></div>';shell('ภาพรวม','งานพัสดุ / ภาพรวม',heading('สวัสดี ยินดีต้อนรับ 👋','ติดตามงานพัสดุทั้งหมดในโรงเรียนได้จากที่เดียว',createAction())+'<div class="stats-grid">'+block('รายการทั้งหมด',rows.length,'▤','รายการที่บันทึกแล้ว')+block('งานจัดซื้อ',purch.length,'◈','ทะเบียนจัดซื้อ')+block('งานจัดจ้าง',hire.length,'⚒','ทะเบียนจัดจ้าง')+block('วงเงินรวม',money(total),'฿','บาท รวมทุกประเภท')+'</div><div class="grid-two"><section class="card"><div class="section-head"><h2>รายการล่าสุด</h2>'+btn('ดูทั้งหมด →','records','mini-btn')+'</div>'+recordTable(rows.slice(0,6))+'</section><section class="card"><h2>ทางลัดงานพัสดุ</h2><div class="action-grid"><button class="action-card" data-action="create"><span class="action-icon">'+i('plus')+'</span>สร้างรายการ</button><button class="action-card" data-action="records"><span class="action-icon">'+i('file')+'</span>ค้นหาเอกสาร</button><button class="action-card" data-action="settings"><span class="action-icon">'+i('settings')+'</span>ผู้ลงนาม</button><button class="action-card" data-action="registry"><span class="action-icon">'+i('book')+'</span>ทะเบียนคุมเลข</button></div><div class="alert" style="margin:18px 0 0">เอกสารที่ระบบสร้างเป็นแบบร่าง ต้องตรวจสอบกับระเบียบที่มีผลบังคับก่อนใช้งานราชการ</div></section></div>');}
function records(){const q=(state.filter||'').toLowerCase();const rows=state.records.filter(r=>!r.deleted_at&&(r.title+' '+r.vendor_name+' '+r.document_number).toLowerCase().includes(q));shell('ทะเบียนพัสดุ','รายการจัดซื้อจัดจ้าง',heading('ทะเบียนจัดซื้อจัดจ้าง','เปิดดูรายการแล้วเลือก พิมพ์ / บันทึก PDF เพื่อเก็บไฟล์ไว้ที่ใดก็ได้ตามต้องการ',createAction())+'<section class="card"><div class="filters"><input class="input" id="record-search" placeholder="ค้นหาเรื่อง ผู้ขาย หรือเลขที่..." value="'+e(state.filter)+'">'+btn(i('search')+' ค้นหา','search','secondary')+'</div>'+recordTable(rows)+'</section>');}
function updatePayablePreview(){
 const form=document.getElementById('doc-meta-form'),output=document.getElementById('kp-payable-preview');if(!form||!output)return;
 const total=Number(state.currentRecord?.total_satang||0)/100;
 const val=k=>{const x=form.querySelector('[name="doc_'+k+'"]')?.value;return x===''||x===undefined?0:Number(x)};
 const withholding=val('withholding_baht'),fine=val('fine_baht'),net=Math.max(0,total-withholding-fine);
 const entered=form.querySelector('[name="doc_payable_baht"]')?.value||'';
 output.textContent='ยอดคำนวณจากวงเงิน '+total.toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})+
 ' บาท − ภาษีหัก ณ ที่จ่าย − ค่าปรับ = '+net.toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})+
 ' บาท'+(entered?' · ยอดที่ระบุเอง '+Number(entered).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})+' บาท':' · หากไม่กรอกยอดสุทธิ ระบบใช้ยอดคำนวณนี้ในเอกสาร');
}
function editDocumentMeta(){const r=state.currentRecord;if(!r)return detail();shell('ข้อมูลเอกสารราชการ','เลขที่หนังสือและข้อมูลตรวจรับ',heading('ข้อมูลประกอบเอกสาร','กรอกเฉพาะเมื่อถึงขั้นตอนนั้น ข้อมูลเดียวกันใช้กับเอกสารทุกฉบับ ไม่ต้องกรอกซ้ำ')+'<form id="doc-meta-form" class="card"><h2>'+e(r.title)+'</h2>'+docMetaInputs({...r.document_meta,memo_prefix:r.document_meta?.memo_prefix||state.school?.memo_prefix||''},{kind:r.kind})+'<p id="kp-payable-preview" class="hint" aria-live="polite"></p><div class="row">'+btn('กลับไปเอกสาร','detail','secondary')+'<button type="submit" class="primary">บันทึกข้อมูลเอกสาร</button></div></form>');updatePayablePreview();}
function form(){
 const d=state.draft,editing=!!state.editingRecordId;
 const step=Math.min(4,Math.max(1,Number(state.wizardStep)||1));
 const input=(label,name,value='',type='text',attrs='')=>'<div class="field"><label>'+e(label)+'</label><input class="input" name="'+name+'" type="'+type+'" '+attrs+' value="'+e(value)+'"></div>';
 const area=(label,name,value)=>'<div class="field"><label>'+e(label)+'</label><textarea class="textarea" name="'+name+'">'+e(value)+'</textarea></div>';
 const itemDescriptionLabel=d.kind==='hire'?'รายละเอียดงานจ้าง':'รายละเอียดพัสดุ';
 const itemHeading='<div class="kp-item-entry-head" aria-hidden="true">'+
  '<span>'+itemDescriptionLabel+'</span><span>จำนวน</span><span>หน่วยนับ</span><span>ราคาต่อหน่วย (บาท)</span><span>ลบ</span></div>';
 const items=state.items.map((x,k)=>'<div class="item-entry kp-item-entry">'+
  '<div class="kp-item-cell kp-item-cell-name"><label for="kp-item-'+k+'-name">'+itemDescriptionLabel+' — รายการที่ '+(k+1)+'</label>'+
  '<div class="kp-item-name-wrap"><span class="kp-item-index" aria-hidden="true">'+(k+1)+'</span>'+
  '<input id="kp-item-'+k+'-name" class="input" data-item="'+k+'" data-key="name" aria-label="'+itemDescriptionLabel+' รายการที่ '+(k+1)+'" placeholder="'+(d.kind==='hire'?'เช่น งานซ่อมแซมโต๊ะเรียน':'เช่น กระดาษ A4 ขนาด 80 แกรม')+'" value="'+e(x.name)+'"></div></div>'+
  '<div class="kp-item-cell"><label for="kp-item-'+k+'-qty">จำนวน</label><input id="kp-item-'+k+'-qty" class="input" data-item="'+k+'" data-key="qty" type="number" inputmode="decimal" min=".01" step=".01" aria-label="จำนวนรายการที่ '+(k+1)+'" placeholder="1" value="'+e(x.qty)+'"></div>'+
  '<div class="kp-item-cell"><label for="kp-item-'+k+'-unit">หน่วยนับ</label><input id="kp-item-'+k+'-unit" class="input" data-item="'+k+'" data-key="unit" aria-label="หน่วยนับรายการที่ '+(k+1)+'" placeholder="เช่น ชุด / รีม" value="'+e(x.unit)+'"></div>'+
  '<div class="kp-item-cell"><label for="kp-item-'+k+'-price">ราคาต่อหน่วย (บาท)</label><input id="kp-item-'+k+'-price" class="input" data-item="'+k+'" data-key="price" type="number" inputmode="decimal" min=".01" step=".01" aria-label="ราคาต่อหน่วยรายการที่ '+(k+1)+'" placeholder="0.00" value="'+e(x.price)+'"></div>'+
  '<button type="button" class="mini-btn kp-item-remove" data-action="remove-item" data-id="'+k+'" aria-label="ลบรายการที่ '+(k+1)+'" title="ลบรายการที่ '+(k+1)+'">×</button></div>').join('');
 const meta={...d,doc_memo_prefix:d.doc_memo_prefix||state.school.memo_prefix||''};
 const labels=['ข้อมูลหลัก','รายการพัสดุ','ผู้ขายและผู้ตรวจรับ','เลขหนังสือ / ตรวจสอบ'];
 const steps='<nav class="kp-wizard-nav" aria-label="ขั้นตอนกรอกข้อมูล">'+labels.map((label,i)=>'<span class="kp-wizard-step '+(step===i+1?'is-active':step>i+1?'is-done':'')+'" data-wizard-indicator="'+(i+1)+'">'+(i+1)+'. '+e(label)+'</span>').join('')+'</nav>';
 const panel=(number,title,inner)=>'<section class="card kp-wizard-panel" data-wizard-panel="'+number+'" style="'+(step===number?'':'display:none')+'"><h2>'+title+'</h2>'+inner+'</section>';
 const basic=panel(1,'ขั้นที่ 1 — ข้อมูลการจัดหา','<div class="form-grid"><div class="field"><label>ประเภทการจัดหา</label>'+(editing?'<input type="hidden" name="kind" value="'+e(d.kind)+'">':'')+'<select class="select" name="kind" '+(editing?'disabled':'')+'><option value="purchase" '+(d.kind!=='hire'?'selected':'')+'>จัดซื้อ</option><option value="hire" '+(d.kind==='hire'?'selected':'')+'>จัดจ้าง</option></select></div>'+input('วันที่เอกสาร','document_date',d.document_date||dateToday(),'date','required')+input('ปีงบประมาณ (พ.ศ.)','fiscal_year',d.fiscal_year||fiscalYear(),'number',editing?'required readonly':'required min="2500" max="2700"')+input('กลุ่มงาน/ฝ่ายที่ขอ','department',d.department||'')+'</div>'+input('เรื่องที่จัดซื้อ/จัดจ้าง','title',d.title||'','text','required maxlength="500" placeholder="เช่น ซื้อวัสดุสำนักงาน"')+area('เหตุผลและความจำเป็น','reason',d.reason||'')+input('แผนงาน/โครงการ/แหล่งเงิน','budget_source',d.budget_source||'','text','required'));
 const entries=panel(2,'ขั้นที่ 2 — รายการพัสดุ / งานจ้าง','<p class="muted">ระบุรายละเอียด จำนวน หน่วยนับ และราคาต่อหน่วยของแต่ละรายการ ระบบคำนวณวงเงินรวมให้อัตโนมัติ</p>'+'<div class="kp-item-entry-table">'+itemHeading+items+'</div>'+btn('+ เพิ่มรายการ','add-item','secondary')+'<div class="total-row"><span>วงเงินรวมสุทธิ</span><strong id="live-total">0.00 บาท</strong></div>');
 const vendor=panel(3,'ขั้นที่ 3 — ผู้ขายและผู้ตรวจรับ','<div class="form-grid">'+input('ชื่อร้านค้า/ผู้รับจ้าง','vendor_name',d.vendor_name||'')+input('กำหนดส่งมอบ (ถ้าทราบ)','due_date',d.due_date||'','date')+'</div>'+input('ชื่อผู้ตรวจรับ (เว้นว่างไว้ได้)','inspector_name',d.inspector_name||'')+'<div class="alert success-alert">เจ้าหน้าที่พัสดุ: '+e(state.school.officer_name||'ยังไม่ตั้งค่า')+' · หัวหน้าเจ้าหน้าที่: '+e(state.school.head_name||'ยังไม่ตั้งค่า')+' · ผู้อำนวยการ: '+e(state.school.director_name||'ยังไม่ตั้งค่า')+'</div><p class="hint">ข้อมูลผู้ลงนามดึงจากโรงเรียน ชื่อในเอกสารไม่ถือเป็นการอนุมัติหรือการลงนามจริง</p>'+docMetaWizardInputs(meta,3,d.kind||'purchase'));
 const docs=panel(4,'ขั้นที่ 4 — เลขที่หนังสือและตรวจสอบ','<p class="hint">รหัส พว. ใช้เฉพาะรายงานขอซื้อ/ขอจ้าง ส่วนรายงานผลการพิจารณาและบันทึกเบิกจ่ายใช้เพียงคำว่า ที่ ตามด้วยเลขที่ ไม่ต้องใส่ พว.</p>'+docMetaInputs(meta,{mode:'create',kind:d.kind||'purchase'})+docMetaWizardInputs(meta,4,d.kind||'purchase')+'<div id="wizard-review" class="kp-wizard-review"></div>');
 const footer='<div class="card kp-wizard-footer"><span class="kp-wizard-progress">ขั้น '+step+' จาก 4</span><div class="row">'+(step>1?btn('← ย้อนกลับ','wizard-prev','secondary'):btn('ยกเลิก',editing?'cancel-edit':'dashboard','secondary'))+(step<4?btn('ถัดไป →','wizard-next','primary'):'<button class="primary" type="submit">'+(editing?'บันทึกการแก้ไข':'บันทึกและออกเลขทะเบียน →')+'</button>')+'</div></div>';
 shell(editing?'แก้ไขรายการ':'สร้างรายการใหม่','งานพัสดุ / บันทึกรายการ',
  heading(editing?'แก้ไขรายการฉบับร่าง':'สร้างรายการจัดซื้อจัดจ้าง','กรอกทีละขั้นได้ ย้อนกลับได้ และไม่ต้องกรอกข้อมูลซ้ำ')+
  '<form id="procurement-form">'+steps+basic+entries+vendor+docs+footer+'</form>');
 updateTotal();updateWizardReview();
}
function updateWizardReview(){
 const review=document.getElementById('wizard-review');if(!review)return;
 const form=document.getElementById('procurement-form'),data=Object.fromEntries(new FormData(form));
 const sum=state.items.reduce((n,x)=>n+(Number(x.qty)||0)*(Number(x.price)||0),0);
 review.innerHTML='<h3>ตรวจสอบก่อนบันทึก</h3><p><b>เรื่อง:</b> '+e(data.title||'ยังไม่ระบุ')+'</p><p><b>ผู้ขาย:</b> '+e(data.vendor_name||'ยังไม่ระบุ')+'</p><p><b>จำนวน:</b> '+state.items.length+' รายการ — <b>วงเงิน:</b> '+sum.toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})+' บาท</p><p class="hint">เมื่อบันทึกแล้ว ยังเพิ่มเลขที่ใบสั่งซื้อ ข้อมูลตรวจรับและการเบิกจ่ายได้ภายหลัง</p>';
}
function moveWizard(delta){
 const wizardForm=document.getElementById('procurement-form');if(!wizardForm)return;
 const step=Number(state.wizardStep)||1;
 if(delta>0){
  const section=wizardForm.querySelector('[data-wizard-panel="'+step+'"]');
  for(const input of section.querySelectorAll('input[required],select[required],textarea[required]')){
   if(!input.checkValidity()){input.reportValidity();return;}
  }
  if(step===2){
   const total=state.items.reduce((n,x)=>n+Number(x.qty)*Number(x.price),0);
   if(!state.items.length||state.items.some(x=>!String(x.name||'').trim()||!String(x.unit||'').trim()||!(Number(x.qty)>0)||!(Number(x.price)>0))||!(Number.isFinite(total)&&total>0&&Number.isSafeInteger(Math.round(total*100))))
    return notify('กรอกรายการ จำนวน หน่วย และราคาให้ครบ พร้อมตรวจสอบว่ายอดเงินถูกต้อง',true);
  }
 }
 collectDraft();state.wizardStep=Math.max(1,Math.min(4,step+delta));form();
 document.getElementById('procurement-form')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function updateTotal(){const v=state.items.reduce((n,x)=>n+(Number(x.qty)||0)*(Number(x.price)||0),0);const el=document.getElementById('live-total');if(el){el.textContent=v.toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})+' บาท';el.style.color=(!Number.isFinite(v)||v<=0)?'#bf5140':'#0f8479';}}
function detail(){const r=state.currentRecord;if(!r){records();return;}const s=state.school;const docs=r.kind==='purchase'?['รายงานขอซื้อพัสดุ','รายละเอียดพัสดุแนบท้าย','รายงานผลการพิจารณาฯ','ใบตรวจรับพัสดุ','ขออนุมัติเบิกจ่าย','ใบเบิกพัสดุ']:['รายงานขอจ้าง','รายละเอียดงานจ้างแนบท้าย','รายงานผลการพิจารณาฯ','ใบตรวจรับงานจ้าง','ขออนุมัติเบิกจ่าย'];shell('เอกสาร '+r.document_number,'งานพัสดุ / รายละเอียดรายการ',heading(e(r.title),'เลขที่ '+e(r.document_number)+'/'+e(r.fiscal_year)+' • '+dateThai(r.document_date),(canEditMainRecord(r)?btn('แก้ไขรายการ','edit-record','secondary'):'')+(canEditDocumentMeta(r)?btn('ข้อมูลเอกสาร / ตรวจรับ / เบิกจ่าย','doc-meta','secondary'):'')+btn('ทะเบียนคุมเลข','registry','secondary')+(canEditDocumentMeta(r)?['memo_number','approval_memo_number','payment_memo_number',...(r.document_meta?.delivery_date?['acceptance_number',...(r.kind==='purchase'?['requisition_number']:[])]:[])].filter(key=>!r.document_meta?.[key]).map(key=>btn('ออกเลข'+(registryFields[key]||key),'registry-issue','secondary','data-field="'+e(key)+'"')).join(''):'')+btn(i('download')+' พิมพ์ / บันทึก PDF','print'))+'<div class="stats-grid">'+[['ประเภท',r.kind==='purchase'?'จัดซื้อ':'จัดจ้าง'],['เลขเอกสาร',r.document_number+'/'+r.fiscal_year],['รายการ',(r.items||[]).length],['วงเงิน',money(r.total_satang)+' บาท']].map(([x,y])=>'<div class="stat"><div class="stat-top">'+x+'</div><strong style="font-size:22px">'+e(y)+'</strong></div>').join('')+'</div><div class="grid-two"><div class="card"><h2>ข้อมูลรายการ</h2><p><b>ผู้ขาย:</b> '+e(r.vendor_name||'-')+'</p><p><b>เหตุผล:</b> '+e(r.reason||'-')+'</p><p><b>งบประมาณ:</b> '+e(r.budget_source||'-')+'</p><p><b>ผู้ตรวจรับ:</b> '+e(r.inspector_name||'เว้นชื่อให้กรอกเองบนเอกสาร')+'</p><p><b>ผู้อำนวยการ:</b> '+e(r.signers?.director||s.director_name||'-')+'</p>'+tableItems(r)+'</div><div class="card"><h2>ชุดเอกสารที่สร้างได้</h2>'+docs.map((d,k)=>'<div class="row" style="border-bottom:1px solid #e9eff1;padding:12px 0"><span style="font-size:13px">'+(k+1)+'. '+d+'</span><span class="tag gray">A4</span></div>').join('')+'<div class="print-toolbar">'+(canEditMainRecord(r)?btn('แก้ไขรายการ','edit-record','secondary'):'')+btn(i('eye')+' ดูตัวอย่าง','preview','secondary')+btn(i('download')+' พิมพ์/PDF','print')+'</div><p class="hint">กด พิมพ์/PDF แล้วเลือกปลายทาง «บันทึกเป็น PDF» ในหน้าต่างพิมพ์ของเบราว์เซอร์ จากนั้นเลือกโฟลเดอร์บนคอมพิวเตอร์หรือบันทึกขึ้น Drive ด้วยตนเองได้ โดยเลือกตำแหน่งจัดเก็บไฟล์ได้เอง</p><div class="alert">ต้นแบบรอตรวจรับข้อความและข้อกฎหมายก่อนใช้งานราชการ</div>'+'</div></div>');}
function tableItems(r){return '<div class="table-scroller"><table><thead><tr><th>รายการ</th><th>จำนวน</th><th>ราคา</th></tr></thead><tbody>'+(r.items||[]).map(x=>'<tr><td>'+e(x.name)+'</td><td>'+e(x.qty)+' '+e(x.unit)+'</td><td>'+money(Number(x.price_satang)*Number(x.qty))+'</td></tr>').join('')+'</tbody></table></div>';}

async function ensureAcceptanceNumber(){
 const r=state.currentRecord;if(!r||r.document_meta?.acceptance_number)return;
 if(state.demo){const be=Number(String(r.document_meta?.delivery_date||r.document_date||'').slice(0,4))+543;r.document_meta={...(r.document_meta||{}),acceptance_number:'ร. '+r.document_number+'/'+be};return;}
 if(!canEditDocumentMeta(r)||!r.document_meta?.delivery_date)return;
 const {data,error}=await db.rpc('ensure_procurement_acceptance_number',{p_record_id:r.id});
 if(error){console.warn('เลขใบตรวจรับอัตโนมัติ:',error.message);notify('ยังไม่สามารถจัดเลขใบตรวจรับอัตโนมัติได้: '+error.message,true);return;}
 r.document_meta={...(r.document_meta||{}),acceptance_number:String(data||'')};
 await loadRecords();
 state.currentRecord=state.records.find(x=>x.id===r.id)||r;
}
// Preserve the exact school director's title on one line. Unlike length-based
// guesses, measure the visible text with the active Thai font on each A4 sheet.
// Only this director title is resized; all other position labels stay untouched.
// A4 table header text must never split Thai words (especially "ลำดับ").
// The colgroup reserves enough room first; as a safety net, uniformly shrink
// header type only when a real loaded font still exceeds a heading's cell.
function fitOfficialTableHeaders(root){
 if(!root)return;
 for(const table of root.querySelectorAll('.gov-items')){
  const heads=[...table.querySelectorAll('thead th')];
  if(!heads.length)continue;
  for(const head of heads)head.style.removeProperty('font-size');
  if(!heads[0].clientWidth)continue;
  let px=parseFloat(getComputedStyle(heads[0]).fontSize)||18;
  const minPx=10.5*96/72;
  while(heads.some(h=>h.scrollWidth>h.clientWidth+1)&&px>minPx){
   px=Math.max(minPx,px-.4);
   for(const head of heads)head.style.setProperty('font-size',px+'px','important');
  }
 }
}
function fitDirectorPosition(root){
 for(const label of root.querySelectorAll('.kp-director-one-line')){
  label.style.removeProperty('font-size');
  if(!label.clientWidth)continue;
  let px=parseFloat(getComputedStyle(label).fontSize)||18;
  const minPx=9.5*96/72; // Only unusually long school names need this.
  while(label.scrollWidth>label.clientWidth+1 && px>minPx){
   px=Math.max(minPx,px-.35);
   label.style.setProperty('font-size',px+'px','important');
  }
 }
}

async function printOfficialDocuments(){
 await ensurePinnedTemplateVersions(state.currentRecord);
 await ensureAcceptanceNumber();
 if(!state.currentRecord)return;
 const root=document.getElementById('print-area');
 if(!root)return notify('ไม่พบพื้นที่พิมพ์เอกสาร',true);
 root.innerHTML=applyDocumentTemplates(buildDocuments(state.currentRecord,state.school),liveTemplateLayouts(state.currentRecord),state.currentRecord,state.school);
 document.body.classList.add('print-measuring');
 const fitSheet=sheet=>{
  const box=sheet.querySelector('.doc-sheet-body'),filler=sheet.querySelector('.table-filler');
  if(!box)return false;
  const original=filler?Math.max(0,parseFloat(filler.style.height)||0):0;
  const heights=filler?[original,...[72,56,40,25,8,0].filter(n=>n<original)]:[0];
  const fixedItemForm=sheet.classList.contains('gov-annex')||sheet.classList.contains('gov-requisition');
  const margins=['normal','tight','minimum'];
  const densities=['comfortable','balanced','fitted','compact','minimum','extra'];
  const zooms=[1,.96,.92,.88,.84,.8,.75];
  const doesFit=()=>{
   // No discretionary header/font resizing for the fixed annex/requisition forms.
   if(!fixedItemForm){fitDirectorPosition(sheet);fitOfficialTableHeaders(sheet);}
   const paper=sheet.getBoundingClientRect(),content=box.getBoundingClientRect();
   const style=getComputedStyle(sheet);
   const bottom=paper.bottom-(parseFloat(style.paddingBottom)||0)-8;
   const top=paper.top+(parseFloat(style.paddingTop)||0);
   const last=[...box.querySelectorAll('.signature-card,.gov-requisition-signatures,.gov-inspection-bottom,.gov-finance-sign,.memo-signatures')];
   return content.top>=top-3&&content.bottom<=bottom&&last.every(el=>el.getBoundingClientRect().bottom<=bottom);
  };
  if(fixedItemForm){
   // Protect the school's original A4 format: no change to font size,
   // margins, line spacing or page zoom. Only empty filler space may shrink.
   delete sheet.dataset.fitMargin;
   delete sheet.dataset.density;
   delete sheet.dataset.signDensity;
   sheet.style.removeProperty('--gov-zoom');
   for(const height of heights){
    if(filler)filler.style.height=height+'mm';
    if(doesFit())return true;
   }
   return false; // Caller retries with fewer items and a complete repeated form.
  }
  for(const height of heights){
   if(filler)filler.style.height=height+'mm';
   for(const margin of margins){
    if(margin==='normal')delete sheet.dataset.fitMargin;else sheet.dataset.fitMargin=margin;
    for(const density of densities){
     sheet.dataset.density=density;
     sheet.dataset.signDensity='compact';
     for(const zoom of zooms){
      sheet.style.setProperty('--gov-zoom',String(zoom));
      if(doesFit())return true;
     }
    }
   }
  }
  // Exceptional long narrative: shrink to fit without detaching signers.
  // Never put a bare signature onto a following unheaded sheet.
  const rect=box.getBoundingClientRect(),paper=sheet.getBoundingClientRect();
  const available=paper.height-parseFloat(getComputedStyle(sheet).paddingTop)-parseFloat(getComputedStyle(sheet).paddingBottom)-12;
  const computed=Math.min(.75,Math.max(.55,.75*available/Math.max(1,rect.height)));
  sheet.style.setProperty('--gov-zoom',String(computed));
  return doesFit();
 };
 try{
  if(document.fonts?.ready)await document.fonts.ready;
  await Promise.all([...root.querySelectorAll('img')].map(img=>img.decode?.().catch(()=>{})||Promise.resolve()));
  await new Promise(resolve=>requestAnimationFrame(resolve));
  let failures=[];
  // Long item descriptions can consume a different number of A4 rows.
  // Rebuild COMPLETE forms at progressively smaller page sizes. Every
  // continuation retains the original heading, legal citation and signers.
  for(const count of [10,9,8,7,6,5,4,3,2,1]){
   root.innerHTML=applyDocumentTemplates(buildDocuments({...state.currentRecord,__items_per_page:count},state.school),liveTemplateLayouts(state.currentRecord),state.currentRecord,state.school);
   failures=[];
   for(const page of [...root.querySelectorAll('.paper-page.official.gov-doc')]){
    if(!fitSheet(page)){
     const title=page.querySelector('.memo-field-subject .memo-value,.print-title')?.textContent?.trim()||'เอกสาร';
     failures.push({title,items:page.classList.contains('gov-annex')||page.classList.contains('gov-requisition')});
    }
   }
   if(!failures.length)break;
   if(failures.some(f=>!f.items))break;
  }
  if(failures.length){
   root.innerHTML='';return notify('เอกสารมีข้อความมากเกินพื้นที่ A4: '+failures.map(f=>f.title).join(', ')+' กรุณาลดข้อความที่ยาวมากเพื่อป้องกันลายเซ็นถูกตัด',true);
  }
  root.dataset.printPagination='complete-a4-pages';
 }catch(error){
  root.innerHTML='';return notify('ไม่สามารถจัดหน้ากระดาษได้: '+(error.message||error),true);
 }finally{
  document.body.classList.remove('print-measuring');
 }
 await new Promise(resolve=>requestAnimationFrame(resolve));
 window.print();
}

function preview(){detail();const sheet=applyDocumentTemplates(buildDocuments(state.currentRecord,state.school),liveTemplateLayouts(state.currentRecord),state.currentRecord,state.school);document.getElementById('print-area').innerHTML=sheet;const target=app.querySelector('.content');target.insertAdjacentHTML('beforeend','<div class="card" id="preview-output"><div class="section-head"><h2>ตัวอย่างเอกสารสำหรับพิมพ์</h2>'+btn('พิมพ์ / PDF','print')+'</div><div class="doc-preview"><div class="preview-page"><div class="official">'+sheet+'</div></div></div><p class="hint">กรุณาตรวจข้อความและจำนวนหน้าก่อนใช้งานจริง</p></div>');document.querySelector('#preview-output')?.scrollIntoView({behavior:'smooth'});const previewRoot=app.querySelector('#preview-output');requestAnimationFrame(()=>{fitDirectorPosition(previewRoot);fitOfficialTableHeaders(previewRoot);});document.fonts?.ready?.then(()=>requestAnimationFrame(()=>{fitDirectorPosition(previewRoot);fitOfficialTableHeaders(previewRoot);}));}

function settings(){if(!isAdmin()){notify('เฉพาะผู้ดูแลโรงเรียน',true);return;}const s=state.school;const inp=(t,k)=>'<div class="field"><label>'+t+'</label><input class="input" name="'+k+'" value="'+e(k==='memo_prefix'?normalizeMemoPrefix(s[k]):s[k]||'')+'"></div>';shell('ข้อมูลโรงเรียน','ตั้งค่าผู้ลงนาม',heading('ตั้งค่าโรงเรียนและผู้ลงนาม','ชื่อและตำแหน่งที่ตั้งค่าใช้กับรายการใหม่ ส่วนเอกสารเก่าจะเก็บชื่อเดิม')+'<div class="card"><h2>โลโก้โรงเรียน</h2><div class="school-logo-setting">'+schoolLogo('settings')+'<div><b>'+e(s.name)+'</b><p class="muted">สำหรับหน้า Dashboard และเมนูของโรงเรียนเท่านั้น <strong>ไม่แทรกในเอกสารราชการและไม่แทนตราครุฑ</strong></p></div></div><form id="school-logo-form"><div class="field"><label>แนบไฟล์โลโก้โรงเรียน (PNG, JPG หรือ WEBP)</label><input class="input" id="school-logo-file" name="school_logo" type="file" accept="image/png,image/jpeg,image/webp" required><small class="hint">ขนาดไม่เกิน 1 MB แนะนำภาพสี่เหลี่ยมจัตุรัส พื้นหลังโปร่งใส</small></div><div class="logo-form-actions"><button class="secondary" type="submit">อัปโหลดโลโก้โรงเรียน</button>'+(s.logo_path||state.demoLogoUrl?btn('นำโลโก้ออก','remove-school-logo','mini-btn'):'')+'</div></form></div><form class="card" id="school-form"><h2>ข้อมูลสถานศึกษา</h2>'+inp('ชื่อโรงเรียน','name')+'<div class="form-grid">'+inp('อำเภอ','district')+inp('จังหวัด','province')+'</div><h2>รหัสหนังสือและที่อยู่บนเอกสาร</h2><div class="form-grid">'+inp('รหัสหนังสือเท่านั้น เช่น พว. (ไม่ใส่ 1/2569)','memo_prefix')+inp('ที่อยู่โรงเรียนสำหรับเอกสาร','address')+'</div><h2>ชื่อผู้ลงนาม</h2><div class="form-grid">'+inp('เจ้าหน้าที่พัสดุ','officer_name')+inp('หัวหน้าเจ้าหน้าที่พัสดุ','head_name')+inp('ผู้อำนวยการสถานศึกษา','director_name')+inp('เจ้าหน้าที่การเงิน','finance_name')+'</div><button type="submit" class="primary">บันทึกข้อมูลโรงเรียน</button></form>');}

const staffRoleLabels={
  school_admin:'แอดมินโรงเรียน',
  procurement_officer:'เจ้าหน้าที่พัสดุ',
  procurement_head:'หัวหน้าเจ้าหน้าที่พัสดุ',
  director:'ผู้อำนวยการสถานศึกษา',
  finance:'เจ้าหน้าที่การเงิน',
  inspector:'ผู้ตรวจรับพัสดุ'
};
function staffRoleOptions(selected='procurement_officer'){
  return Object.entries(staffRoleLabels).map(([value,label])=>
    '<option value="'+e(value)+'" '+(selected===value?'selected':'')+'>'+e(label)+'</option>').join('');
}
async function staffRequest(action,payload={}){
  if(!isSchoolAdmin()||!state.school?.id)throw Error('เฉพาะแอดมินโรงเรียนที่ยังมีสิทธิ์เท่านั้น');
  const {data,error}=await db.functions.invoke('school-staff',{
    body:{action,school_id:state.school.id,...payload}
  });
  if(error){
    let msg='เชื่อมต่อระบบจัดการบัญชีไม่สำเร็จ';
    try{const detail=await error.context?.json();msg=detail?.error||detail?.message||error.message||msg;}
    catch{msg=error.message||msg;}
    throw new Error(msg);
  }
  if(!data?.success)throw new Error(data?.error||'ดำเนินการไม่สำเร็จ');
  return data.message||'ดำเนินการเรียบร้อยแล้ว';
}
async function loadMembers(){
  if(!isSchoolAdmin()){state.members=[];return;}
  const {data,error}=await db.rpc('list_school_members',{p_school_id:state.school.id});
  if(error){state.error='โหลดรายชื่อสมาชิกไม่สำเร็จ: '+error.message;return;}
  state.members=data||[];
}
function staffInput(label,name,value='',opts=''){
  return '<div class="field"><label for="staff-'+e(name)+'">'+e(label)+'</label>'+
    '<input id="staff-'+e(name)+'" class="input" name="'+e(name)+'" value="'+e(value)+'" '+opts+'></div>';
}
function staffPanel(){
  const editing=state.members.find(m=>m.user_id===state.memberEditingId);
  const reset=state.members.find(m=>m.user_id===state.memberResetId);
  if(reset){
    return '<form id="staff-password-form" class="card staff-card"><h2>ตั้งรหัสผ่านใหม่</h2>'+
      '<p class="muted">สำหรับ '+e(reset.member_name||reset.member_email)+' — รหัสผ่านจะไม่แสดงหรือเก็บในระบบจัดการ</p>'+
      '<input type="hidden" name="user_id" value="'+e(reset.user_id)+'">'+
      staffInput('รหัสผ่านใหม่','password','','type="password" required minlength="6" maxlength="128" autocomplete="new-password"')+
      staffInput('ยืนยันรหัสผ่านใหม่','confirm_password','','type="password" required minlength="6" maxlength="128" autocomplete="new-password"')+
      '<div class="staff-form-actions"><button class="primary" type="submit">บันทึกรหัสผ่านใหม่</button>'+
      btn('ยกเลิก','cancel-staff','secondary')+'</div><p class="hint">โปรดแจ้งรหัสผ่านให้เจ้าหน้าที่ผ่านช่องทางส่วนตัว</p></form>';
  }
  if(editing){
    return '<form id="staff-edit-form" class="card staff-card"><h2>แก้ไขบัญชีเจ้าหน้าที่</h2>'+
      '<input type="hidden" name="user_id" value="'+e(editing.user_id)+'">'+
      staffInput('ชื่อ–นามสกุล','full_name',editing.member_name,'required minlength="3" maxlength="200"')+
      staffInput('อีเมลสำหรับเข้าสู่ระบบ','email',editing.member_email,'type="email" required maxlength="254" autocomplete="off"')+
      '<div class="field"><label>หน้าที่ในระบบ</label><select name="role" class="select" required>'+
      staffRoleOptions(editing.member_role)+'</select></div>'+
      '<div class="staff-form-actions"><button class="primary" type="submit">บันทึกการแก้ไข</button>'+
      btn('ยกเลิก','cancel-staff','secondary')+'</div>'+
      '<p class="hint">เปลี่ยนชื่อ อีเมล หรือบทบาทได้ โดยไม่กระทบเอกสารที่เคยจัดทำ</p></form>';
  }
  return '<form id="member-form" class="card staff-card"><div class="staff-panel-eyebrow">สร้างบัญชีใหม่</div>'+
    '<h2>เพิ่มเจ้าหน้าที่โรงเรียน</h2>'+
    '<p class="muted">แอดมินกำหนดบัญชีและรหัสผ่านให้เจ้าหน้าที่ได้เลย ไม่ต้องให้สมัครสมาชิกเอง</p>'+
    staffInput('ชื่อ–นามสกุล','full_name','','required minlength="3" maxlength="200" placeholder="ชื่อและนามสกุลเจ้าหน้าที่" autocomplete="off"')+
    staffInput('อีเมลสำหรับเข้าสู่ระบบ','email','','type="email" required maxlength="254" placeholder="teacher@school.ac.th" autocomplete="off"')+
    '<div class="field"><label>หน้าที่ในระบบ</label><select name="role" class="select" required>'+staffRoleOptions()+'</select></div>'+
    staffInput('กำหนดรหัสผ่าน','password','','type="password" required minlength="6" maxlength="128" autocomplete="new-password" placeholder="อย่างน้อย 6 ตัวอักษร"')+
    staffInput('ยืนยันรหัสผ่าน','confirm_password','','type="password" required minlength="6" maxlength="128" autocomplete="new-password"')+
    '<button class="primary staff-full-btn" type="submit">+ สร้างบัญชีและให้สิทธิ์ใช้งาน</button>'+
    '<p class="hint">บัญชีสามารถเข้าสู่ระบบได้ทันที โปรดส่งรหัสผ่านให้เจ้าหน้าที่อย่างปลอดภัย และแนะนำให้เปลี่ยนรหัสผ่านหลังเข้าสู่ระบบ</p>'+
    '<p class="hint">สิทธิ์ในเว็บไซต์ไม่ใช่คำสั่งแต่งตั้งหน้าที่ตามระเบียบราชการ</p></form>';
}
function members(){
  if(!isSchoolAdmin()){
    state.page='dashboard';notify('เฉพาะแอดมินของโรงเรียนเท่านั้นที่จัดการผู้ใช้งานได้',true);return;
  }
  const rows=state.members||[];
  const active=rows.filter(m=>m.member_active).length;
  const administrators=rows.filter(m=>m.member_active&&m.member_role==='school_admin').length;
  const table=rows.length?
    '<div class="table-scroller"><table class="staff-table"><thead><tr>'+
    '<th>เจ้าหน้าที่</th><th>บทบาท</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>'+
    rows.map(m=>{
      const self=m.user_id===state.user?.id;
      return '<tr><td><strong>'+e(m.member_name||'ยังไม่ระบุชื่อ')+'</strong>'+
        (self?'<span class="staff-self">คุณ</span>':'')+
        '<small>'+e(m.member_email)+'</small></td>'+
        '<td><span class="tag">'+e(staffRoleLabels[m.member_role]||m.member_role)+'</span></td>'+
        '<td><span class="staff-status '+(m.member_active?'is-active':'is-inactive')+'">'+
        (m.member_active?'ใช้งานได้':'ปิดสิทธิ์')+'</span></td>'+
        '<td><div class="staff-row-actions">'+
        btn('แก้ไข','edit-staff','mini-btn','data-id="'+e(m.user_id)+'"')+
        btn('เปลี่ยนรหัสผ่าน','password-staff','mini-btn','data-id="'+e(m.user_id)+'"')+
        (self?'':btn(m.member_active?'ปิดสิทธิ์':'เปิดสิทธิ์','toggle-staff','mini-btn','data-id="'+e(m.user_id)+'"'))+
        (self?'':btn('ลบ','remove-staff','mini-btn staff-danger','data-id="'+e(m.user_id)+'"'))+
        '</div></td></tr>';
    }).join('')+'</tbody></table></div>':
    '<div class="staff-empty">ยังไม่มีเจ้าหน้าที่อื่นในโรงเรียนนี้</div>';
  shell('จัดการผู้ใช้งาน','เฉพาะแอดมินโรงเรียน',heading('บริหารเจ้าหน้าที่','สร้างบัญชี กำหนดบทบาท และควบคุมสิทธิ์จากที่เดียว')+
    '<div class="staff-stats"><div><small>ผู้ใช้ทั้งหมด</small><strong>'+rows.length+'</strong></div>'+
    '<div><small>กำลังใช้งาน</small><strong>'+active+'</strong></div>'+
    '<div><small>แอดมินโรงเรียน</small><strong>'+administrators+'</strong></div></div>'+
    '<div class="staff-layout"><section class="card staff-directory"><div class="staff-directory-head"><div>'+
    '<h2>สมาชิกในโรงเรียน</h2><p class="muted">แสดงเฉพาะบุคลากรของ '+e(state.school.name)+'</p></div>'+
    btn('↻ รีเฟรช','refresh-staff','secondary')+'</div>'+
    table+
    '<div class="staff-directory-note">การลบจะถอนสิทธิ์ผู้ใช้ออกจากโรงเรียน แต่เก็บประวัติเอกสารและบันทึกการทำงานไว้ตรวจสอบย้อนหลัง</div></section>'+
    staffPanel()+'</div>');
}
function ownerSubscriptionsPanel(){
 const rows=state.subscriptions||[];
 const tr=rows.map(x=>{
   const stat=subscriptionLabel(x.access_status);
   const expire=x.plan==='annual'?x.paid_until:x.trial_ends_at;
   const used=Number(x.used_count||0);
   return '<tr><td><b>'+e(x.school_name)+'</b><br><small class="muted">'+e(x.school_status==='active'?'โรงเรียนเปิดใช้งาน':'โรงเรียนระงับใช้งาน')+'</small></td>'+
   '<td><span class="sub-state-chip sub-chip-'+e(x.access_status)+'">'+e(stat)+'</span></td>'+
   '<td>'+e(x.plan==='trial'?used+' / '+x.trial_limit+' ชุด':used+' ชุดตลอดอายุบัญชี')+'</td>'+
   '<td>'+e(subscriptionDate(expire))+'</td>'+
   '<td><button class="primary sub-renew" type="button" data-action="renew-school" data-id="'+e(x.school_id)+'">+ ต่ออายุ 1 ปี</button></td></tr>';
 }).join('');
 const nTrial=rows.filter(x=>x.access_status==='trial').length;
 const nActive=rows.filter(x=>x.access_status==='active').length;
 const nExpired=rows.filter(x=>x.access_status==='expired').length;
 return '<section class="card sub-admin-panel">'+
   '<div class="section-head"><div><h2>การสมัครใช้งานและต่ออายุรายปี</h2><p class="muted">ต่ออายุโดยเจ้าของแพลตฟอร์มหลังตรวจรับชำระเงินแล้ว (ยังไม่มีระบบชำระเงินออนไลน์)</p></div></div>'+
   '<div class="sub-mini-stats"><div>ทดลองใช้ฟรี <b>'+nTrial+'</b></div><div>รายปีที่ยังใช้งาน <b>'+nActive+'</b></div><div>หมดสิทธิ์ <b>'+nExpired+'</b></div></div>'+
   '<div class="table-scroller"><table><thead><tr><th>สถานศึกษา</th><th>แพ็กเกจ</th><th>ชุดเอกสารที่ใช้</th><th>ใช้ได้ถึง</th><th>จัดการ</th></tr></thead>'+
   '<tbody>'+(tr||'<tr><td colspan="5" class="empty">ยังไม่มีโรงเรียนที่เปิดใช้งาน</td></tr>')+'</tbody></table></div>'+
   '<p class="sub-note">ทดลองใช้ฟรี 15 วัน หรือ 10 ชุดเอกสาร อย่างใดถึงก่อน · 1 รายการจัดซื้อ/จัดจ้างนับเป็น 1 ชุด · ต่ออายุรายปีเริ่มจากวันสิ้นสุดสิทธิ์เดิม หากยังไม่หมดอายุ</p></section>';
}

function owner(){if(!state.owner){notify('ไม่มีสิทธิ์เจ้าของแพลตฟอร์ม',true);return;}const schools=state.schools||[],req=state.schoolRequests||[];app.innerHTML='<div class="shell"><aside class="sidebar"><div class="side-brand">'+logo()+'</div><div class="side-menu-label">แพลตฟอร์ม</div><button class="navlink active" data-action="owner">'+i('building')+'โรงเรียนทั้งหมด</button><button class="navlink" data-action="signout">'+i('logout')+'ออกจากระบบ</button><div class="side-footer">SUPER ADMIN · ครูพัสดุ</div></aside><div class="workspace"><header class="topbar"><div><h2>ครูพัสดุ · เจ้าของแพลตฟอร์ม</h2><p>บริหารการเปิดใช้โรงเรียน</p></div>'+accountHeader()+'</header><div class="content">'+msg()+heading('บริหารโรงเรียน','โรงเรียนและคำขอเปิดใช้งานทั่วทั้งแพลตฟอร์ม')+'<div class="stats-grid"><div class="stat"><div class="stat-top">โรงเรียนทั้งหมด</div><strong>'+schools.length+'</strong></div><div class="stat"><div class="stat-top">คำขอรออนุมัติ</div><strong>'+req.length+'</strong></div></div><div class="grid-two"><section class="card"><h2>คำขอเปิดใช้งาน</h2>'+(req.length?req.map(x=>'<div class="row" style="padding:14px 0;border-bottom:1px solid #e4eded"><div><b>'+e(x.school_name)+'</b><br><small class="muted">'+e(x.requester_email)+'</small></div>'+btn('อนุมัติ','approve-school','primary','data-id="'+e(x.request_id)+'"')+'</div>').join(''):'<p class="muted">ยังไม่มีคำขอที่รออนุมัติ</p>')+'</section><form class="card" id="new-school-form"><h2>สร้างโรงเรียนใหม่</h2><div class="field"><label>ชื่อโรงเรียน</label><input name="name" class="input" required></div><div class="field"><label>อีเมลแอดมินโรงเรียน (ต้องสมัครบัญชีแล้ว)</label><input name="email" class="input" type="email" required></div><button type="submit" class="primary">สร้างโรงเรียน</button></form></div><section class="card"><h2>โรงเรียนที่เปิดใช้งาน</h2><div class="table-scroller"><table><thead><tr><th>โรงเรียน</th><th>จังหวัด</th><th>สถานะ</th></tr></thead><tbody>'+schools.map(s=>'<tr><td>'+e(s.name)+'</td><td>'+e(s.province||'-')+'</td><td><span class="tag">'+e(s.status)+'</span></td></tr>').join('')+'</tbody></table></div></section>'+ownerSubscriptionsPanel()+'<p class="footer">บริหารข้อมูลในแต่ละโรงเรียนผ่านสมาชิกโรงเรียน ไม่อ่านเอกสารลูกค้าโดยไม่จำเป็น</p></div></div></div>';}
function waitAccess(){app.innerHTML='<div class="landing"><div class="land-nav">'+logo()+btn('ออกจากระบบ','signout','secondary')+'</div><div style="max-width:660px;margin:65px auto;padding:25px"><div class="card">'+msg()+'<span class="pill">บัญชีพร้อมแล้ว</span><h1>รอรับสิทธิ์เข้าถึงโรงเรียน</h1><p>อีเมลบัญชี: <b>'+e(state.user.email)+'</b></p><p>หากโรงเรียนของคุณมีผู้ดูแลแล้ว ให้แจ้งอีเมลนี้แก่แอดมินเพื่อเพิ่มเข้าระบบ หรือส่งคำขอเปิดโรงเรียนใหม่ได้ด้านล่าง</p><form id="request-school-form"><div class="field"><label>ชื่อโรงเรียนที่ต้องการเปิดใช้งาน</label><input class="input" name="name" required placeholder="ชื่อโรงเรียน"></div><button type="submit" class="primary">ส่งคำขอเปิดโรงเรียน</button></form><p class="hint">คำขอต้องได้รับอนุมัติจากเจ้าของแพลตฟอร์มก่อนใช้ข้อมูลจริง</p>'+btn('ดูโหมดตัวอย่าง','demo','secondary')+'</div></div></div>';}
function render(){if(!state.user&&!state.demo){if(state.page==='auth')auth();else if(state.page==='verify-email')verificationPending();else landing();return;}if(state.user&&!state.owner&&!state.school&&!state.demo){waitAccess();return;}if(state.owner&&!state.school&&!state.demo){owner();return;}if(!state.school){state.school=demoSchool;}if(state.page==='records')return records();if(state.page==='registry')return officialRegistry();if(state.page==='templates')return templateEditor.view();if(state.page==='create')return form();if(state.page==='detail')return detail();if(state.page==='docmeta')return editDocumentMeta();if(state.page==='preview')return preview();if(state.page==='members')return members();if(state.page==='settings')return settings();if(state.page==='owner')return owner();dashboard();}
async function loadUser(){if(!state.session){state.user=null;state.profile=null;state.owner=false;return;}const {data:user}=await db.auth.getUser();state.user=user?.user||null;if(!state.user){state.profile=null;return;}const [admin,memberships,profile]=await Promise.all([db.from('platform_admins').select('user_id').eq('user_id',state.user.id),db.from('memberships').select('school_id,role,schools(*)').eq('user_id',state.user.id).eq('active',true),db.from('profiles').select('full_name').eq('id',state.user.id).maybeSingle()]);if(admin.error)console.warn(admin.error.message);if(memberships.error)console.warn(memberships.error.message);if(profile.error)console.warn(profile.error.message);state.profile=profile.data||{full_name:state.user?.user_metadata?.full_name||''};state.owner=!!admin.data?.length;state.memberships=memberships.data||[];state.school=state.memberships[0]?.schools||null;if(state.owner){await loadOwner();}if(state.school)await Promise.all([loadRecords(),refreshSubscription(),templateEditor.load()]);}
async function loadOwner(){
  const requests=[
    db.from('schools').select('*').order('created_at',{ascending:false}),
    db.rpc('platform_list_school_requests'),
    db.rpc('platform_list_subscriptions')
  ];
  const [schools,requestsResult,subscriptions]=await Promise.all(requests);
  // A temporary billing/report failure should never lock the owner out of the platform.
  if(schools.error)console.warn('School listing unavailable',schools.error.message);
  state.schools=schools.data||[];
  state.schoolRequests=requestsResult.error?[]:(requestsResult.data||[]);
  state.subscriptions=subscriptions.error?[]:(subscriptions.data||[]);
  if(requestsResult.error||subscriptions.error){
    console.warn('Optional owner overview unavailable',requestsResult.error?.message||'',subscriptions.error?.message||'');
    state.flash='ข้อมูลโรงเรียนโหลดสำเร็จ แต่ข้อมูลคำขอหรือสมาชิกบางส่วนยังไม่พร้อม กรุณาลองรีเฟรช';
  }
}
async function loadRecords(){if(!state.school||state.demo)return;const {data,error}=await db.from('procurements').select('*').eq('school_id',state.school.id).is('deleted_at',null).order('created_at',{ascending:false}).limit(300);if(error){state.error=error.message;return;}state.records=data||[];}
async function startDemo(){state.demo=true;state.user=null;state.school=demoSchool;state.schoolTemplates={};state.templateVersions={};state.records=[...demoRecords];state.owner=false;state.page='dashboard';render();}
async function signOut(){if(state.demo){state.demo=false;state.school=null;state.profile=null;state.page='landing';state.records=[];render();return;}const {error}=await db.auth.signOut();if(error)return notify('ออกจากระบบไม่สำเร็จ: '+error.message,true);state.session=null;state.user=null;state.profile=null;state.school=null;state.schoolTemplates={};state.templateVersions={};state.owner=false;state.page='landing';render();}
async function go(action,el){
if(action==='templates'){if(!isSchoolAdmin())return notify('เฉพาะแอดมินโรงเรียนเท่านั้น',true);return templateEditor.open();}
if(action.startsWith('tpl-'))return templateEditor.action(action,el);
if(['edit-staff','password-staff','cancel-staff','refresh-staff','toggle-staff','remove-staff'].includes(action)){
  if(!isSchoolAdmin())return notify('เฉพาะแอดมินโรงเรียนเท่านั้น',true);
  const id=el.dataset.id;
  const person=state.members.find(m=>m.user_id===id);
  if(action==='cancel-staff'){state.memberEditingId=null;state.memberResetId=null;return render();}
  if(action==='refresh-staff'){await loadMembers();return render();}
  if(!person)return notify('ไม่พบเจ้าหน้าที่ในรายการ',true);
  if(action==='edit-staff'){state.memberEditingId=id;state.memberResetId=null;return render();}
  if(action==='password-staff'){state.memberResetId=id;state.memberEditingId=null;return render();}
  if(id===state.user?.id)return notify('ไม่สามารถปิดสิทธิ์หรือลบบัญชีตนเองได้',true);
  if(action==='remove-staff'){
    if(!confirm('ยืนยันลบ '+(person.member_name||person.member_email)+' ออกจากโรงเรียน?\nเจ้าหน้าที่จะไม่สามารถเข้าถึงข้อมูลโรงเรียนได้อีก แต่เอกสารเก่าจะยังอยู่'))return;
    const message=await staffRequest('remove',{user_id:id});
    await loadMembers();state.memberEditingId=null;state.memberResetId=null;return notify(message);
  }
  if(action==='toggle-staff'){
    const active=!person.member_active;
    if(!confirm((active?'เปิด':'ปิด')+'สิทธิ์การใช้งานของ '+(person.member_name||person.member_email)+' ?'))return;
    const message=await staffRequest('toggle',{user_id:id,active});
    await loadMembers();return notify(message);
  }
}
if(action==='registry'||action==='registry-refresh'){
 if(!state.demo){await Promise.all([loadRecords(),loadOfficialNumbers(),loadOfficialNumberStarts()]);}
 state.page='registry';return render();
}
if(action==='registry-open'){
 state.currentRecord=state.records.find(r=>r.id===el.dataset.id);
 if(!state.currentRecord&&!state.demo){const {data,error}=await db.from('procurements').select('*').eq('id',el.dataset.id).eq('school_id',state.school.id).is('deleted_at',null).maybeSingle();if(error)return notify(error.message,true);state.currentRecord=data;}
 if(!state.currentRecord)return notify('ไม่พบรายการ กรุณาเปิดจากทะเบียนจัดซื้อจัดจ้าง',true);
 state.page='detail';return render();
}
if(action==='registry-issue'){
 if(!canEditDocumentMeta(state.currentRecord))return notify('ไม่มีสิทธิ์ออกเลข',true);
 const field=String(el.dataset.field||'');
 if(state.demo)return notify('โหมดตัวอย่างยังไม่ออกเลขจริง');
 const {error}=await db.rpc('issue_official_number',{p_record_id:state.currentRecord.id,p_field:field});
 if(error)return notify(error.message,true);
 const id=state.currentRecord.id;await Promise.all([loadRecords(),loadOfficialNumbers()]);
 state.currentRecord=state.records.find(r=>r.id===id);state.page='detail';
 state.flash='จองเลขเอกสารอัตโนมัติแล้ว ตรวจสอบได้ในทะเบียนคุมเลข';return render();
}
if(['registry-use','registry-edit','registry-void','registry-resolve'].includes(action)){
 const n=state.officialNumbers.find(x=>x.id===el.dataset.id);
 if(!n)return notify('ไม่พบเลขทะเบียน',true);
 if(action!=='registry-use'&&!isSchoolAdmin())return notify('แก้ไขและยกเลิกได้เฉพาะแอดมินโรงเรียน',true);
 const act=action==='registry-use'?'use':action==='registry-edit'||action==='registry-resolve'?'renumber':'void';
 let next=null,reason='';
 if(act==='use'){if(!confirm('ยืนยันว่าเอกสารเลข '+registryDisplayNumber(n)+' มีการนำไปใช้งานจริงแล้ว?'))return;}
 if(act==='renumber'){
  const value=prompt('แก้เลข '+registryDisplayNumber(n)+' เป็นลำดับใหม่ (ใส่เฉพาะตัวเลข)',String(n.serial_no||''));
  if(value===null)return;next=Number(value);
  if(!Number.isInteger(next)||next<1)return notify('เลขใหม่ต้องเป็นจำนวนเต็มบวก',true);
 }
 if(act!=='use'){
  reason=prompt('กรุณาระบุเหตุผลในการ'+(act==='void'?'ยกเลิก':'แก้ไข')+'เลข (อย่างน้อย 5 ตัวอักษร)')||'';
  if(reason.trim().length<5)return notify('กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร',true);
  if(!confirm('ยืนยัน'+(act==='void'?'ยกเลิกเลข ':'เปลี่ยนเลข ')+registryDisplayNumber(n)+'? ระบบจะเก็บเลขเดิมไว้ตรวจสอบ'))return;
 }
 const {error}=action==='registry-resolve'?await db.rpc('resolve_official_number_conflict',{p_registry_id:n.id,p_new_serial:next,p_reason:reason}):await db.rpc('manage_official_number',{p_registry_id:n.id,p_action:act,p_new_serial:next,p_reason:reason});
 if(error)return notify('ดำเนินการไม่สำเร็จ: '+error.message,true);
 await Promise.all([loadOfficialNumbers(),loadRecords(),loadOfficialNumberStarts()]);
 if(state.currentRecord)state.currentRecord=state.records.find(r=>r.id===state.currentRecord.id)||state.currentRecord;
 state.flash='บันทึกสถานะเลขทะเบียนและประวัติแล้ว';state.page='registry';return render();
}
if(action==='wizard-next')return moveWizard(1);if(action==='wizard-prev')return moveWizard(-1);if(action==='home'){state.page='landing';state.demo=false;render();return;}if(action==='login'||action==='signup'){
  state.authEmail=String(document.querySelector('#kp-email')?.value||document.querySelector('#kp-forgot-email')?.value||state.authEmail||'').trim();
  state.authMode=action;state.authForgot=false;state.recoveryMode=false;state.page='auth';render();return;
}
if(action==='forgot-password'){
  state.authEmail=String(document.querySelector('#kp-email')?.value||state.authEmail||'').trim();
  state.authForgot=true;state.page='auth';render();return;
}
if(action==='show-password'){
  const id=String(el.dataset.target||'');
  if(!/^kp-(password|confirm_password)$/.test(id))return;
  const input=document.getElementById(id);
  if(!input)return;
  const show=input.type==='password';
  input.type=show?'text':'password';
  el.textContent=show?'ซ่อน':'แสดง';
  el.setAttribute('aria-label',show?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน');
  input.focus();return;
}if(action==='resend-confirmation'){if(!state.pendingSignupEmail)return notify('ไม่พบอีเมลที่สมัคร กรุณาลองสมัครใหม่',true);const {error}=await db.auth.resend({type:'signup',email:state.pendingSignupEmail,options:{emailRedirectTo:window.location.origin}});if(error)return notify('ยังส่งอีเมลซ้ำไม่ได้ กรุณารอสักครู่แล้วลองอีกครั้ง',true);return notify('ส่งอีเมลยืนยันอีกครั้งแล้ว กรุณาตรวจกล่องจดหมายและโฟลเดอร์สแปม');}if(action==='demo')return startDemo();if(action==='signout')return signOut();if(action==='profile')return openProfileEditor();if(action==='close-profile'){document.getElementById('profile-dialog')?.close();document.getElementById('profile-dialog')?.remove();return;}if(action==='search'){state.filter=document.querySelector('#record-search')?.value||'';state.page='records';render();return;}if(action==='add-item'){collectDraft();state.items.push({name:'',qty:'1',unit:'',price:''});form();return;}if(action==='remove-item'){collectDraft();if(state.items.length>1)state.items.splice(Number(el.dataset.id),1);form();return;}if(action==='delete-record'){
 const rec=state.records.find(r=>String(r.id)===String(el.dataset.id));
 if(!rec)return notify('ไม่พบรายการนี้ กรุณารีเฟรชหน้า',true);
 return openDeleteRecordDialog(rec);
}
if(action==='cancel-delete-record'){
 document.getElementById('kp-delete-record-dialog')?.close();
 document.getElementById('kp-delete-record-dialog')?.remove();
 return;
}
if(action==='confirm-delete-record'){
 const dialog=document.getElementById('kp-delete-record-dialog');
 const rec=state.records.find(r=>String(r.id)===String(el.dataset.id));
 if(!canDeleteMainRecord(rec))return notify('รายการนี้ไม่ได้อยู่ในสถานะฉบับร่างหรือคุณไม่มีสิทธิ์ลบ',true);
 el.disabled=true;
 if(state.demo){
  rec.deleted_at=new Date().toISOString();rec.state='cancelled';
 }else{
  const {error}=await db.rpc('delete_procurement_draft',{
   p_record_id:rec.id,p_expected_updated_at:rec.updated_at
  });
  if(error){el.disabled=false;return notify('ลบรายการไม่สำเร็จ: '+error.message,true);}
 }
 dialog?.close();dialog?.remove();
 if(!state.demo)await Promise.all([loadRecords(),loadOfficialNumbers()]);
 state.currentRecord=null;state.editingRecordId=null;state.page='records';
 state.flash='นำรายการฉบับร่างออกแล้ว เก็บเลขทะเบียนและประวัติไว้ตรวจสอบโดยไม่นำเลขกลับมาใช้ซ้ำ';
 return render();
}
if(action==='open'||action==='open-edit'){
 state.currentRecord=state.records.find(r=>String(r.id)===String(el.dataset.id)&&!r.deleted_at);
 if(!state.currentRecord)return notify('ไม่พบรายการนี้ กรุณารีเฟรชทะเบียน',true);
 if(action==='open-edit')return go('edit-record',el);
 state.page='detail';render();return;
}if(action==='print'){await printOfficialDocuments();return;}if(action==='preview'){await ensureAcceptanceNumber();await ensurePinnedTemplateVersions(state.currentRecord);state.page='preview';render();return;}if(action==='renew-school'){
  if(!state.owner)return notify('ต้องเป็นเจ้าของแพลตฟอร์มเท่านั้น',true);
  const sid=String(el.dataset.id||''),row=(state.subscriptions||[]).find(x=>x.school_id===sid);
  if(!row)return notify('ไม่พบข้อมูลโรงเรียน',true);
  const agreed=confirm('ยืนยันว่าตรวจสอบการชำระเงิน/ข้อตกลงแล้ว และต้องการเปิดสิทธิ์รายปีให้ '+row.school_name+' เพิ่มอีก 1 ปีใช่หรือไม่?');
  if(!agreed)return;
  const {data,error}=await db.rpc('platform_extend_school_subscription',{p_school_id:sid,p_years:1,p_note:'ผู้ดูแลระบบต่ออายุรายปีด้วยตนเอง'});
  if(error)return notify('ต่ออายุไม่สำเร็จ: '+error.message,true);
  await loadOwner();
  state.flash='ต่ออายุ '+row.school_name+' เรียบร้อยแล้ว ใช้ได้ถึง '+subscriptionDate(data);
  return owner();
}if(action==='approve-school'){if(!confirm('อนุมัติคำขอเปิดโรงเรียนนี้?'))return;const {error}=await db.rpc('platform_approve_request',{p_request_id:el.dataset.id});if(error)return notify(error.message,true);await loadOwner();state.flash='อนุมัติโรงเรียนแล้ว';return owner();}if(action==='owner'){await loadOwner();state.page='owner';return render();}if(action==='members'){if(!isSchoolAdmin())return notify('เฉพาะแอดมินโรงเรียนเท่านั้นที่เข้าเมนูจัดการผู้ใช้งานได้',true);await loadMembers();state.page='members';return render();}if(action==='subscription-help'){return notify('สิทธิ์ทดลองหรือสมาชิกหมดอายุแล้ว กรุณาติดต่อเจ้าของแพลตฟอร์มครูพัสดุ (LINE จะเพิ่มภายหลัง)',true);}if(action==='create'){if(!state.demo){try{await refreshSubscription();}catch(ex){return notify('ตรวจสอบสิทธิ์ไม่สำเร็จ: '+ex.message,true);}if(!canCreate())return notify('ครบโควตาหรือหมดอายุแล้ว กรุณาติดต่อเจ้าของแพลตฟอร์ม',true);}state.editingRecordId=null;state.wizardStep=1;state.items=[{name:'',qty:'1',unit:'',price:''}];state.draft={};state.page='create';return render();}if(action==='records'){if(!state.demo)await loadRecords();state.page='records';return render();}if(action==='settings'){state.page='settings';return render();}if(action==='remove-school-logo'){if(!isAdmin())return notify('ไม่มีสิทธิ์ลบโลโก้โรงเรียน',true);if(!confirm('ต้องการนำโลโก้โรงเรียนออกจากหน้าเว็บใช่หรือไม่?'))return;if(state.demo){state.demoLogoUrl='';state.flash='นำโลโก้ตัวอย่างออกแล้ว';return render();}const old=state.school.logo_path;if(!old)return;const {data,error}=await db.from('schools').update({logo_path:''}).eq('id',state.school.id).select('*').single();if(error)return notify(error.message,true);state.school=data;await db.storage.from('school-logos').remove([old]);state.flash='นำโลโก้โรงเรียนออกแล้ว';return render();}if(action==='edit-record'){const rec=state.currentRecord;if(!canEditMainRecord(rec))return notify('แก้ไขได้เฉพาะรายการฉบับร่างที่มีสิทธิ์',true);state.editingRecordId=rec.id;state.wizardStep=1;state.items=(rec.items||[]).map(x=>({name:x.name,qty:String(x.qty),unit:x.unit,price:(Number(x.price_satang)/100).toFixed(2)}));state.draft={...rec,...Object.fromEntries(Object.entries(rec.document_meta||{}).map(([k,v])=>['doc_'+k,v]))};state.page='create';return render();}if(action==='cancel-edit'){state.editingRecordId=null;state.page='detail';return render();}if(action==='doc-meta'){if(!canEditDocumentMeta(state.currentRecord))return notify('ไม่มีสิทธิ์แก้ไขข้อมูลเอกสารนี้',true);state.page='docmeta';return render();}if(action==='detail'){state.page='detail';return render();}if(action==='dashboard'){state.page='dashboard';return render();}}
function collectDraft(){const f=document.querySelector('#procurement-form');if(!f)return;state.draft=Object.fromEntries(new FormData(f));document.querySelectorAll('[data-item]').forEach(el=>{const n=Number(el.dataset.item),key=el.dataset.key;if(state.items[n])state.items[n][key]=el.value;});}
async function handleForm(form){const f=Object.fromEntries(new FormData(form));if(form.id==='auth-form'){
  const email=String(f.email||'').trim(), password=String(f.password||'');
  state.authEmail=email;
  if(!email||!password)return notify('กรุณากรอกอีเมลและรหัสผ่านให้ครบ',true);
  let result;
  if(state.authMode==='signup'){
    const fullName=String(f.full_name||'').trim().replace(/\s+/g,' ');
    if(fullName.length<3)return notify('กรุณาระบุชื่อ–นามสกุลจริงให้ครบ',true);
    if(password!==String(f.confirm_password||''))return notify('รหัสผ่านทั้งสองช่องไม่ตรงกัน กรุณาตรวจสอบ',true);
    if(password.length<8)return notify('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',true);
    result=await db.auth.signUp({
      email,password,
      options:{emailRedirectTo:window.location.origin,data:{full_name:fullName}}
    });
    if(result.error)return notify('สมัครบัญชีไม่สำเร็จ: '+result.error.message,true);
    if(!result.data.session){
      state.pendingSignupEmail=email;state.error='';state.flash='';state.page='verify-email';return render();
    }
    state.pendingSignupEmail='';
    state.flash='สมัครบัญชีเรียบร้อยแล้ว กรุณารอผู้ดูแลโรงเรียนกำหนดสิทธิ์';
  }else{
    result=await db.auth.signInWithPassword({email,password});
    if(result.error)return notify('เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน',true);
    rememberLoginEmail(email,!!f.remember_email);
  }
  state.session=result.data.session;
  state.demo=false;state.page='dashboard';await loadUser();return render();
}
if(form.id==='forgot-form'){
  const email=String(f.email||'').trim();
  if(!email)return notify('กรุณากรอกอีเมลบัญชี',true);
  state.authEmail=email;
  const {error}=await db.auth.resetPasswordForEmail(email,{
    redirectTo:window.location.origin+'/?auth=recovery'
  });
  if(error)return notify('ส่งลิงก์ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองอีกครั้งหรือติดต่อผู้ดูแลระบบ',true);
  state.authForgot=false;state.authMode='login';
  state.flash='หากอีเมลนี้มีบัญชีในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่แล้ว กรุณาตรวจกล่องจดหมายและจดหมายขยะ';
  return render();
}
if(form.id==='reset-password-form'){
  const pwd=String(f.password||''),confirm=String(f.confirm_password||'');
  if(pwd.length<8)return notify('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร',true);
  if(pwd!==confirm)return notify('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน',true);
  const {data:sessionData}=await db.auth.getSession();
  if(!sessionData.session)return notify('ลิงก์ตั้งรหัสผ่านหมดอายุหรือไม่ถูกต้อง กรุณาขอลิงก์ใหม่',true);
  const {error}=await db.auth.updateUser({password:pwd});
  if(error)return notify('เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่หรือขอลิงก์ใหม่',true);
  await db.auth.signOut();
  history.replaceState(null,'',window.location.origin+'/');
  state.recoveryMode=false;state.authForgot=false;state.authMode='login';state.session=null;
  state.user=null;state.profile=null;state.school=null;state.owner=false;state.page='auth';
  state.flash='เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่';
  return render();
}
if(form.id==='profile-form'){
  if(!state.user||state.demo)return notify('กรุณาเข้าสู่ระบบก่อนแก้ไขข้อมูลบัญชี',true);
  const fullName=String(f.full_name||'').trim().replace(/\s+/g,' ');
  if(fullName.length<3||fullName.length>150)return notify('กรุณากรอกชื่อ–นามสกุล 3–150 ตัวอักษร',true);
  const {data,error}=await db.from('profiles').update({full_name:fullName}).eq('id',state.user.id).select('full_name').single();
  if(error)return notify('บันทึกชื่อไม่สำเร็จ: '+error.message,true);
  state.profile=data;
  document.getElementById('profile-dialog')?.close();
  document.getElementById('profile-dialog')?.remove();
  state.flash='อัปเดตชื่อ–นามสกุลของคุณเรียบร้อย';
  if(state.owner&&!state.school) return owner();
  return render();
}
if(form.id==='request-school-form'){const {error}=await db.from('school_requests').insert({school_name:f.name,user_id:state.user.id});if(error)return notify(error.message,true);state.flash='ส่งคำขอเรียบร้อย กรุณารอเจ้าของแพลตฟอร์มอนุมัติ';return render();}
if(form.id==='new-school-form'){const {error}=await db.rpc('platform_create_school',{p_name:f.name,p_admin_email:f.email});if(error)return notify(error.message,true);await loadOwner();state.flash='สร้างโรงเรียนและกำหนดแอดมินเรียบร้อย';return owner();}

if(form.id==='school-logo-form'){
  if(!isAdmin())return notify('ไม่มีสิทธิ์เปลี่ยนโลโก้โรงเรียน',true);
  const file=form.querySelector('[name="school_logo"]')?.files?.[0];
  if(!file)return notify('กรุณาเลือกภาพโลโก้โรงเรียน',true);
  const mimeExt={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
  if(!mimeExt[file.type])return notify('ไฟล์ต้องเป็น PNG, JPG หรือ WEBP เท่านั้น',true);
  if(file.size>1048576)return notify('ขนาดรูปต้องไม่เกิน 1 MB',true);
  if(state.demo){
    state.demoLogoUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('อ่านไฟล์ไม่สำเร็จ'));reader.readAsDataURL(file);});
    state.flash='ทดลองแสดงโลโก้แล้ว (ยังไม่ได้บันทึกออนไลน์)';return render();
  }
  const extension=mimeExt[file.type],oldPath=state.school.logo_path||'';
  const uploadPath=state.school.id+'/logo-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)+'.'+extension;
  const result=await db.storage.from('school-logos').upload(uploadPath,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
  if(result.error)return notify('อัปโหลดไม่สำเร็จ: '+result.error.message,true);
  const update=await db.from('schools').update({logo_path:uploadPath}).eq('id',state.school.id).select('*').single();
  if(update.error){await db.storage.from('school-logos').remove([uploadPath]);return notify('บันทึกโลโก้ไม่สำเร็จ: '+update.error.message,true);}
  state.school=update.data;
  if(oldPath)await db.storage.from('school-logos').remove([oldPath]).catch(()=>{});
  state.flash='บันทึกโลโก้โรงเรียนเรียบร้อยแล้ว';return render();
}
if(form.id==='school-form'){f.memo_prefix=normalizeMemoPrefix(f.memo_prefix);if(state.demo){state.school={...state.school,...f};return notify('ปรับข้อมูลตัวอย่างในหน้านี้แล้ว (ไม่บันทึกจริง)');}const {data,error}=await db.from('schools').update(f).eq('id',state.school.id).select('*').single();if(error)return notify(error.message,true);state.school=data;return notify('บันทึกข้อมูลโรงเรียนแล้ว');}
if(form.id==='member-form'){
  if(!isSchoolAdmin())return notify('เฉพาะแอดมินโรงเรียนเท่านั้น',true);
  if(f.password!==f.confirm_password)return notify('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน',true);
  if(String(f.password||'').length<6)return notify('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',true);
  const message=await staffRequest('create',{full_name:f.full_name,email:f.email,role:f.role,password:f.password});
  await loadMembers();state.memberEditingId=null;state.memberResetId=null;return notify(message);
}
if(form.id==='staff-edit-form'){
  if(!isSchoolAdmin())return notify('เฉพาะแอดมินโรงเรียนเท่านั้น',true);
  const message=await staffRequest('edit',{user_id:f.user_id,full_name:f.full_name,email:f.email,role:f.role});
  state.memberEditingId=null;await loadMembers();return notify(message);
}
if(form.id==='staff-password-form'){
  if(!isSchoolAdmin())return notify('เฉพาะแอดมินโรงเรียนเท่านั้น',true);
  if(f.password!==f.confirm_password)return notify('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน',true);
  if(String(f.password||'').length<6)return notify('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',true);
  const message=await staffRequest('password',{user_id:f.user_id,password:f.password});
  state.memberResetId=null;await loadMembers();return notify(message);
}
if(form.id==='registry-filter-form'){
 state.numberFilter=String(f.query||'').trim();state.numberSeries=String(f.series||'all');
 state.numberStatus=String(f.status||'all');state.numberYear=String(f.year||'all');
 return officialRegistry();
}
if(form.id==='registry-setup-year-form'){
 if(!isSchoolAdmin())return notify('เฉพาะแอดมินโรงเรียนเท่านั้น',true);
 const year=Number(f.year);
 if(!Number.isInteger(year)||year<2500||year>2700)return notify('ปี พ.ศ. ต้องอยู่ระหว่าง 2500–2700',true);
 state.numberSetupYear=year;
 await loadOfficialNumberStarts();
 return officialRegistry();
}
if(form.matches('[data-registry-start-form]')){
 if(!isSchoolAdmin())return notify('เฉพาะแอดมินโรงเรียนเท่านั้น',true);
 const year=Number(f.year),next=Number(f.next),series=String(f.series||'');
 const current=state.numberStarts?.find(x=>x.series===series);
 if(!['request','general','acceptance','requisition'].includes(series)||
    !Number.isInteger(year)||year<2500||year>2700||
    !Number.isInteger(next)||next<1||next>9999999)return notify('เลขและปีไม่ถูกต้อง',true);
 if(year!==Number(state.numberSetupYear||new Date().getFullYear()+543))return notify('ปีที่เลือกเปลี่ยนไป กรุณาโหลดทะเบียนใหม่',true);
 if(next<Number(current?.next_number||1))return notify('ไม่สามารถตั้งเลขต่ำกว่าที่ระบบเคยจัดสรรได้',true);
 if(next===Number(current?.next_number||1))return notify('เลขถัดไปเป็น '+next+'/'+year+' อยู่แล้ว ไม่ต้องเปลี่ยน');
 if(!confirm('ตั้งเลขถัดไปของทะเบียน '+(registrySeriesLabels[series]||series)+' เป็น '+next+'/'+year+' ใช่หรือไม่? เลขที่ออกไปแล้วจะไม่เปลี่ยน'))return;
 const {error}=await db.rpc('set_official_number_start',{
  p_school_id:state.school.id,p_series:series,p_year:year,p_next:next
 });
 if(error)return notify('ตั้งค่าเลขไม่สำเร็จ: '+error.message,true);
 await Promise.all([loadOfficialNumbers(),loadOfficialNumberStarts()]);
 state.flash='ตั้งค่าเลขถัดไป '+next+'/'+year+' สำหรับ '+registrySeriesLabels[series]+' สำเร็จ';
 return officialRegistry();
}

if(form.id==='doc-meta-form'){if(!canEditDocumentMeta(state.currentRecord))return notify('ไม่มีสิทธิ์แก้ไขข้อมูลเอกสารนี้',true);const m=docMetaValue(f,state.currentRecord.document_meta||{});const total=Number(state.currentRecord.total_satang||0)/100;if(['withholding_baht','fine_baht','payable_baht'].some(k=>m[k]!==undefined&&!(Number(m[k])>=0&&Number.isFinite(Number(m[k])))))return notify('กรุณากรอกยอดเงินที่ไม่ติดลบ',true);if(Number(m.withholding_baht||0)+Number(m.fine_baht||0)>total||m.payable_baht!==undefined&&Number(m.payable_baht)>total)return notify('ยอดหักหรือยอดจ่ายจริงเกินวงเงินจัดซื้อ/จัดจ้าง กรุณาตรวจสอบ',true);if(state.demo){state.currentRecord.document_meta=m;state.page='detail';return notify('อัปเดตเอกสารสาธิตแล้ว');}const {error}=await db.rpc('set_procurement_document_meta',{p_record_id:state.currentRecord.id,p_meta:m});if(error)throw Error('บันทึกข้อมูลเอกสารไม่สำเร็จ: '+error.message);state.currentRecord.document_meta=m;await loadRecords();state.page='detail';return notify('บันทึกเลขที่หนังสือและข้อมูลเอกสารแล้ว');}
 if(form.id==='procurement-form'){const editing=!!state.editingRecordId;const original=editing?state.records.find(x=>x.id===state.editingRecordId):null;if(editing&&!canEditMainRecord(original))return notify('ไม่มีสิทธิ์หรือรายการไม่อยู่ในสถานะฉบับร่าง',true);if(!editing&&!state.demo){await refreshSubscription();if(!canCreate())return notify('สิทธิ์สร้างเอกสารหมดอายุแล้ว กรุณาติดต่อเจ้าของแพลตฟอร์ม',true);}collectDraft();const d=state.draft;const docMeta=docMetaValue(d,editing?original?.document_meta||{}:{});const items=state.items.map(x=>({name:String(x.name).trim(),qty:Number(x.qty),unit:String(x.unit).trim(),price_satang:Math.round(Number(x.price)*100)}));let total=items.reduce((n,x)=>n+x.qty*x.price_satang,0);if(!items.length||items.some(x=>!x.name||!x.qty||!x.unit||!x.price_satang))return notify('กรุณากรอกรายการ จำนวน หน่วย และราคาให้ครบ',true);if(!Number.isSafeInteger(Math.round(total))||total<=0||items.some(x=>!Number.isSafeInteger(x.price_satang)||x.price_satang<=0||!Number.isFinite(x.qty)||x.qty<=0))return notify('กรุณาตรวจสอบจำนวนและราคาให้เป็นตัวเลขที่ถูกต้อง และวงเงินต้องมากกว่า 0 บาท',true);if(!d.title||!d.budget_source)return notify('กรุณากรอกเรื่องและงบประมาณ',true);
if(editing){if(state.demo){Object.assign(original,{document_date:d.document_date,title:d.title,reason:d.reason||'',budget_source:d.budget_source,vendor_name:d.vendor_name||'',department:d.department||'',vendor_address:d.vendor_address??original?.vendor_address??'',inspector_name:d.inspector_name||'',due_date:d.due_date||null,items,total_satang:Math.round(total),document_meta:docMeta});state.currentRecord=original;}else{const payload={p_record_id:original.id,p_expected_updated_at:original.updated_at,p_document_date:d.document_date,p_title:d.title,p_reason:d.reason||'',p_budget_source:d.budget_source,p_vendor_name:d.vendor_name||'',p_department:d.department||'',p_vendor_address:d.vendor_address??original?.vendor_address??'',p_inspector_name:d.inspector_name||'',p_due_date:d.due_date||null,p_items:items};const {error}=await db.rpc('update_procurement_draft',payload);if(error)return notify('แก้ไขรายการไม่สำเร็จ: '+error.message,true);const {error:metaError}=await db.rpc('set_procurement_document_meta',{p_record_id:original.id,p_meta:docMeta});await loadRecords();state.currentRecord=state.records.find(x=>x.id===original.id);if(metaError)state.flash='บันทึกข้อมูลหลักแล้ว แต่ข้อมูลประกอบเอกสารไม่สำเร็จ: '+metaError.message;}state.editingRecordId=null;state.page='detail';state.flash=state.flash&&state.flash.startsWith('บันทึกข้อมูลหลักแล้ว')?state.flash:'แก้ไขรายการสำเร็จ โดยคงเลขทะเบียนเดิม';return render();}
let rec;
if(state.demo){const no=1+Math.max(0,...state.records.filter(r=>r.kind===d.kind).map(r=>r.document_number));rec={...d,id:'demo-'+Date.now(),document_number:no,items,total_satang:Math.round(total),state:'draft',signers:{officer:state.school.officer_name,head:state.school.head_name,director:state.school.director_name},document_meta:docMeta};state.records.unshift(rec);}
else{const payload={p_school_id:state.school.id,p_kind:d.kind,p_fiscal_year:Number(d.fiscal_year),p_document_date:d.document_date,p_title:d.title,p_reason:d.reason||'',p_budget_source:d.budget_source,p_vendor_name:d.vendor_name||'',p_department:d.department||'',p_vendor_address:d.vendor_address||'',p_inspector_name:d.inspector_name||'',p_due_date:d.due_date||null,p_items:items};const result=await db.rpc('create_procurement',payload);if(result.error){await refreshSubscription().catch(()=>{});return notify('บันทึกไม่สำเร็จ: '+result.error.message,true);}const {error:metaError}=await db.rpc('set_procurement_document_meta',{p_record_id:result.data,p_meta:docMeta});if(metaError)state.error='สร้างรายการแล้ว แต่บันทึกข้อมูลประกอบเอกสารไม่สำเร็จ: '+metaError.message;await Promise.all([loadRecords(),refreshSubscription()]);rec=state.records.find(r=>r.id===result.data);if(!rec)return notify('บันทึกแล้ว แต่ยังโหลดข้อมูลไม่สำเร็จ กรุณาเปิดทะเบียน',true);}
state.currentRecord=rec;state.page='detail';state.flash='บันทึกสำเร็จ เลขทะเบียน '+rec.document_number+'/'+rec.fiscal_year;render();return;
}}
let teJustDragged=false;
document.addEventListener('click',async ev=>{
 if(state.page==='templates'){
  if(teJustDragged){teJustDragged=false;ev.preventDefault();return;}
  if(ev.target.closest?.('#te-print-preview .te-system-locked,#te-print-preview .signature-name,#te-print-preview .signature-role,#te-print-preview .kp-signature-position,#te-print-preview .memo-field-agency,#te-print-preview .memo-field-number,#te-print-preview .memo-field-to,#te-print-preview .gov-right-head,#te-print-preview .gov-items,#te-print-preview .gov-money-list,#te-print-preview .gov-count,#te-print-preview .te-generated-locked')){
   templateEditor.lockedNotice();ev.preventDefault();return;
  }
  if(ev.target.closest?.('#te-print-preview [data-template-text],#te-print-preview [data-template-header]'))return;
  const signer=ev.target.closest?.('#te-print-preview [data-template-signature]');
  if(signer){ev.preventDefault();return templateEditor.action('tpl-signature',{dataset:{id:signer.dataset.templateSignature}});}
  const node=ev.target.closest?.('#te-print-preview [data-template-drag]');
  if(node){ev.preventDefault();return templateEditor.action('tpl-block',{dataset:{id:node.dataset.templateDrag}});}
 }
 const el=ev.target.closest('[data-action]');
 if(!el)return;ev.preventDefault();
 try{await go(el.dataset.action,el);}catch(ex){notify(ex.message,true);}
});
document.addEventListener('submit',async ev=>{if(!ev.target.id)return;ev.preventDefault();const b=ev.target.querySelector('[type=submit]');if(b)b.disabled=true;try{await handleForm(ev.target);}catch(ex){notify(ex.message,true);}finally{if(b)b.disabled=false;}});
document.addEventListener('focusin',ev=>{if(state.page==='templates'&&ev.target?.dataset?.templateText)templateEditor.selectInline(ev.target);});
document.addEventListener('input',ev=>{const el=ev.target;if(state.page==='templates'&&el.dataset.templateText){templateEditor.inlineInput(el);return;}if(state.page==='templates'&&el.dataset.templateHeader){templateEditor.headerInput(el);return;}if(el.dataset.tplField)templateEditor.editField(el);if(['doc_withholding_baht','doc_fine_baht','doc_payable_baht'].includes(el.name))updatePayablePreview();if(el.name==='doc_delivery_date'&&el.value){const doc=el.closest('form');for(const targetName of ['doc_acceptance_date','doc_inspection_date']){const target=doc?.querySelector('[name="'+targetName+'"]');if(target&&!target.value)target.value=el.value;}}if(el.matches('[data-item]')){const x=state.items[Number(el.dataset.item)];if(x){x[el.dataset.key]=el.value;updateTotal();}}});
document.addEventListener('change',ev=>{if(ev.target?.dataset?.tplField)templateEditor.editField(ev.target);});
document.addEventListener('dragstart',ev=>{if(ev.target.closest?.('#te-print-preview [data-template-text],#te-print-preview [data-template-header]'))return;const t=ev.target.closest?.('[data-template-drag]');if(t&&state.page==='templates')templateEditor.dragStart(t,ev);});
document.addEventListener('dragover',ev=>{if(state.page==='templates'&&ev.target.closest?.('[data-template-drag]'))ev.preventDefault();});
document.addEventListener('drop',ev=>{const t=ev.target.closest?.('[data-template-drag]');if(t&&state.page==='templates')templateEditor.drop(t,ev);});
let tePointer=null;
document.addEventListener('pointerdown',ev=>{
 if(state.page!=='templates')return;
 // Clicking to edit the director's decision must not initiate signature dragging.
 if(ev.target.closest?.('#te-print-preview [data-template-header="decisionText"]'))return;
 const signer=ev.target.closest?.('#te-print-preview [data-template-signature]');
 if(!signer||ev.button!==0)return;
 ev.preventDefault();
 const page=signer.closest('.paper-page');
 const pixelsPerMm=(page?.getBoundingClientRect().width||1)/210;
 tePointer={id:signer.dataset.templateSignature,x:ev.clientX,y:ev.clientY,pxMm:pixelsPerMm,moved:false};
 signer.classList.add('te-dragging-signer');
});
document.addEventListener('pointermove',ev=>{
 if(!tePointer)return;
 const node=document.querySelector('#te-print-preview [data-template-signature="'+tePointer.id+'"]');
 if(!node)return;
 const dx=ev.clientX-tePointer.x,dy=ev.clientY-tePointer.y;
 if(Math.abs(dx)+Math.abs(dy)>4)tePointer.moved=true;
 if(tePointer.moved){
  const x=Math.max(-15,Math.min(15,Math.round(dx/tePointer.pxMm)));
  const y=Math.max(-15,Math.min(15,Math.round(dy/tePointer.pxMm)));
  node.style.transform='translate('+x+'mm,'+y+'mm)';
 }
});
document.addEventListener('pointerup',ev=>{
 if(!tePointer)return;
 const drag=tePointer;tePointer=null;
 if(!drag.moved)return;
 const x=Math.max(-15,Math.min(15,Math.round((ev.clientX-drag.x)/drag.pxMm)));
 const y=Math.max(-15,Math.min(15,Math.round((ev.clientY-drag.y)/drag.pxMm)));
 teJustDragged=true;
 templateEditor.moveSignature(drag.id,x,y);
});
function bootTimeout(promise,ms,message){
  let timeoutId;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_,reject)=>{timeoutId=setTimeout(()=>reject(new Error(message)),ms);})
  ]).finally(()=>clearTimeout(timeoutId));
}
db.auth.onAuthStateChange((event)=>{
  if(event==='PASSWORD_RECOVERY'){
    state.recoveryMode=true;
    state.authForgot=false;
    state.page='auth';
    render();
  }
});
(async()=>{
  try{
    bootStage('auth-reading-session');
    const {data,error}=await bootTimeout(db.auth.getSession(),9000,'การตรวจสอบบัญชีใช้เวลานานเกินไป');
    if(error)throw error;
    state.session=data.session;
    state.page=state.recoveryMode?'auth':'landing';
    if(state.session&&!state.recoveryMode){
      bootStage('auth-loading-roles');
      await bootTimeout(loadUser(),12000,'การโหลดสิทธิ์ผู้ใช้งานใช้เวลานานเกินไป');
      state.page='dashboard';
    }
    bootStage('ui-rendering');
    render();
    bootStage('ui-ready');
  }catch(err){
    bootStage('ui-error');
    console.error('Kru Pasadu startup failure',err);
    state.user=null;state.profile=null;state.owner=false;state.school=null;
    state.session=null;
    state.error='ระบบตรวจสอบบัญชีไม่สำเร็จ ('+(err?.message||'เชื่อมต่อขัดข้อง')+') กรุณาลองเข้าสู่ระบบอีกครั้ง';
    state.page='auth';
    try{render();bootStage('ui-recovery');}catch(displayError){
      console.error('Failed to render recovery screen',displayError);
      app.innerHTML='<main class="startup-failure"><h1>ระบบยังไม่พร้อมใช้งาน</h1><p>กรุณาลองเปิดระบบใหม่อีกครั้ง</p><button onclick="location.reload()">โหลดใหม่</button></main>';
    }
  }finally{
    window.dispatchEvent(new Event('kru:ready'));
  }
})();
