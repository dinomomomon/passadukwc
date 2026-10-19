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
import {buildDocuments,escapeHtml as e} from './print.js';
const db=createClient(SUPABASE_URL,SUPABASE_KEY);
const app=document.getElementById('app');
const bootStage=phase=>{try{window.__kruBootStage=phase;document.documentElement.dataset.kruBoot=phase;sessionStorage.setItem('kru_boot_stage',phase);}catch{}};
bootStage('client-ready');
const demoSchool={id:'demo-school',name:'โรงเรียนตัวอย่างวิทยาลัย',district:'อำเภอเมือง',province:'เชียงใหม่',director_name:'นายสมชาย ตัวอย่าง',head_name:'นางสาวสุภา ตัวอย่าง',officer_name:'นายมานะ ตั้งใจ',finance_name:'นางสาวการเงิน ตัวอย่าง'};
const mkDemo=(id,kind,no,title,vendor,total,date,items)=>({id,kind,document_number:no,fiscal_year:2570,document_date:date,title,reason:'ใช้ในการดำเนินงานตามแผนของสถานศึกษา',department:'กลุ่มบริหารงานวิชาการ',budget_source:'งบดำเนินงาน / กิจกรรมพัฒนาผู้เรียน',method:'วิธีเฉพาะเจาะจง (รอตรวจสอบข้อกฎหมาย)',vendor_name:vendor,items,total_satang:total*100,state:'draft',signers:{officer:demoSchool.officer_name,head:demoSchool.head_name,director:demoSchool.director_name}});
const demoRecords=[
 mkDemo('demo-1','purchase',1,'จัดซื้อวัสดุสำนักงาน','ร้านค้าตัวอย่าง',3200,'2026-10-16',[{name:'กระดาษถ่ายเอกสาร A4',qty:5,unit:'รีม',price_satang:12000},{name:'หมึกเครื่องพิมพ์',qty:2,unit:'กล่อง',price_satang:130000}]),
 mkDemo('demo-2','hire',1,'จ้างทำป้ายประชาสัมพันธ์','ร้านป้ายตัวอย่าง',980,'2026-10-17',[{name:'งานออกแบบและจัดทำป้าย',qty:1,unit:'งาน',price_satang:98000}]),
 mkDemo('demo-3','purchase',2,'ซื้ออุปกรณ์การเรียน','ร้านศึกษาภัณฑ์',1250,'2026-10-18',[{name:'อุปกรณ์การเรียน',qty:5,unit:'ชุด',price_satang:25000}])
];
const state={demoLogoUrl:'',session:null,user:null,profile:null,owner:false,memberships:[],school:null,schools:[],schoolRequests:[],subscriptions:[],subscription:null,members:[],records:[],demo:false,page:'landing',currentRecord:null,flash:'',error:'',items:[{name:'',qty:'1',unit:'',price:''}],draft:{},authMode:'login',authForgot:false,authEmail:'',recoveryMode:(new URLSearchParams(window.location.search).get('auth')==='recovery'||/(?:^|&)type=recovery(?:&|$)/.test(window.location.hash.slice(1))),pendingSignupEmail:'',filter:''};
const money=n=>(Number(n||0)/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
const dateThai=d=>d?new Date(d+'T12:00:00+07:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}):'-';
const dateToday=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
const fiscalYear=()=>{let d=new Date(Date.now()+7*3600000);return d.getUTCFullYear()+543+(d.getUTCMonth()>=9?1:0);};
// Personnel management is reserved for active school admins of this tenant.
// Super Admin may create schools and assign their initial admin, but cannot
// manage other schools' staff through school-scoped user controls.
const isSchoolAdmin=()=>!state.demo&&!!state.user&&state.memberships.some(x=>x.school_id===state.school?.id&&x.role==='school_admin');
const isAdmin=()=>state.demo||isSchoolAdmin();

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

const i=(name)=>{const paths={dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',plus:'<path d="M12 5v14M5 12h14"/>',users:'<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a6 6 0 0 1 12 0v2M16 4a4 4 0 0 1 0 8M17 15a6 6 0 0 1 5 6"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19 13a7 7 0 0 0 0-2l2-1-2-4-2 1a8 8 0 0 0-2-1l-1-3h-4L9 6a8 8 0 0 0-2 1L5 6 3 10l2 1a7 7 0 0 0 0 2l-2 1 2 4 2-1a8 8 0 0 0 2 1l1 3h4l1-3a8 8 0 0 0 2-1l2 1 2-4z"/>',logout:'<path d="M10 17l5-5-5-5M15 12H3M12 3h5a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4h-5"/>',building:'<rect x="3" y="7" width="18" height="14" rx="1"/><path d="M8 21V3h8v18M10 6h4M7 11h2M15 11h2M7 15h2M15 15h2"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',download:'<path d="M12 3v12M8 11l4 4 4-4M4 17v4h16v-4"/>',check:'<path d="m4 12 5 5L20 6"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',cloud:'<path d="M20 16a5 5 0 0 0-5-5h-1a6 6 0 0 0-12 1 4 4 0 0 0 2 8h14a4 4 0 0 0 2-4z"/>'};return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.file)+'</svg>';};

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
   '</div><div class="kp-intro-note">* ระบบอยู่ระหว่างพัฒนาและตรวจรับแม่แบบเอกสารราชการ การเชื่อมต่อ Google Drive อัตโนมัติยังไม่เปิดใช้งาน</div>'+
   '</div></section>';
}
function auth(){
  const tab=state.authMode==='signup'?'signup':'login';
  const mode=state.recoveryMode?'recovery':state.authForgot?'forgot':tab;
  const mail=e(state.authEmail||rememberedEmail());
  const title={login:'ยินดีต้อนรับกลับ',signup:'เริ่มต้นกับครูพัสดุ',forgot:'ลืมรหัสผ่าน?',recovery:'ตั้งรหัสผ่านใหม่'}[mode];
  const subtitle={login:'เข้าสู่ระบบเพื่อจัดการงานพัสดุของโรงเรียน',signup:'สร้างบัญชีแล้วรอผู้ดูแลโรงเรียนกำหนดสิทธิ์',forgot:'กรอกอีเมลที่ใช้สมัคร เพื่อรับลิงก์ตั้งรหัสผ่านใหม่',recovery:'กำหนดรหัสผ่านใหม่สำหรับบัญชีของคุณ'}[mode];
  const password=(name,label,auto='current-password')=>'<div class="kp-field"><label for="kp-'+name+'">'+label+'</label><div class="kp-password-wrap"><input id="kp-'+name+'" name="'+name+'" type="password" minlength="8" required autocomplete="'+auto+'" placeholder="อย่างน้อย 8 ตัวอักษร"><button type="button" class="kp-eye" data-action="show-password" data-target="kp-'+name+'" aria-label="แสดงรหัสผ่าน">แสดง</button></div></div>';
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
const menu=[['dashboard','ภาพรวม',i('dashboard')],['records','ทะเบียนจัดซื้อจัดจ้าง',i('file')],['create','สร้างรายการใหม่',i('plus')]];

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
function sidebar(){let items=[...menu];if(isSchoolAdmin())items.push(['members','จัดการผู้ใช้งาน',i('users')]);if(isAdmin())items.push(['settings','ข้อมูลโรงเรียน',i('settings')]);items.push(['storage','จัดเก็บเอกสาร',i('cloud')]);return '<aside class="sidebar"><div class="side-brand">'+logo()+'</div>'+schoolIdentity()+'<div class="side-menu-label">งานพัสดุ</div>'+items.map(([act,label,icon])=>'<button class="navlink '+(state.page===act?'active':'')+'" data-action="'+act+'">'+icon+label+'</button>').join('')+(state.owner?'<div class="side-menu-label">เจ้าของระบบ</div><button data-action="owner" class="navlink">'+i('building')+'บริหารโรงเรียน</button>':'')+'<div class="side-footer">'+(state.demo?'โหมดตัวอย่าง (ไม่เก็บข้อมูล)':'บัญชีโรงเรียนออนไลน์')+'<br>ครูพัสดุ v0.1 · รุ่นทดลอง</div></aside>';}
function shell(title,sub,body){const top='<header class="topbar"><div class="top-school">'+schoolLogo('topbar')+'<div><h2>'+e(state.school?.name||'ครูพัสดุ')+'</h2><p>'+e(sub||'ระบบจัดซื้อจัดจ้างออนไลน์')+'</p></div></div>'+accountHeader()+'</header>';app.innerHTML='<div class="shell">'+sidebar()+'<div class="workspace">'+top+'<div class="content">'+(state.demo?'<div class="alert">โหมดตัวอย่าง — ข้อมูลและเอกสารไม่ถูกบันทึกบนเซิร์ฟเวอร์ กรุณาเข้าสู่ระบบเพื่อใช้งานจริง</div>':subscriptionBanner())+msg()+body+'<div class="footer">ครูพัสดุ • KRU PASADU — ระบบทดลองสำหรับพัฒนาและตรวจรับ</div></div></div></div><div class="mobile-menu">'+menu.map(([a,t,ic])=>'<button data-action="'+a+'">'+ic+'<span>'+t.replace('ทะเบียนจัดซื้อจัดจ้าง','ทะเบียน')+'</span></button>').join('')+'</div>';}
function heading(title,sub,action=''){return '<div class="page-title"><div><h1>'+title+'</h1><p>'+sub+'</p></div>'+action+'</div>';}
const badge=r=>'<span class="tag '+(r.state==='draft'?'amber':'')+'">'+({draft:'ฉบับร่าง',review:'รอตรวจสอบ',approved:'อนุมัติ',received:'ตรวจรับแล้ว',completed:'เสร็จสิ้น',cancelled:'ยกเลิก'}[r.state]||'ร่าง')+'</span>';
function recordTable(rows){return '<div class="table-scroller"><table><thead><tr><th>เลขที่</th><th>วันที่</th><th>รายการ</th><th>ประเภท</th><th>วงเงิน</th><th>สถานะ</th><th></th></tr></thead><tbody>'+ (rows.length?rows.map(r=>'<tr><td><b>'+e(r.document_number)+'/'+e(r.fiscal_year)+'</b></td><td>'+dateThai(r.document_date)+'</td><td><button class="linkish" data-action="open" data-id="'+e(r.id)+'">'+e(r.title)+'</button><br><small class="muted">'+e(r.vendor_name||'ยังไม่ระบุผู้ขาย')+'</small></td><td><span class="tag gray">'+(r.kind==='purchase'?'จัดซื้อ':'จัดจ้าง')+'</span></td><td class="amount">'+money(r.total_satang)+'</td><td>'+badge(r)+'</td><td>'+btn('เปิดดู','open','mini-btn','data-id="'+e(r.id)+'"')+'</td></tr>').join(''):'<tr><td colspan="7" class="empty">ยังไม่มีรายการ เริ่มต้นสร้างรายการใหม่ได้เลย</td></tr>')+'</tbody></table></div>';}
function dashboard(){const rows=state.records;const purch=rows.filter(r=>r.kind==='purchase'),hire=rows.filter(r=>r.kind==='hire');const total=rows.reduce((s,r)=>s+Number(r.total_satang||0),0);const block=(t,n,ico,note)=>'<div class="stat"><div class="stat-top"><span>'+t+'</span><span class="stat-ico">'+ico+'</span></div><strong>'+n+'</strong><small>'+note+'</small></div>';shell('ภาพรวม','งานพัสดุ / ภาพรวม',heading('สวัสดี ยินดีต้อนรับ 👋','ติดตามงานพัสดุทั้งหมดในโรงเรียนได้จากที่เดียว',createAction())+'<div class="stats-grid">'+block('รายการทั้งหมด',rows.length,'▤','รายการที่บันทึกแล้ว')+block('งานจัดซื้อ',purch.length,'◈','ทะเบียนจัดซื้อ')+block('งานจัดจ้าง',hire.length,'⚒','ทะเบียนจัดจ้าง')+block('วงเงินรวม',money(total),'฿','บาท รวมทุกประเภท')+'</div><div class="grid-two"><section class="card"><div class="section-head"><h2>รายการล่าสุด</h2>'+btn('ดูทั้งหมด →','records','mini-btn')+'</div>'+recordTable(rows.slice(0,6))+'</section><section class="card"><h2>ทางลัดงานพัสดุ</h2><div class="action-grid"><button class="action-card" data-action="create"><span class="action-icon">'+i('plus')+'</span>สร้างรายการ</button><button class="action-card" data-action="records"><span class="action-icon">'+i('file')+'</span>ค้นหาเอกสาร</button><button class="action-card" data-action="settings"><span class="action-icon">'+i('settings')+'</span>ผู้ลงนาม</button><button class="action-card" data-action="storage"><span class="action-icon">'+i('cloud')+'</span>การจัดเก็บ</button></div><div class="alert" style="margin:18px 0 0">เอกสารที่ระบบสร้างเป็นแบบร่าง ต้องตรวจสอบกับระเบียบที่มีผลบังคับก่อนใช้งานราชการ</div></section></div>');}
function records(){const q=(state.filter||'').toLowerCase();const rows=state.records.filter(r=>(r.title+' '+r.vendor_name+' '+r.document_number).toLowerCase().includes(q));shell('ทะเบียนพัสดุ','รายการจัดซื้อจัดจ้าง',heading('ทะเบียนจัดซื้อจัดจ้าง','เลขเอกสารแยกตามโรงเรียน ประเภท และปีงบประมาณ',createAction())+'<section class="card"><div class="filters"><input class="input" id="record-search" placeholder="ค้นหาเรื่อง ผู้ขาย หรือเลขที่..." value="'+e(state.filter)+'">'+btn(i('search')+' ค้นหา','search','secondary')+'</div>'+recordTable(rows)+'</section>');}
function form(){const d=state.draft;const input=(label,name,value='',type='text',attrs='')=>'<div class="field"><label>'+label+'</label><input class="input" name="'+name+'" type="'+type+'" '+attrs+' value="'+e(value)+'"></div>';const area=(label,name,value)=>'<div class="field"><label>'+label+'</label><textarea class="textarea" name="'+name+'">'+e(value)+'</textarea></div>';const items=state.items.map((x,k)=>'<div class="item-entry"><input class="input" data-item="'+k+'" data-key="name" placeholder="รายละเอียด" value="'+e(x.name)+'"><input class="input" data-item="'+k+'" data-key="qty" type="number" min=".01" step=".01" value="'+e(x.qty)+'"><input class="input" data-item="'+k+'" data-key="unit" placeholder="หน่วย" value="'+e(x.unit)+'"><input class="input" data-item="'+k+'" data-key="price" type="number" min=".01" step=".01" placeholder="บาท" value="'+e(x.price)+'"><button type="button" class="mini-btn" data-action="remove-item" data-id="'+k+'">×</button></div>').join('');shell('สร้างรายการใหม่','งานพัสดุ / บันทึกรายการ',heading('สร้างรายการจัดซื้อจัดจ้าง','กรอกข้อมูลเพียงครั้งเดียวและสร้างชุดเอกสารอัตโนมัติ')+'<form id="procurement-form"><div class="steps"><span class="step active">01 ข้อมูลหลัก</span><span class="step">02 รายการ</span><span class="step">03 ผู้ตรวจรับ</span><span class="step">04 พิมพ์เอกสาร</span></div><section class="card"><h2>ข้อมูลการจัดหา</h2><div class="form-grid"><div class="field"><label>ประเภทการจัดหา</label><select class="select" name="kind"><option value="purchase" '+(d.kind!=='hire'?'selected':'')+'>จัดซื้อ</option><option value="hire" '+(d.kind==='hire'?'selected':'')+'>จัดจ้าง</option></select></div>'+input('วันที่เอกสาร','document_date',d.document_date||dateToday(),'date','required')+input('ปีงบประมาณ (พ.ศ.)','fiscal_year',d.fiscal_year||fiscalYear(),'number','required min="2500" max="2700"')+input('กลุ่มงาน/ฝ่ายที่ขอ','department',d.department||'')+'</div>'+input('เรื่องที่จัดซื้อ/จัดจ้าง','title',d.title||'','text','required maxlength="500" placeholder="เช่น ซื้อวัสดุสำนักงาน"')+area('เหตุผลและความจำเป็น','reason',d.reason||'')+input('แผนงาน/โครงการ/แหล่งเงิน','budget_source',d.budget_source||'','text','required')+'</section><section class="card"><h2>รายการพัสดุ/รายละเอียดงานจ้าง</h2><p class="muted" style="font-size:12px">จำนวน × ราคาสุทธิต่อหน่วย ระบบตรวจสอบวงเงินไม่เกิน 5,000 บาท</p>'+items+btn('+ เพิ่มรายการ','add-item','secondary')+'<div class="total-row"><span>วงเงินรวมสุทธิ</span><strong id="live-total">0.00 บาท</strong></div></section><section class="card"><h2>ผู้ขาย ผู้ลงนาม และผู้ตรวจรับ</h2><div class="form-grid">'+input('ชื่อร้านค้า/ผู้รับจ้าง','vendor_name',d.vendor_name||'')+input('กำหนดส่งมอบ (ถ้าทราบ)','due_date',d.due_date||'','date')+'</div>'+area('ที่อยู่ผู้ขาย/ผู้รับจ้าง','vendor_address',d.vendor_address||'')+input('ชื่อผู้ตรวจรับ (เว้นว่างไว้ได้)','inspector_name',d.inspector_name||'')+'<div class="alert success-alert">เจ้าหน้าที่พัสดุ: '+e(state.school.officer_name||'ยังไม่ตั้งค่า')+' · หัวหน้าเจ้าหน้าที่: '+e(state.school.head_name||'ยังไม่ตั้งค่า')+' · ผู้อำนวยการ: '+e(state.school.director_name||'ยังไม่ตั้งค่า')+'</div><div class="alert">ชื่อผู้ลงนามจะปรากฏบนเอกสาร แต่ยังต้องลงนามและอนุมัติจริง ระบบจะไม่ถือว่าการพิมพ์ชื่อเป็นการอนุมัติ</div><div class="row">'+btn('ยกเลิก','dashboard','secondary')+'<button class="primary" type="submit">บันทึกและออกเลขเอกสาร →</button></div></section></form>');updateTotal();}
function updateTotal(){const v=state.items.reduce((n,x)=>n+(Number(x.qty)||0)*(Number(x.price)||0),0);const el=document.getElementById('live-total');if(el){el.textContent=v.toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})+' บาท';el.style.color=v>5000?'#bf5140':'#0f8479';}}
function detail(){const r=state.currentRecord;if(!r){records();return;}const s=state.school;const docs=r.kind==='purchase'?['รายงานขอซื้อพัสดุ','รายละเอียดพัสดุแนบท้าย','รายงานผลการพิจารณาฯ','ใบตรวจรับพัสดุ','ขออนุมัติเบิกจ่าย','ใบเบิกพัสดุ']:['รายงานขอจ้าง','รายละเอียดงานจ้างแนบท้าย','รายงานผลการพิจารณาฯ','ใบตรวจรับงานจ้าง','ขออนุมัติเบิกจ่าย'];shell('เอกสาร '+r.document_number,'งานพัสดุ / รายละเอียดรายการ',heading(e(r.title),'เลขที่ '+e(r.document_number)+'/'+e(r.fiscal_year)+' • '+dateThai(r.document_date),btn(i('download')+' พิมพ์ / บันทึก PDF','print'))+'<div class="stats-grid">'+[['ประเภท',r.kind==='purchase'?'จัดซื้อ':'จัดจ้าง'],['เลขเอกสาร',r.document_number+'/'+r.fiscal_year],['รายการ',(r.items||[]).length],['วงเงิน',money(r.total_satang)+' บาท']].map(([x,y])=>'<div class="stat"><div class="stat-top">'+x+'</div><strong style="font-size:22px">'+e(y)+'</strong></div>').join('')+'</div><div class="grid-two"><div class="card"><h2>ข้อมูลรายการ</h2><p><b>ผู้ขาย:</b> '+e(r.vendor_name||'-')+'</p><p><b>เหตุผล:</b> '+e(r.reason||'-')+'</p><p><b>งบประมาณ:</b> '+e(r.budget_source||'-')+'</p><p><b>ผู้ตรวจรับ:</b> '+e(r.inspector_name||'เว้นชื่อให้กรอกเองบนเอกสาร')+'</p><p><b>ผู้อำนวยการ:</b> '+e(r.signers?.director||s.director_name||'-')+'</p>'+tableItems(r)+'</div><div class="card"><h2>ชุดเอกสารที่สร้างได้</h2>'+docs.map((d,k)=>'<div class="row" style="border-bottom:1px solid #e9eff1;padding:12px 0"><span style="font-size:13px">'+(k+1)+'. '+d+'</span><span class="tag gray">A4</span></div>').join('')+'<div class="print-toolbar">'+btn(i('eye')+' ดูตัวอย่าง','preview','secondary')+btn(i('download')+' พิมพ์/PDF','print')+'</div><p class="hint">พิมพ์เอกสารเป็น PDF ได้จากหน้าต่าง Print ของเบราว์เซอร์</p><div class="alert">ต้นแบบรอตรวจรับข้อความและข้อกฎหมาย ยังไม่ได้เชื่อม Google Drive</div>'+(isAdmin()?'<form id="renumber-form" style="border-top:1px solid #e8eff0;padding-top:15px;margin-top:16px"><h2>แก้ไขเลขเอกสาร</h2><div class="field"><label>เลขใหม่ (ไม่ซ้ำ)</label><input class="input" name="number" type="number" min="1" max="9999999" required value="'+e(r.document_number)+'"></div><div class="field"><label>เหตุผลในการแก้เลข</label><input class="input" name="reason" minlength="5" required placeholder="ระบุเหตุผลอย่างน้อย 5 ตัวอักษร"></div><button class="secondary" type="submit">ยืนยันแก้เลข</button><p class="hint">ระบบเก็บเลขเดิม ผู้แก้ไข และเหตุผลในประวัติ</p></form>':'')+'</div></div>');}
function tableItems(r){return '<div class="table-scroller"><table><thead><tr><th>รายการ</th><th>จำนวน</th><th>ราคา</th></tr></thead><tbody>'+(r.items||[]).map(x=>'<tr><td>'+e(x.name)+'</td><td>'+e(x.qty)+' '+e(x.unit)+'</td><td>'+money(Number(x.price_satang)*Number(x.qty))+'</td></tr>').join('')+'</tbody></table></div>';}

async function printOfficialDocuments(){
  if(!state.currentRecord)return;
  const root=document.getElementById('print-area');
  root.innerHTML=buildDocuments(state.currentRecord,state.school);
  document.body.classList.add('print-measuring');
  try{
    if(document.fonts?.ready)await document.fonts.ready;
    await Promise.all([...root.querySelectorAll('img')].map(img=>img.decode?.().catch(()=>{})||Promise.resolve()));

    // Fit each complete document, not its fragments. Prefer generous typography
    // and progressively select a smaller readable size only when necessary.
    // Text and signatures are sized independently. Keep each memo (including
    // all its approvals) together; never move a lone signature to the next page.
    const layoutOptions=[
      ['comfortable','normal'],
      ['balanced','normal'],
      ['fitted','normal'],
      ['compact','normal'],
      ['compact','balanced'],
      ['minimum','normal'],
      ['minimum','balanced'],
      ['minimum','compact'],
      ['extra','balanced'],
      ['extra','compact'],
      ['extra','minimum']
    ];
    const fits=async sheet=>{
      await new Promise(resolve=>requestAnimationFrame(resolve));
      const content=sheet.querySelector('.doc-sheet-body');
      if(!content)throw new Error('ไม่พบเนื้อหาเอกสารที่จะพิมพ์');
      const css=getComputedStyle(sheet);
      const sheetRect=sheet.getBoundingClientRect();
      const top=sheetRect.top+parseFloat(css.paddingTop);
      const bottom=sheetRect.bottom-parseFloat(css.paddingBottom)-14;
      // Detect text overflow even if the container's visible box is clipped.
      if(content.getBoundingClientRect().height>bottom-top)return false;
      if(content.scrollHeight>content.clientHeight+3)return false;
      // A4 contains every signature, date and director's approval in full.
      return [...sheet.querySelectorAll('.signature-card,.memo-signatures,.director-sign,.inspector-sign,.approval-options')]
        .every(node=>{
          const rect=node.getBoundingClientRect();
          return rect.top>=top-3 && rect.bottom<=bottom;
        });
    };
    const problems=[];
    const layoutSummary=[];
    for(const sheet of [...root.querySelectorAll('.paper-page')]){
      sheet.classList.remove('memo-balanced','print-tight','print-compact','print-flow','print-continuation');
      const inspector=sheet.querySelector('.inspector-sign');
      const signatureCards=[...sheet.querySelectorAll('.signature-card')];
      const isMemo=sheet.classList.contains('memo-page');
      const approval=sheet.querySelector('.memo-signatures');
      if(isMemo&&(!approval||approval.querySelectorAll('.signature-card').length!==3))
        throw new Error('ช่องลงนามในบันทึกข้อความไม่ครบ กรุณาติดต่อผู้ดูแลระบบ');
      // Never remove or hide signature fields to make a page fit.
      let selection=null;
      const tryLayouts=async()=>{
        for(const [bodySize,signSize] of layoutOptions){
          sheet.dataset.density=bodySize;
          sheet.dataset.signDensity=signSize;
          if(await fits(sheet)){
            selection={bodySize,signSize};
            return true;
          }
        }
        return false;
      };
      // A long decorative table must not force the entire document's
      // font down to its minimum; shorten only its blank ruled area first.
      let fitted=await tryLayouts();
      if(!fitted){
        const blank=sheet.querySelector('.official-table-ruled .table-filler');
        if(blank){
          const initial=parseFloat(blank.style.height)||60;
          for(const height of [45,35,25,15,8,0]){
            if(height>=initial)continue;
            blank.style.height=height+'mm';
            if(await tryLayouts()){fitted=true;break;}
          }
        }
      }
      const title=sheet.querySelector('.memo-field-subject .memo-value,.print-title')?.textContent?.trim()||'เอกสาร';
      if(!fitted){
        problems.push(title);
      }else{
        // Check that the fit did not drop a signature while applying styles.
        if(isMemo&&approval.querySelectorAll('.signature-card').length!==3)
          throw new Error('เอกสารขาดช่องลงนามหลังจัดหน้า');
        layoutSummary.push({name:title,body:selection.bodySize,signatures:selection.signSize});
      }
    }
    if(problems.length){
      throw new Error('เอกสาร '+problems.join(' / ')+' มีข้อความยาวเกินหน้ากระดาษ A4 แม้ปรับขนาดตัวอักษรแล้ว เพื่อไม่ให้ลายเซ็นตกหน้า กรุณาย่อเนื้อหาหรือแยกรายละเอียดเป็นเอกสารแนบท้าย โดยเก็บบล็อกลงนามไว้ด้วยกัน');
    }
    root.dataset.continuationCount='0';
    root.dataset.layoutSummary=JSON.stringify(layoutSummary);
  } catch(err){
    document.body.classList.remove('print-measuring');
    root.innerHTML='';
    notify(err.message||'ตรวจรูปแบบก่อนพิมพ์ไม่สำเร็จ',true);
    return;
  }
  document.body.classList.remove('print-measuring');
  await new Promise(resolve=>requestAnimationFrame(resolve));
  window.print();
}
function preview(){detail();const sheet=buildDocuments(state.currentRecord,state.school);document.getElementById('print-area').innerHTML=sheet;const target=app.querySelector('.content');target.insertAdjacentHTML('beforeend','<div class="card" id="preview-output"><div class="section-head"><h2>ตัวอย่างเอกสารสำหรับพิมพ์</h2>'+btn('พิมพ์ / PDF','print')+'</div><div class="doc-preview"><div class="preview-page"><div class="official">'+sheet+'</div></div></div><p class="hint">กรุณาตรวจข้อความและจำนวนหน้าก่อนใช้งานจริง</p></div>');document.querySelector('#preview-output')?.scrollIntoView({behavior:'smooth'});}
function storage(){shell('จัดเก็บเอกสาร','เชื่อมต่อคลาวด์ของโรงเรียน',heading('จัดเก็บเอกสาร','ข้อมูลรายการบันทึกใน Supabase ส่วน PDF จะเชื่อมกับ Google Drive')+'<div class="card"><span class="tag amber">อยู่ระหว่างพัฒนา</span><h2 style="margin-top:14px">Google Drive สำหรับแต่ละโรงเรียน</h2><p>เวอร์ชันนี้พิมพ์และบันทึกเป็น PDF ลงอุปกรณ์ได้แล้ว การบันทึกไฟล์ขึ้น Google Drive อัตโนมัติยังไม่เปิดใช้งาน เพื่อป้องกันการขอสิทธิ์เข้าถึงบัญชี Google โดยไม่จำเป็น</p><p>ในรุ่นถัดไปจะมีระบบเชื่อมต่อ Drive ผ่าน OAuth และจัดโฟลเดอร์ตามปีงบประมาณ/เลขที่เอกสาร พร้อมเก็บประวัติเวอร์ชัน</p>'+btn('กลับหน้าหลัก','dashboard')+'</div>');}
function settings(){if(!isAdmin()){notify('เฉพาะผู้ดูแลโรงเรียน',true);return;}const s=state.school;const inp=(t,k)=>'<div class="field"><label>'+t+'</label><input class="input" name="'+k+'" value="'+e(s[k]||'')+'"></div>';shell('ข้อมูลโรงเรียน','ตั้งค่าผู้ลงนาม',heading('ตั้งค่าโรงเรียนและผู้ลงนาม','ชื่อและตำแหน่งที่ตั้งค่าใช้กับรายการใหม่ ส่วนเอกสารเก่าจะเก็บชื่อเดิม')+'<div class="card"><h2>โลโก้โรงเรียน</h2><div class="school-logo-setting">'+schoolLogo('settings')+'<div><b>'+e(s.name)+'</b><p class="muted">สำหรับหน้า Dashboard และเมนูของโรงเรียนเท่านั้น <strong>ไม่แทรกในเอกสารราชการและไม่แทนตราครุฑ</strong></p></div></div><form id="school-logo-form"><div class="field"><label>แนบไฟล์โลโก้โรงเรียน (PNG, JPG หรือ WEBP)</label><input class="input" id="school-logo-file" name="school_logo" type="file" accept="image/png,image/jpeg,image/webp" required><small class="hint">ขนาดไม่เกิน 1 MB แนะนำภาพสี่เหลี่ยมจัตุรัส พื้นหลังโปร่งใส</small></div><div class="logo-form-actions"><button class="secondary" type="submit">อัปโหลดโลโก้โรงเรียน</button>'+(s.logo_path||state.demoLogoUrl?btn('นำโลโก้ออก','remove-school-logo','mini-btn'):'')+'</div></form></div><form class="card" id="school-form"><h2>ข้อมูลสถานศึกษา</h2>'+inp('ชื่อโรงเรียน','name')+'<div class="form-grid">'+inp('อำเภอ','district')+inp('จังหวัด','province')+'</div><h2>ชื่อผู้ลงนาม</h2><div class="form-grid">'+inp('เจ้าหน้าที่พัสดุ','officer_name')+inp('หัวหน้าเจ้าหน้าที่พัสดุ','head_name')+inp('ผู้อำนวยการสถานศึกษา','director_name')+inp('เจ้าหน้าที่การเงิน','finance_name')+'</div><button type="submit" class="primary">บันทึกข้อมูลโรงเรียน</button></form>');}
async function loadMembers(){if(!isSchoolAdmin()){state.members=[];return;}const {data,error}=await db.rpc('list_school_members',{p_school_id:state.school.id});if(error){state.error=error.message;return;}state.members=data||[];}
function members(){if(!isSchoolAdmin()){state.page='dashboard';notify('เฉพาะแอดมินของโรงเรียนเท่านั้นที่จัดการผู้ใช้งานได้',true);return;}shell('ผู้ใช้ในโรงเรียน','การกำหนดสิทธิ์',heading('จัดการเจ้าหน้าที่','เพิ่มเจ้าหน้าที่ได้หลังจากเจ้าตัวสมัครบัญชีด้วยอีเมลแล้ว')+'<div class="grid-two"><div class="card"><h2>สมาชิกที่มีสิทธิ์ใช้งาน</h2>'+((state.members.length)?'<div class="table-scroller"><table><thead><tr><th>ชื่อ</th><th>อีเมล</th><th>บทบาท</th></tr></thead><tbody>'+state.members.map(m=>'<tr><td>'+e(m.member_name)+'</td><td>'+e(m.member_email)+'</td><td><span class="tag">'+e(m.member_role)+'</span></td></tr>').join('')+'</tbody></table></div>':'<p>ยังไม่มีรายชื่อที่ดึงได้</p>')+'</div><form id="member-form" class="card"><h2>เพิ่มเจ้าหน้าที่</h2><div class="field"><label>อีเมลที่สมัครบัญชีแล้ว</label><input required class="input" name="email" type="email" placeholder="teacher@school.ac.th"></div><div class="field"><label>หน้าที่ในระบบ</label><select class="select" name="role"><option value="procurement_officer">เจ้าหน้าที่พัสดุ</option><option value="procurement_head">หัวหน้าเจ้าหน้าที่</option><option value="school_admin">แอดมินโรงเรียน</option><option value="director">ผู้อำนวยการ</option><option value="finance">เจ้าหน้าที่การเงิน</option><option value="inspector">ผู้ตรวจรับ</option></select></div><button class="primary" type="submit">เพิ่มสมาชิก</button><p class="hint">สิทธิ์ใช้งานระบบไม่ใช่หลักฐานแต่งตั้งหน้าที่ตามกฎหมาย</p></form></div>');}
async 
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
function render(){if(!state.user&&!state.demo){if(state.page==='auth')auth();else if(state.page==='verify-email')verificationPending();else landing();return;}if(state.user&&!state.owner&&!state.school&&!state.demo){waitAccess();return;}if(state.owner&&!state.school&&!state.demo){owner();return;}if(!state.school){state.school=demoSchool;}if(state.page==='records')return records();if(state.page==='create')return form();if(state.page==='detail')return detail();if(state.page==='preview')return preview();if(state.page==='members')return members();if(state.page==='settings')return settings();if(state.page==='storage')return storage();if(state.page==='owner')return owner();dashboard();}
async function loadUser(){if(!state.session){state.user=null;state.profile=null;state.owner=false;return;}const {data:user}=await db.auth.getUser();state.user=user?.user||null;if(!state.user){state.profile=null;return;}const [admin,memberships,profile]=await Promise.all([db.from('platform_admins').select('user_id').eq('user_id',state.user.id),db.from('memberships').select('school_id,role,schools(*)').eq('user_id',state.user.id).eq('active',true),db.from('profiles').select('full_name').eq('id',state.user.id).maybeSingle()]);if(admin.error)console.warn(admin.error.message);if(memberships.error)console.warn(memberships.error.message);if(profile.error)console.warn(profile.error.message);state.profile=profile.data||{full_name:state.user?.user_metadata?.full_name||''};state.owner=!!admin.data?.length;state.memberships=memberships.data||[];state.school=state.memberships[0]?.schools||null;if(state.owner){await loadOwner();}if(state.school)await Promise.all([loadRecords(),refreshSubscription()]);}
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
async function loadRecords(){if(!state.school||state.demo)return;const {data,error}=await db.from('procurements').select('*').eq('school_id',state.school.id).order('created_at',{ascending:false}).limit(300);if(error){state.error=error.message;return;}state.records=data||[];}
async function startDemo(){state.demo=true;state.user=null;state.school=demoSchool;state.records=[...demoRecords];state.owner=false;state.page='dashboard';render();}
async function signOut(){if(state.demo){state.demo=false;state.school=null;state.profile=null;state.page='landing';state.records=[];render();return;}const {error}=await db.auth.signOut();if(error)return notify('ออกจากระบบไม่สำเร็จ: '+error.message,true);state.session=null;state.user=null;state.profile=null;state.school=null;state.owner=false;state.page='landing';render();}
async function go(action,el){if(action==='home'){state.page='landing';state.demo=false;render();return;}if(action==='login'||action==='signup'){
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
}if(action==='resend-confirmation'){if(!state.pendingSignupEmail)return notify('ไม่พบอีเมลที่สมัคร กรุณาลองสมัครใหม่',true);const {error}=await db.auth.resend({type:'signup',email:state.pendingSignupEmail,options:{emailRedirectTo:window.location.origin}});if(error)return notify('ยังส่งอีเมลซ้ำไม่ได้ กรุณารอสักครู่แล้วลองอีกครั้ง',true);return notify('ส่งอีเมลยืนยันอีกครั้งแล้ว กรุณาตรวจกล่องจดหมายและโฟลเดอร์สแปม');}if(action==='demo')return startDemo();if(action==='signout')return signOut();if(action==='profile')return openProfileEditor();if(action==='close-profile'){document.getElementById('profile-dialog')?.close();document.getElementById('profile-dialog')?.remove();return;}if(action==='search'){state.filter=document.querySelector('#record-search')?.value||'';state.page='records';render();return;}if(action==='add-item'){collectDraft();state.items.push({name:'',qty:'1',unit:'',price:''});form();return;}if(action==='remove-item'){collectDraft();if(state.items.length>1)state.items.splice(Number(el.dataset.id),1);form();return;}if(action==='open'){state.currentRecord=state.records.find(r=>String(r.id)===String(el.dataset.id));state.page='detail';render();return;}if(action==='print'){await printOfficialDocuments();return;}if(action==='preview'){state.page='preview';render();return;}if(action==='renew-school'){
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
}if(action==='approve-school'){if(!confirm('อนุมัติคำขอเปิดโรงเรียนนี้?'))return;const {error}=await db.rpc('platform_approve_request',{p_request_id:el.dataset.id});if(error)return notify(error.message,true);await loadOwner();state.flash='อนุมัติโรงเรียนแล้ว';return owner();}if(action==='owner'){await loadOwner();state.page='owner';return render();}if(action==='members'){if(!isSchoolAdmin())return notify('เฉพาะแอดมินโรงเรียนเท่านั้นที่เข้าเมนูจัดการผู้ใช้งานได้',true);await loadMembers();state.page='members';return render();}if(action==='subscription-help'){return notify('สิทธิ์ทดลองหรือสมาชิกหมดอายุแล้ว กรุณาติดต่อเจ้าของแพลตฟอร์มครูพัสดุ (LINE จะเพิ่มภายหลัง)',true);}if(action==='create'){if(!state.demo){try{await refreshSubscription();}catch(ex){return notify('ตรวจสอบสิทธิ์ไม่สำเร็จ: '+ex.message,true);}if(!canCreate())return notify('ครบโควตาหรือหมดอายุแล้ว กรุณาติดต่อเจ้าของแพลตฟอร์ม',true);}state.items=[{name:'',qty:'1',unit:'',price:''}];state.draft={};state.page='create';return render();}if(action==='records'){if(!state.demo)await loadRecords();state.page='records';return render();}if(action==='settings'){state.page='settings';return render();}if(action==='storage'){state.page='storage';return render();}if(action==='remove-school-logo'){if(!isAdmin())return notify('ไม่มีสิทธิ์ลบโลโก้โรงเรียน',true);if(!confirm('ต้องการนำโลโก้โรงเรียนออกจากหน้าเว็บใช่หรือไม่?'))return;if(state.demo){state.demoLogoUrl='';state.flash='นำโลโก้ตัวอย่างออกแล้ว';return render();}const old=state.school.logo_path;if(!old)return;const {data,error}=await db.from('schools').update({logo_path:''}).eq('id',state.school.id).select('*').single();if(error)return notify(error.message,true);state.school=data;await db.storage.from('school-logos').remove([old]);state.flash='นำโลโก้โรงเรียนออกแล้ว';return render();}if(action==='dashboard'){state.page='dashboard';return render();}}
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
if(form.id==='school-form'){if(state.demo){state.school={...state.school,...f};return notify('ปรับข้อมูลตัวอย่างในหน้านี้แล้ว (ไม่บันทึกจริง)');}const {data,error}=await db.from('schools').update(f).eq('id',state.school.id).select('*').single();if(error)return notify(error.message,true);state.school=data;return notify('บันทึกข้อมูลโรงเรียนแล้ว');}
if(form.id==='member-form'){if(!isSchoolAdmin())return notify('เฉพาะแอดมินของโรงเรียนเท่านั้นที่เพิ่มเจ้าหน้าที่ได้',true);const {error}=await db.rpc('manage_school_membership',{p_school_id:state.school.id,p_member_email:f.email,p_role:f.role});if(error)return notify(error.message,true);await loadMembers();return notify('กำหนดสิทธิ์ให้เจ้าหน้าที่แล้ว');}
if(form.id==='renumber-form'){if(!isAdmin())return notify('ไม่มีสิทธิ์แก้เลข',true);const no=Number(f.number);if(state.demo){if(state.records.some(x=>x!==state.currentRecord&&x.kind===state.currentRecord.kind&&x.fiscal_year===state.currentRecord.fiscal_year&&x.document_number===no))return notify('เลขนี้มีอยู่แล้ว',true);state.currentRecord.document_number=no;state.flash='แก้เลขในโหมดตัวอย่างแล้ว';return render();}const {error}=await db.rpc('change_procurement_number',{p_record_id:state.currentRecord.id,p_new_number:no,p_reason:f.reason});if(error)return notify(error.message,true);await loadRecords();state.currentRecord=state.records.find(x=>x.id===state.currentRecord.id);state.flash='บันทึกการแก้ไขเลขเอกสารแล้ว';return render();}
if(form.id==='procurement-form'){if(!state.demo){await refreshSubscription();if(!canCreate())return notify('สิทธิ์สร้างเอกสารหมดอายุแล้ว กรุณาติดต่อเจ้าของแพลตฟอร์ม',true);}collectDraft();const d=state.draft;const items=state.items.map(x=>({name:String(x.name).trim(),qty:Number(x.qty),unit:String(x.unit).trim(),price_satang:Math.round(Number(x.price)*100)}));let total=items.reduce((n,x)=>n+x.qty*x.price_satang,0);if(!items.length||items.some(x=>!x.name||!x.qty||!x.unit||!x.price_satang))return notify('กรุณากรอกรายการ จำนวน หน่วย และราคาให้ครบ',true);if(total<=0||total>500000)return notify('วงเงินต้องมากกว่า 0 และไม่เกิน 5,000 บาท',true);if(!d.title||!d.budget_source)return notify('กรุณากรอกเรื่องและงบประมาณ',true);
let rec;
if(state.demo){const no=1+Math.max(0,...state.records.filter(r=>r.kind===d.kind).map(r=>r.document_number));rec={...d,id:'demo-'+Date.now(),document_number:no,items,total_satang:Math.round(total),state:'draft',signers:{officer:state.school.officer_name,head:state.school.head_name,director:state.school.director_name}};state.records.unshift(rec);}
else{const payload={p_school_id:state.school.id,p_kind:d.kind,p_fiscal_year:Number(d.fiscal_year),p_document_date:d.document_date,p_title:d.title,p_reason:d.reason||'',p_budget_source:d.budget_source,p_vendor_name:d.vendor_name||'',p_department:d.department||'',p_vendor_address:d.vendor_address||'',p_inspector_name:d.inspector_name||'',p_due_date:d.due_date||null,p_items:items};const result=await db.rpc('create_procurement',payload);if(result.error){await refreshSubscription().catch(()=>{});return notify('บันทึกไม่สำเร็จ: '+result.error.message,true);}await Promise.all([loadRecords(),refreshSubscription()]);rec=state.records.find(r=>r.id===result.data);if(!rec)return notify('บันทึกแล้ว แต่ยังโหลดข้อมูลไม่สำเร็จ กรุณาเปิดทะเบียน',true);}
state.currentRecord=rec;state.page='detail';state.flash='บันทึกสำเร็จ เลขเอกสาร '+rec.document_number+'/'+rec.fiscal_year;render();return;
}}
document.addEventListener('click',async ev=>{const el=ev.target.closest('[data-action]');if(!el)return;ev.preventDefault();try{await go(el.dataset.action,el);}catch(ex){notify(ex.message,true);}});
document.addEventListener('submit',async ev=>{if(!ev.target.id)return;ev.preventDefault();const b=ev.target.querySelector('[type=submit]');if(b)b.disabled=true;try{await handleForm(ev.target);}catch(ex){notify(ex.message,true);}finally{if(b)b.disabled=false;}});
document.addEventListener('input',ev=>{const el=ev.target;if(el.matches('[data-item]')){const x=state.items[Number(el.dataset.item)];if(x){x[el.dataset.key]=el.value;updateTotal();}}});
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
