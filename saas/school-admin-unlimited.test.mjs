import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/school-staff/index.ts',import.meta.url),'utf8');

test('school admin creation has no count cap and creates an active membership',()=>{
 assert.match(edge,/const roles = new Set\(\[\s*"school_admin"/);
 assert.match(edge,/memberships"\)\.insert\(\{\s*school_id: schoolId, user_id: uid, role, active: true/);
 assert.match(edge,/role === "school_admin" \? "สร้างบัญชีและแต่งตั้งแอดมินโรงเรียนเรียบร้อยแล้ว"/);
 assert.doesNotMatch(edge,/max(?:imum)?_?admins|admin_?limit|count\s*>=\s*[2-9]/i);
});
test('existing officers may be promoted by their own school admin',()=>{
 assert.match(edge,/membership\?\.role !== "school_admin"/);
 assert.match(edge,/\.update\(\{role\}\)\s*\.eq\("school_id",schoolId\)\.eq\("user_id",targetId\)/);
 assert.match(edge,/role === "school_admin" && target\.role !== "school_admin"/);
 assert.match(app,/staffRequest\('edit',\{user_id:f\.user_id,full_name:f\.full_name,email:f\.email,role:f\.role\}\)/);
});
test('unlimited admin UI offers direct creation with the admin role preselected',()=>{
 assert.match(app,/btn\('\+ เพิ่มแอดมินโรงเรียน','add-school-admin','secondary'\)/);
 assert.match(app,/if\(action==='add-school-admin'\)/);
 assert.match(app,/state\.memberCreateRole='school_admin'/);
 assert.match(app,/staffRoleOptions\(state\.memberCreateRole\)/);
 assert.match(app,/แอดมินโรงเรียน \(ไม่จำกัดจำนวน\)/);
});
test('tenant authorization, audit, and last-active-admin protection remain enforced',()=>{
 assert.match(edge,/admin\.auth\.getUser\(token\)/);
 assert.match(edge,/\.eq\("school_id", schoolId\)\.eq\("user_id", actor\.id\)/);
 assert.match(edge,/return \(count \?\? 0\) <= 1/);
 assert.match(edge,/ต้องเหลือแอดมินที่ใช้งานได้อย่างน้อย 1 คน/);
 assert.match(edge,/if \(globalAdmin\) throw new HttpError\(403/);
 assert.match(edge,/await audit\("school_staff_updated"/);
});

test('successful staff edits serialize the defined nameChanged audit value, never an undefined name_changed',()=>{
 const edit=edge.slice(edge.indexOf('// action === edit'));
 assert.match(edit,/const nameChanged = fullName\(currentProfile\?\.full_name\) !== name;/);
 assert.match(edit,/await audit\("school_staff_updated",targetId,\{role,email,name_changed:nameChanged\}\);/);
 assert.doesNotMatch(edit,/await audit\("school_staff_updated",targetId,\{role,email,name_changed\}\)/);
 assert.match(edit,/return json\(200,\{success:true,message:/);
});
