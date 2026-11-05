/* Public school procurement marketing pages; no logged-in or private school data. */
import {buildDocuments} from './print.js';

export const publicPageIds=['home','features','examples','faq','contact'];
const safe=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const nav=[['home','หน้าแรก'],['features','ฟีเจอร์'],['examples','ตัวอย่างเอกสาร'],['faq','คำถามที่พบบ่อย'],['contact','ติดต่อเรา']];
const urlFor=page=>page==='home'?'/':'/?page='+encodeURIComponent(page);
const link=(page,label,cls='')=>'<a href="'+urlFor(page)+'" data-action="public-page" data-page="'+page+'" class="'+cls+'">'+label+'</a>';
const icon=(name)=>({
 check:'<path d="M5 12l4 4L19 6"/>',
 file:'<path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM14 3v6h5M9 13h6M9 17h6"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
 hash:'<path d="M10 2L6 22M18 2l-4 20M3 9h18M2 16h18"/>',
 shield:'<path d="M12 2l9 4v6c0 5-3.4 8.5-9 10-5.6-1.5-9-5-9-10V6zM8 12l3 3 5-5"/>',
 layers:'<path d="M12 2L2 8l10 6 10-6zM2 12l10 6 10-6M2 16l10 6 10-6"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
 users:'<circle cx="9" cy="8" r="4"/><path d="M1 21v-2a8 8 0 0 1 16 0v2M17 4a4 4 0 0 1 0 8M19 15a7 7 0 0 1 4 6"/>',
 cloud:'<path d="M20 17a5 5 0 0 0-5-5h-1a6 6 0 0 0-12 1 4 4 0 0 0 2 8h14a4 4 0 0 0 2-4z"/>',
 download:'<path d="M12 3v12M8 11l4 4 4-4M4 17v4h16v-4"/>',
 book:'<path d="M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 0-3 0zM4 4v17M8 8h8M8 12h7"/>',
 mail:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M3 7l9 7 9-7"/>',
 arrow:'<path d="M4 12h16m-7-7 7 7-7 7"/>',
 pdf:'<path d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM15 3v5h5M9 13h6M9 17h5"/>',
 help:'<circle cx="12" cy="12" r="10"/><path d="M9.3 9a3 3 0 0 1 5.4-1c2 2.5-2.7 3.2-2.7 5.5M12 17h.01"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12l2-2-2-4-3 1-2-3h-4L9 7 6 6l-2 4 2 2-2 2 2 4 3-1 1 3h4l2-3 3 1 2-4z"/>'
}[name]||'<circle cx="12" cy="12" r="8"/>');
const svg=name=>'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icon(name)+'</svg>';
const brand=()=>'<a class="kp-pub-brand" href="/" data-action="public-page" data-page="home"><img src="/kru-pasadu-icon.svg" alt="โลโก้ครูพัสดุ" width="48" height="48"><span><strong>ครูพัสดุ</strong><small>ทำเรื่องพัสดุให้เป็นเรื่องง่าย</small></span></a>';
const trial=(text='ทดลองใช้งานฟรี')=>'<button class="kp-pub-btn kp-pub-blue" type="button" data-action="demo">'+text+' '+svg('arrow')+'</button>';
const signup=()=>'<button type="button" class="kp-pub-btn kp-pub-orange" data-action="signup">สมัครใช้งาน '+svg('arrow')+'</button>';
const login=()=>'<button type="button" class="kp-pub-btn kp-pub-outline" data-action="login">เข้าสู่ระบบ</button>';
const badge=(iconName,text)=>'<span class="kp-pub-kicker">'+svg(iconName)+' '+text+'</span>';
const header=active=>'<header class="kp-pub-header"><div class="kp-pub-container kp-pub-nav">'+brand()+
 '<nav aria-label="เมนูหลัก" class="kp-pub-links">'+nav.map(([id,title])=>link(id,title,id===active?'is-active':'')).join('')+'</nav>'+
 '<div class="kp-pub-header-actions">'+login()+trial('ทดลองใช้ฟรี')+'</div></div></header>';
const footer=()=>'<footer class="kp-pub-footer"><div class="kp-pub-container kp-pub-footer-inner">'+brand()+
 '<nav aria-label="เมนูท้ายเว็บไซต์">'+nav.map(([id,title])=>link(id,title)).join('')+'</nav>'+
 '<small>© 2569 ครูพัสดุ · ระบบสนับสนุนงานพัสดุสำหรับสถานศึกษา</small></div></footer>';
