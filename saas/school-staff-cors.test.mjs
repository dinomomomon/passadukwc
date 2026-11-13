import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../supabase/functions/school-staff/index.ts',import.meta.url),'utf8');
const match=source.match(/const allowedOrigins = new Set\(\[([\s\S]*?)\]\);/);
assert.ok(match,'edge function retains an explicit Origin allowlist');
const quoted=[...match[1].matchAll(/"(https:\/\/[^"]+)"/g)].map(x=>x[1]);
const origins=new Set(quoted);

test('staff management allows both official school domains with exact match, not wildcards',()=>{
 assert.ok(origins.has('https://xn--42c6a3at0b3bzcd.com'));
 assert.ok(origins.has('https://www.xn--42c6a3at0b3bzcd.com'));
 assert.ok(origins.has('https://kru-pasadu.vercel.app'));
 assert.ok(![...origins].some(o=>o.includes('*')));
 assert.equal(origins.size,quoted.length,'prevent duplicate allowed origins');
});

test('only exact HTTPS official origins pass; phishing lookalikes are rejected',()=>{
 for(const forbidden of [
  'http://xn--42c6a3at0b3bzcd.com',
  'https://xn--42c6a3at0b3bzcd.com.evil.example',
  'https://evil.example',
  'https://preview-branch.vercel.app',
  'null',
  ''
 ]) assert.equal(origins.has(forbidden),false,forbidden);
});

test('OPTIONS preflight returns CORS for allowed origins; POST retains verified user and tenant role',()=>{
 assert.match(source,/headers\["Access-Control-Allow-Origin"\] = origin/);
 assert.match(source,/Access-Control-Allow-Headers"\] = "authorization, x-client-info, apikey, content-type"/);
 assert.match(source,/request\.method === "OPTIONS".*allowedOrigins\.has\(origin\) \? 204 : 403/);
 assert.match(source,/origin && !allowedOrigins\.has\(origin\)/);
 assert.match(source,/admin\.auth\.getUser\(token\)/);
 assert.match(source,/membership\?\.role !== "school_admin"/);
 assert.match(source,/\.eq\("school_id", schoolId\)\.eq\("user_id", targetId\)/);
 assert.match(source,/role !== "school_admin" && await lastAdmin\(\)/);
});

test('site provides a clear pathway for assigning an additional school admin',()=>{
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 assert.match(app,/สามารถแต่งตั้งแอดมินโรงเรียนได้ไม่จำกัดจำนวน/);
 assert.match(app,/staffRoleOptions\(editing\.member_role\)/);
 assert.match(app,/staffRequest\('edit',\{user_id:f\.user_id,full_name:f\.full_name,email:f\.email,role:f\.role\}\)/);
});
