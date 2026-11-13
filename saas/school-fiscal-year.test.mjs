import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/migrations/20261113103000_school_fiscal_year_single_source.sql',import.meta.url),'utf8');
test('admin alone chooses one school-wide year, with changes audited',()=>{
 assert.match(sql,/ADD COLUMN IF NOT EXISTS numbering_fiscal_year integer/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.set_school_numbering_fiscal_year/);
 assert.match(sql,/not public\.is_school_admin\(p_school_id\)/);
 assert.match(sql,/SET numbering_fiscal_year=p_year/);
 assert.match(sql,/existing_issued_numbers_unchanged/);
});
test('server allocation takes the school year, and never derives a serial suffix from actual dates',()=>{
 assert.match(sql,/select numbering_fiscal_year into v_fiscal_year/);
 assert.match(sql,/from public\.schools where id=p_school_id for share/);
 assert.match(sql,/values\(p_school_id,p_kind,v_fiscal_year,1\)/);
 assert.match(sql,/p_kind,v_fiscal_year,next_no/);
 assert.match(sql,/v_year := rec\.fiscal_year/);
 assert.doesNotMatch(sql,/v_year:=EXTRACT\(YEAR FROM rec\.document_date\)/);
 assert.match(sql,/WHERE procurement_id=rec\.id AND document_field=p_field AND status IN\('reserved','used'\)/);
});
test('the form, receipt preview, school settings and registry all use fiscal year',()=>{
 assert.match(app,/const schoolFiscalYear=/);
 assert.match(app,/schoolFiscalYearSettingsMarkup\(\)/);
 assert.match(app,/form\.id==='school-fiscal-year-form'/);
 assert.match(app,/db\.rpc\('set_school_numbering_fiscal_year'/);
 assert.match(app,/input\('ปีงบประมาณ \(ตั้งค่ากลางของโรงเรียน\)','fiscal_year'/);
 assert.match(app,/required readonly min="2500"/);
 assert.match(app,/acceptance_number:'ร\. '\+r\.document_number\+'\/'\+r\.fiscal_year/);
 assert.match(app,/const setupYear=Number\(state\.numberSetupYear\)\|\|schoolFiscalYear\(\)/);
 assert.match(app,/state\.draft=\{fiscal_year:schoolFiscalYear\(\)\}/);
});
test('no migration rewrites existing registers or saved procurement numbers',()=>{
 assert.doesNotMatch(sql,/UPDATE public\.procurements SET document_meta/);
 assert.doesNotMatch(sql,/UPDATE public\.official_number_registry SET/);
 assert.doesNotMatch(sql,/UPDATE public\.official_number_counters SET/);
 assert.match(sql,/No existing procurement, counter, or registry row is modified/);
});