const cta=()=>'<section class="kp-pub-cta kp-pub-container"><div class="kp-pub-cta-art" aria-hidden="true">'+svg('grid')+'<span>🏫</span></div>'+
 '<div><h2>ให้ครูพัสดุเป็นผู้ช่วยงานพัสดุของโรงเรียนคุณ</h2><p>ลดงานกรอกข้อมูลซ้ำ จัดเก็บเอกสารอย่างเป็นระบบ และตรวจทานก่อนพิมพ์ได้ในที่เดียว</p></div><div>'+trial('ทดลองใช้งาน')+'<small>ใช้งานผ่านเว็บ ไม่ต้องติดตั้งโปรแกรม</small></div></section>';

export const featureData=[
 ['file','กรอกข้อมูลครั้งเดียว','ข้อมูลรายการ ผู้ขายหรือผู้รับจ้าง และวงเงินเชื่อมถึงเอกสารหลายฉบับในชุดเดียว','blue'],
 ['hash','ออกเลขเอกสารอัตโนมัติ','เลขแต่ละประเภทจัดเก็บในทะเบียนคุมเลขของโรงเรียน พร้อมตรวจสอบประวัติ','orange'],
 ['pdf','เอกสารราชการ A4','จัดทำแบบฟอร์มจัดซื้อ จัดจ้าง ตรวจรับ และเบิกจ่ายจากข้อมูลที่บันทึกไว้','green'],
 ['download','พิมพ์และบันทึก PDF','ตรวจดูตัวอย่าง แล้วสั่งพิมพ์หรือเลือกบันทึกเป็น PDF ผ่านเบราว์เซอร์','rose'],
 ['layers','จัดซื้อและจัดจ้างในระบบเดียว','เชื่อมขั้นตอนงานพัสดุตั้งแต่สร้างรายการจนถึงเอกสารประกอบการเบิกจ่าย','purple'],
 ['grid','ทะเบียนคุมเลขเอกสาร','แอดมินตั้งเลขถัดไป ตรวจสอบเลขที่จอง ใช้แล้ว หรือยกเลิกได้','blue'],
 ['search','ค้นหารายการย้อนหลัง','ค้นหาจากชื่อเรื่อง ร้านค้า หรือเลขรายการ โดยไม่ต้องเปิดแฟ้มทีละเล่ม','rose'],
 ['settings','ปรับแม่แบบเอกสารรายโรงเรียน','ผู้ดูแลโรงเรียนปรับข้อความและการจัดวางในแม่แบบที่ระบบรองรับได้','purple'],
 ['users','กำหนดสิทธิ์ผู้ใช้งาน','แยกบทบาทผู้ดูแล เจ้าหน้าที่ หัวหน้า และผู้เกี่ยวข้องเป็นรายโรงเรียน','orange'],
 ['cloud','ใช้งานผ่านเว็บ','เปิดผ่านเบราว์เซอร์ได้โดยไม่ต้องติดตั้งโปรแกรมในเครื่อง','green']
];
const steps=[['1','สร้างรายการ','เลือกจัดซื้อหรือจัดจ้าง แล้วระบุเรื่องและเหตุผล'],
 ['2','กรอกข้อมูล','เพิ่มรายการ จำนวน ราคาต่อหน่วย และข้อมูลที่จำเป็น'],
 ['3','ตรวจเอกสาร','ระบบนำข้อมูลไปจัดทำชุดเอกสารตามประเภท'],
 ['4','พิมพ์หรือบันทึก PDF','ตรวจทานข้อมูลและรูปแบบก่อนนำไปใช้ราชการ']];
const docTypes=[
 ['รายงานขอซื้อ / ขอจ้าง','บันทึกขอความเห็นชอบการดำเนินการจัดซื้อหรือจัดจ้าง','จัดซื้อ / จัดจ้าง'],
 ['รายละเอียดพัสดุ / งานจ้างแนบท้าย','รายการพัสดุหรือรายละเอียดงานจ้างประกอบรายงาน','รายการ'],
 ['รายงานผลการพิจารณา','สรุปผลการพิจารณาและขออนุมัติสั่งซื้อหรือสั่งจ้าง','รายงาน'],
 ['ใบตรวจรับพัสดุ / งานจ้าง','เอกสารการตรวจรับและข้อมูลการส่งมอบตามหลักฐานจริง','ตรวจรับ'],
 ['ทราบผลและขออนุมัติเบิกจ่าย','บันทึกประกอบขั้นตอนเสนออนุมัติการเบิกจ่าย','เบิกจ่าย'],
 ['ใบเบิกพัสดุ','บันทึกรายการเบิกจ่ายวัสดุสำหรับการจัดซื้อ','จัดซื้อ']
];
const faq=[
 ['ครูพัสดุช่วยลดภาระงานครูอย่างไร?','กรอกข้อมูลรายการจัดซื้อหรือจัดจ้างเพียงครั้งเดียว แล้วระบบนำข้อมูลที่บันทึกไปเติมในเอกสารหลายฉบับ ลดการพิมพ์ซ้ำและช่วยค้นหาประวัติได้สะดวกขึ้น ทั้งนี้เจ้าหน้าที่ยังต้องตรวจสอบข้อมูลและเอกสารก่อนใช้งานจริง'],
 ['ระบบรองรับเอกสารประเภทใดบ้าง?','ระบบจัดทำรายงานขอซื้อหรือขอจ้าง รายละเอียดพัสดุหรือรายละเอียดงานจ้างแนบท้าย รายงานผลการพิจารณา ใบตรวจรับ และบันทึกขออนุมัติเบิกจ่าย โดยงานจัดซื้อมีใบเบิกพัสดุเพิ่มเติม'],
 ['กรอกข้อมูลครั้งเดียวแล้วสร้างเอกสารหลายฉบับได้จริงหรือไม่?','ได้ ข้อมูลหลัก เช่น ชื่อเรื่อง รายการ ราคา ผู้ขายหรือผู้รับจ้าง ถูกนำไปใช้ในเอกสารชุดเดียวกัน ส่วนเลขใบสั่ง วันส่งมอบจริง และวันตรวจรับต้องกรอกตามหลักฐานเมื่อมีเหตุการณ์เกิดขึ้น'],
 ['ระบบออกเลขเอกสารอัตโนมัติอย่างไร?','ระบบมีทะเบียนคุมเลขแยกตามประเภททะเบียน โรงเรียน และปี พ.ศ. แอดมินโรงเรียนสามารถกำหนดเลขถัดไปได้ตามสิทธิ์ และระบบไม่ควรนำเลขที่เคยใช้หรือยกเลิกกลับมาใช้ใหม่'],
 ['สามารถพิมพ์หรือบันทึกเป็น PDF ได้หรือไม่?','ได้ สามารถดูตัวอย่าง A4 ก่อนพิมพ์ และเลือกบันทึกเป็น PDF ผ่านหน้าต่างพิมพ์ของเบราว์เซอร์ ตรวจขนาดกระดาษและรูปแบบทุกครั้งก่อนนำเอกสารไปใช้'],
 ['โรงเรียนปรับแม่แบบเอกสารเองได้หรือไม่?','แอดมินโรงเรียนสามารถแก้ข้อความและบางส่วนของรูปแบบผ่านเครื่องมือแม่แบบ โดยข้อมูลระบบ เช่น ชื่อบุคคลและเลขเอกสารที่ต้องคำนวณจะถูกป้องกันเพื่อไม่ให้ข้อมูลผิดพลาด'],
 ['จัดซื้อกับจัดจ้างใช้ข้อมูลหรือเลขปะปนกันหรือไม่?','ระบบแยกประเภทของรายการและเลือกเอกสารให้ตรงงาน ส่วนทะเบียนหนังสือบางชุดใช้เลขร่วมกันตามกติกาที่กำหนด เช่น ทะเบียนรายงานขอซื้อและขอจ้าง เจ้าหน้าที่ควรตรวจสอบทะเบียนที่โรงเรียนเลือกใช้อีกครั้ง'],
 ['มีการกำหนดสิทธิ์ผู้ใช้งานหรือไม่?','มีการแยกสิทธิ์ตามบทบาทและโรงเรียน เช่น แอดมินโรงเรียน เจ้าหน้าที่พัสดุ และหัวหน้าเจ้าหน้าที่พัสดุ การดำเนินการสำคัญถูกจำกัดตามสิทธิ์'],
 ['ต้องติดตั้งโปรแกรมหรือไม่?','ไม่ต้องติดตั้งโปรแกรมเฉพาะ สามารถเปิดระบบผ่านเว็บเบราว์เซอร์ที่รองรับและเชื่อมต่ออินเทอร์เน็ตได้'],
 ['ใช้งานฟรีได้ตลอดไปหรือไม่?','ระบบมีช่วงทดลองใช้งานตามเงื่อนไขที่แสดงในบัญชีโรงเรียน โปรดตรวจสอบจำนวนรายการและวันสิ้นสุดช่วงทดลองในหน้าใช้งาน ไม่ควรถือว่ามีสิทธิ์ใช้งานฟรีโดยไม่จำกัด'],
 ['เอกสารที่สร้างถือว่าอนุมัติหรือมีลายเซ็นจริงแล้วหรือไม่?','ไม่ใช่ ชื่อผู้ลงนามที่แสดงเป็นข้อมูลประกอบแบบฟอร์ม ไม่ได้แทนการตรวจรับ การอนุมัติ หรือการลงนามจริง เจ้าหน้าที่ต้องดำเนินการตามระเบียบและอำนาจอนุมัติที่เกี่ยวข้อง']
];

const laptop=()=>'<div class="kp-pub-visual"><div class="kp-pub-glow"></div><div class="kp-pub-laptop"><div class="kp-pub-laptop-top"><span></span><span></span><span></span><strong>ครูพัสดุ · ภาพตัวอย่างระบบ</strong></div>'+
 '<div class="kp-pub-laptop-inner"><div class="kp-pub-laptop-aside"><div>▦ &nbsp; ภาพรวม</div><div>▤ &nbsp; ทะเบียนรายการ</div><div>▤ &nbsp; ทะเบียนคุมเลข</div><div>▧ &nbsp; แม่แบบเอกสาร</div></div>'+
 '<div class="kp-pub-laptop-main"><div class="kp-pub-laptop-heading"><strong>ภาพรวมงานพัสดุ</strong><span>ข้อมูลสมมติเพื่อการสาธิต</span></div><div class="kp-pub-laptop-stats"><div><small>รายการทั้งหมด</small><strong>24</strong></div><div><small>จัดซื้อ</small><strong>16</strong></div><div><small>จัดจ้าง</small><strong>8</strong></div></div>'+
 '<div class="kp-pub-laptop-table"><b>รายการล่าสุด</b><div><span>ซื้อวัสดุสำนักงาน</span><i>จัดซื้อ</i></div><div><span>จ้างทำป้ายประชาสัมพันธ์</span><i>จัดจ้าง</i></div><div><span>ซื้ออุปกรณ์การเรียน</span><i>จัดซื้อ</i></div></div></div></div></div>'+
 '<div class="kp-pub-floating-paper"><div class="kp-pub-garuda">✦</div><strong>บันทึกข้อความ</strong><span>ส่วนราชการ โรงเรียนตัวอย่าง</span><span>ที่ พว. ... / ....</span><hr><i></i><i></i><i></i><i></i><i></i><small>ตัวอย่างเอกสาร A4</small></div><div class="kp-pub-float-badge">'+svg('pdf')+' สร้างเอกสาร A4<br>พร้อมพิมพ์ / PDF</div></div>';
const card=([sym,title,desc,color])=>'<article class="kp-pub-feature-card"><div class="kp-pub-feature-icon '+color+'">'+svg(sym)+'</div><h3>'+title+'</h3><p>'+desc+'</p></article>';
const highlights=()=>'<div class="kp-pub-highlights"><span>'+svg('check')+' กรอกข้อมูลครั้งเดียว</span><span>'+svg('check')+' ออกเลขตามทะเบียน</span><span>'+svg('check')+' ดูตัวอย่างก่อนพิมพ์</span></div>';
const home=()=>'<section class="kp-pub-hero kp-pub-container"><div class="kp-pub-hero-copy">'+badge('book','ระบบงานพัสดุสำหรับสถานศึกษา')+
 '<h1>งานพัสดุโรงเรียน<br><span>ง่ายขึ้น <em>ลดขั้นตอน</em></span><br>ลดภาระงานครู</h1>'+
 '<p>กรอกข้อมูลครั้งเดียว แล้วนำไปจัดทำเอกสารจัดซื้อ จัดจ้าง ตรวจรับ และเบิกจ่ายได้ต่อเนื่อง พร้อมทะเบียนคุมเลขเอกสารและตัวอย่าง A4 ก่อนพิมพ์</p>'+
 highlights()+'<div class="kp-pub-hero-buttons">'+trial()+login()+signup()+'</div><div class="kp-pub-hero-note">'+svg('cloud')+' ใช้งานผ่านเว็บได้ ไม่ต้องติดตั้งโปรแกรม</div></div>'+laptop()+'</section>'+
 '<section class="kp-pub-container kp-pub-section" id="features"><div class="kp-pub-section-head"><div><h2>ทำไมต้องใช้ <span>ครูพัสดุ?</span></h2><p>ให้ระบบช่วยจัดการงานซ้ำ เพื่อให้ครูและเจ้าหน้าที่มีเวลากับงานสำคัญมากขึ้น</p></div>'+link('features','ดูฟีเจอร์ทั้งหมด →','kp-pub-text-link')+'</div>'+
 '<div class="kp-pub-feature-grid kp-pub-home-grid">'+featureData.slice(0,7).map(card).join('')+'</div></section>'+
 '<section class="kp-pub-container kp-pub-section"><div class="kp-pub-section-head"><div><h2>ทำงานได้ใน 4 ขั้นตอน</h2><p>จากข้อมูลรายการเดียวไปสู่เอกสารหลายฉบับอย่างเป็นระบบ</p></div></div>'+
 '<div class="kp-pub-steps">'+steps.map(([n,title,desc])=>'<article><span>'+n+'</span><h3>'+title+'</h3><p>'+desc+'</p></article>').join('')+'</div></section>'+
 '<section class="kp-pub-container kp-pub-value"><div><h2>ลดงานซ้ำ <em>ไม่ลดความรอบคอบ</em></h2><p>ข้อมูลจากรายการเดียวถูกนำไปเติมในเอกสารหลายฉบับ และยังมีขั้นตอนตรวจทานข้อมูลกับระเบียบก่อนนำไปใช้จริง</p></div><div class="kp-pub-value-items"><span>'+svg('file')+' เอกสารหลายฉบับ</span><span>'+svg('hash')+' ทะเบียนคุมเลข</span><span>'+svg('search')+' ค้นหาย้อนหลัง</span></div></section>'+
 cta();
const features=()=>'<section class="kp-pub-subhero kp-pub-container"><div>'+badge('layers','ครบเครื่องมือสำหรับงานพัสดุ')+
 '<h1>ฟีเจอร์ที่ช่วย<br><em>ลดงานซ้ำของครู</em></h1><p>ออกแบบสำหรับขั้นตอนจัดซื้อ จัดจ้าง ตรวจรับ และเบิกจ่ายในโรงเรียน พร้อมจัดทำเอกสารจากข้อมูลรายการเดียวอย่างต่อเนื่อง</p>'+highlights()+'</div>'+laptop()+'</section>'+
 '<section class="kp-pub-container kp-pub-section"><div class="kp-pub-section-head"><div><h2>ฟีเจอร์หลักของระบบ</h2><p>เครื่องมือที่รองรับการทำงานร่วมกันของเจ้าหน้าที่ในโรงเรียน</p></div></div><div class="kp-pub-feature-grid">'+featureData.map(card).join('')+'</div></section>'+
 '<section class="kp-pub-container kp-pub-section"><div class="kp-pub-section-head"><div><h2>ครบตั้งแต่เริ่มรายการจนถึงจัดเก็บ</h2></div></div>'+
 '<div class="kp-pub-workflow"><article><strong>01 · ก่อนจัดทำเอกสาร</strong><p>ตั้งค่าโรงเรียนและผู้ใช้งาน เลือกประเภทงาน บันทึกรายการ และกำหนดทะเบียนเลขที่เกี่ยวข้อง</p></article>'+
 '<article><strong>02 · ระหว่างดำเนินงาน</strong><p>จัดทำเอกสารตามขั้นตอน ตรวจรับและเพิ่มข้อมูลตามหลักฐานเมื่อมีเหตุการณ์จริง</p></article>'+
 '<article><strong>03 · หลังจัดทำเอกสาร</strong><p>ตรวจตัวอย่าง A4 พิมพ์หรือบันทึก PDF และค้นหาประวัติรายการหรือเลขทะเบียนย้อนหลัง</p></article></div></section>'+cta();
const paperThumb=(idx)=>'<div class="kp-pub-paper-thumb" aria-hidden="true"><span>✦</span><b>'+safe(docTypes[idx][0])+'</b><i></i><i></i><i></i><i></i><i></i><i></i></div>';
const examples=()=>'<section class="kp-pub-examples-hero kp-pub-container"><div>'+badge('file','เอกสาร A4 ที่สร้างจากระบบจริง')+'<h1>ตัวอย่างเอกสารราชการ<br><em>ที่ระบบสร้างได้</em></h1><p>เลือกชมเอกสารตัวอย่างที่สร้างจากข้อมูลสมมติผ่านตัวสร้างเอกสารของครูพัสดุ เพื่อเข้าใจรูปแบบก่อนเริ่มใช้งานจริง</p>'+highlights()+'</div><div class="kp-pub-doc-stack">'+paperThumb(0)+paperThumb(1)+paperThumb(3)+'</div></section>'+
 '<section class="kp-pub-container kp-pub-section"><div class="kp-pub-section-head"><div><h2>ประเภทเอกสารตัวอย่าง</h2><p>เลือกเอกสารเพื่อดูหน้า A4 จริงของระบบด้านล่าง</p></div></div>'+
 '<label class="kp-pub-search">'+svg('search')+'<input id="kp-public-search" type="search" placeholder="ค้นหาชื่อเอกสาร เช่น รายงานขอซื้อ ใบตรวจรับ" aria-label="ค้นหาประเภทเอกสาร"></label>'+
 '<div class="kp-pub-doc-grid">'+docTypes.map((x,i)=>'<article class="kp-pub-doc-card" data-public-doc-card="'+i+'">'+paperThumb(i)+
 '<div class="kp-pub-doc-card-body"><span class="kp-pub-a4">A4 · '+safe(x[2])+'</span><h3>'+safe(x[0])+'</h3><p>'+safe(x[1])+'</p>'+
 '<button type="button" data-action="public-document" data-index="'+i+'">'+svg('file')+' ดูตัวอย่าง →</button></div></article>').join('')+'</div>'+
 '<div class="kp-pub-doc-preview" id="kp-public-document-preview"><div class="kp-pub-doc-preview-head"><div><h2>ตัวอย่างเอกสารแบบขยาย</h2><p>ข้อมูลและชื่อบุคคลในตัวอย่างเป็นข้อมูลสมมติ ไม่ใช่ข้อมูลของโรงเรียนผู้ใช้งาน</p></div><span>ตัวอย่าง A4</span></div>'+
 '<div class="kp-pub-doc-preview-main"><div class="kp-pub-doc-selector">'+docTypes.map((x,i)=>'<button type="button" data-action="public-document" data-index="'+i+'" class="'+(i===0?'is-selected':'')+'">'+svg('file')+' '+safe(x[0])+'</button>').join('')+'</div>'+
 '<div class="kp-pub-doc-frame"><iframe id="kp-public-doc-frame" title="ตัวอย่างเอกสารราชการ A4" loading="lazy" sandbox=""></iframe></div>'+
 '<aside class="kp-pub-doc-info"><div class="kp-pub-feature-icon blue">'+svg('file')+'</div><h3 id="kp-public-doc-name">'+safe(docTypes[0][0])+'</h3><p id="kp-public-doc-description">'+safe(docTypes[0][1])+'</p>'+
 '<div class="kp-pub-doc-notice">ตัวอย่างเพื่อศึกษารูปแบบเท่านั้น ข้อมูลและตำแหน่งผู้ลงนามต้องตรวจสอบก่อนใช้งานราชการจริง</div>'+trial('ลองสร้างเอกสาร')+'</aside></div></div></section>'+cta();
const coming=(type)=>{const guide=type==='guide',heading=guide?'คู่มือการใช้งาน':'ติดต่อเรา',description=guide?
 'เรากำลังจัดทำคู่มือแบบละเอียดพร้อมภาพประกอบ เพื่อให้โรงเรียนเริ่มใช้งานทุกขั้นตอนได้ง่ายขึ้น':
 'เรากำลังเตรียมช่องทางติดต่อและข้อมูลสนับสนุนเพิ่มเติม เพื่อให้ครูและสถานศึกษาติดต่อทีมงานได้สะดวกยิ่งขึ้น';
const entries=guide?[['book','เริ่มต้นใช้งาน','การเข้าสู่ระบบและตั้งค่าข้อมูลโรงเรียน'],['file','สร้างรายการจัดซื้อจัดจ้าง','ขั้นตอนกรอกข้อมูลและจัดทำชุดเอกสาร'],['pdf','พิมพ์และบันทึก PDF','ตรวจสอบตัวอย่างและตั้งค่าการพิมพ์']]:
 [['mail','อีเมล','ข้อมูลอีเมลติดต่อจะประกาศในหน้านี้'],['users','LINE / แชต','กำลังเตรียมช่องทางพูดคุยกับทีมงาน'],['clock','เวลาทำการ','วันและเวลาให้บริการจะประกาศภายหลัง']];
return '<section class="kp-pub-coming kp-pub-container"><div>'+badge(guide?'book':'mail',guide?'คู่มือฉบับเต็มอยู่ระหว่างจัดทำ':'ช่องทางติดต่ออยู่ระหว่างจัดเตรียม')+
 '<h1>'+heading+'<br><em>กำลังอัปเดต</em></h1><p>'+description+'</p><div class="kp-pub-hero-buttons">'+trial()+link('home','กลับหน้าแรก','kp-pub-btn kp-pub-outline')+'</div></div>'+
 '<div class="kp-pub-coming-graphic"><div class="kp-pub-coming-window"><div class="kp-pub-coming-window-head">● ● ●</div><div class="kp-pub-coming-icon">'+svg(guide?'book':'mail')+'</div>'+
 '<div class="kp-pub-coming-progress"><span></span></div><strong>กำลังจัดทำ</strong><p>จะอัปเดตข้อมูลในหน้านี้</p></div></div></section>'+
 '<section class="kp-pub-container kp-pub-section"><div class="kp-pub-section-head"><div><h2>'+(guide?'หัวข้อที่กำลังจัดทำ':'ช่องทางที่กำลังเตรียม')+'</h2><p>ขอบคุณที่ให้ความสนใจ ครูพัสดุ</p></div></div><div class="kp-pub-coming-cards">'+entries.map(([ic,t,d])=>'<article><div class="kp-pub-feature-icon blue">'+svg(ic)+'</div><span>รออัปเดต</span><h3>'+t+'</h3><p>'+d+'</p></article>').join('')+'</div></section>'+cta();
};
const faqPage=()=>'<section class="kp-pub-subhero kp-pub-container"><div>'+badge('help','คำถามสำคัญเกี่ยวกับครูพัสดุ')+
 '<h1>คำถามที่<em>พบบ่อย</em></h1><p>รวมคำตอบเกี่ยวกับเอกสาร เลขทะเบียน การใช้ระบบ และสิทธิ์ผู้ใช้งาน ช่วยให้เริ่มต้นได้อย่างมั่นใจ</p>'+highlights()+'</div>'+
 '<div class="kp-pub-faq-art"><div class="kp-pub-faq-orb">?</div><div class="kp-pub-faq-note">'+svg('shield')+' ตรวจสอบก่อนพิมพ์</div><div class="kp-pub-faq-note">'+svg('file')+' เอกสาร A4</div></div></section>'+
 '<section class="kp-pub-container kp-pub-section"><div class="kp-pub-section-head"><div><h2>คำถามยอดนิยม</h2><p>คลิกหัวข้อเพื่อเปิดอ่านคำตอบ หรือค้นหาคำถามที่สงสัย</p></div></div>'+
 '<label class="kp-pub-search">'+svg('search')+'<input id="kp-public-search" type="search" placeholder="ค้นหาคำถาม เช่น PDF เลขเอกสาร แม่แบบ" aria-label="ค้นหาคำถามที่พบบ่อย"></label>'+
 '<div class="kp-pub-faq-grid">'+faq.map(([q,a],i)=>'<details class="kp-pub-faq-item" data-public-faq-item="'+i+'" '+(i<2?'open':'')+'><summary><span class="kp-pub-faq-number">'+String(i+1).padStart(2,'0')+'</span><strong>'+safe(q)+'</strong><span class="kp-pub-faq-chevron">⌄</span></summary><p>'+safe(a)+'</p></details>').join('')+'</div><p class="kp-pub-faq-note-bottom">การใช้งานเอกสารราชการขึ้นอยู่กับข้อมูล หลักฐาน ระเบียบ และการตรวจสอบของเจ้าหน้าที่แต่ละโรงเรียน</p></section>'+cta();

export function publicPageHtml(page='home'){
 const id=publicPageIds.includes(page)?page:'home';
 const content={home,features,examples,faq:faqPage,contact:()=>coming('contact')}[id]();
 return '<div class="kp-public">'+header(id)+'<main id="main-content">'+content+'</main>'+footer()+'</div>';
}

const exampleSchool={name:'โรงเรียนตัวอย่างวิทยาลัย',district:'เมือง',province:'เชียงใหม่',memo_prefix:'พว.',
 officer_name:'นายเจ้าหน้าที่ ตัวอย่าง',head_name:'นางสาวหัวหน้า ตัวอย่าง',director_name:'ผู้อำนวยการ ตัวอย่าง',finance_name:'นางสาวการเงิน ตัวอย่าง'};
const exampleRecord={
 kind:'purchase',title:'จัดซื้อวัสดุสำนักงาน',reason:'เพื่อใช้ในกิจกรรมการเรียนการสอนและการบริหารของโรงเรียน',
 department:'กลุ่มบริหารทั่วไป',budget_source:'งบดำเนินงาน',method:'วิธีเฉพาะเจาะจง',
 document_number:1,fiscal_year:2570,document_date:'2026-10-20',
 vendor_name:'ร้านค้าตัวอย่าง',due_date:'2026-10-28',inspector_name:'นางสาวผู้ตรวจรับ ตัวอย่าง',
 items:[{name:'กระดาษถ่ายเอกสาร A4',qty:5,unit:'รีม',price_satang:12000},
        {name:'หมึกเครื่องพิมพ์',qty:2,unit:'กล่อง',price_satang:75000}],total_satang:210000,
 signers:{officer:exampleSchool.officer_name,head:exampleSchool.head_name,director:exampleSchool.director_name},
 document_meta:{memo_number:'1/2570',approval_memo_number:'2/2570',payment_memo_number:'3/2570',
  order_number:'ตย. 1/2570',order_date:'2026-10-21',
  delivery_date:'2026-10-27',invoice_number:'INV-DEMO-01',invoice_date:'2026-10-27',
  inspection_date:'2026-10-28',acceptance_number:'1/2570',requisition_number:'1/2570'}
};
export function sampleDocumentHtml(index){
 const n=Number(index);
 if(!Number.isInteger(n)||n<0||n>=docTypes.length)throw new RangeError('Unknown public document');
 // Uses the same real print renderer as the logged-in app, never real school records.
 const container=document.createElement('template');
 container.innerHTML=buildDocuments(exampleRecord,exampleSchool);
 const pages=container.content.querySelectorAll('section.paper-page');
 const page=pages[n];
 if(!page)throw Error('Document preview not available');
 return page.outerHTML;
}
export function mountPublicDocument(index=0){
 const frame=document.getElementById('kp-public-doc-frame');
 if(!frame)return false;
 const n=Number(index);
 if(!Number.isInteger(n)||n<0||n>=docTypes.length)return false;
 const html=sampleDocumentHtml(n);
 const styles=['style.css','print-fix.css','official-print.css','print-responsive.css','print-readable.css',
  'print-pagination.css','print-adaptive.css','print-signatures-responsive.css','government-forms.css']
  .map(f=>'<link rel="stylesheet" href="/'+f+'">').join('');
 frame.srcdoc='<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap" rel="stylesheet">'+styles+
  '<style>html,body{margin:0;background:#eaf2fe!important;overflow:auto!important;font-family:Sarabun,Tahoma,sans-serif}.paper-page{margin:12px auto!important;box-shadow:0 8px 22px rgba(18,50,100,.13)!important;max-width:100%!important}#preview-label{font:600 12px Sarabun,sans-serif;text-align:center;color:#587398;padding:10px}</style></head><body>'+
  '<div id="preview-label">ข้อมูลสมมติสำหรับแสดงตัวอย่าง · ไม่ใช่เอกสารที่ออกให้โรงเรียนจริง</div>'+html+'</body></html>';
 document.querySelectorAll('[data-action="public-document"]').forEach(el=>{
  const selected=Number(el.dataset.index)===n;
  el.classList.toggle('is-selected',selected);
  if(el.tagName==='BUTTON')el.setAttribute('aria-pressed',String(selected));
 });
 const title=document.getElementById('kp-public-doc-name');
 const desc=document.getElementById('kp-public-doc-description');
 if(title)title.textContent=docTypes[n][0];
 if(desc)desc.textContent=docTypes[n][1];
 return true;
}
export function filterPublicContent(value){
 const needle=String(value||'').toLocaleLowerCase('th').trim();
 for(const el of document.querySelectorAll('[data-public-doc-card],[data-public-faq-item],[data-guide-chapter]')){
  el.hidden=!!needle&&!el.textContent.toLocaleLowerCase('th').includes(needle);
 }
 const chapters=[...document.querySelectorAll('[data-guide-chapter]')];
 const count=chapters.filter(el=>!el.hidden).length;
 const message=document.getElementById('kp-guide-search-result');
 if(message)message.textContent=needle?'พบ '+count+' จาก '+chapters.length+' บทเรียน':'แสดง '+chapters.length+' บทเรียน';
 const noResults=document.getElementById('kp-guide-no-results');
 if(noResults)noResults.hidden=count>0||!needle;
}
