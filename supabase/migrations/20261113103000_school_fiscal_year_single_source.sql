-- Single, school-scoped fiscal year for ALL newly issued procurement number
-- series. Existing issued numbers and saved document dates are never rewritten.
-- The school admin chooses the current year once; it is not a calendar-year field.

ALTER TABLE public.schools
 ADD COLUMN IF NOT EXISTS numbering_fiscal_year integer;

-- Schools already in production receive the current Thai fiscal year as a
-- starting setting; school admins may explicitly choose another year.
ALTER TABLE public.schools
 ALTER COLUMN numbering_fiscal_year SET DEFAULT
 (
  EXTRACT(YEAR FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok'))::integer + 543
  + CASE WHEN EXTRACT(MONTH FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok'))::integer >= 10
         THEN 1 ELSE 0 END
 );

UPDATE public.schools
 SET numbering_fiscal_year =
  EXTRACT(YEAR FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok'))::integer + 543
  + CASE WHEN EXTRACT(MONTH FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok'))::integer >= 10
         THEN 1 ELSE 0 END
 WHERE numbering_fiscal_year IS NULL;

ALTER TABLE public.schools
 ADD CONSTRAINT school_numbering_fiscal_year_range CHECK (numbering_fiscal_year BETWEEN 2500 AND 2700);

ALTER TABLE public.schools
 ALTER COLUMN numbering_fiscal_year SET NOT NULL;

-- Only an authenticated, ACTIVE school admin may change their own school's
-- default. No existing procurement, counter, or registry row is modified.
CREATE OR REPLACE FUNCTION public.set_school_numbering_fiscal_year(
 p_school_id uuid, p_year integer
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fiscal$
DECLARE
 v_previous integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_school_admin(p_school_id) THEN
  RAISE EXCEPTION 'เฉพาะแอดมินโรงเรียนเท่านั้น' USING ERRCODE='42501';
 END IF;
 IF p_year IS NULL OR p_year NOT BETWEEN 2500 AND 2700 THEN
  RAISE EXCEPTION 'ปีงบประมาณไม่ถูกต้อง' USING ERRCODE='22023';
 END IF;
 SELECT numbering_fiscal_year INTO v_previous
 FROM public.schools WHERE id=p_school_id FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'ไม่พบโรงเรียน' USING ERRCODE='P0002';
 END IF;
 IF v_previous = p_year THEN RETURN p_year; END IF;

 UPDATE public.schools SET numbering_fiscal_year=p_year
 WHERE id=p_school_id;

 INSERT INTO public.audit_logs(school_id,actor,action,entity_type,entity_id,details)
 VALUES(p_school_id,auth.uid(),'set_school_numbering_fiscal_year','school',p_school_id,
 jsonb_build_object('previous_year',v_previous,'new_year',p_year,
                   'existing_issued_numbers_unchanged',true));
 RETURN p_year;
END $fiscal$;
REVOKE ALL ON FUNCTION public.set_school_numbering_fiscal_year(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_school_numbering_fiscal_year(uuid,integer) TO authenticated;

-- Both purchasing and hiring already call create_procurement(); the server
-- uses the school's fiscal year regardless of any outdated client input.

CREATE OR REPLACE FUNCTION public.create_procurement(p_school_id uuid, p_kind text, p_fiscal_year integer, p_document_date date, p_title text, p_reason text, p_budget_source text, p_vendor_name text, p_items jsonb, p_department text DEFAULT ''::text, p_method text DEFAULT 'วิธีเฉพาะเจาะจง (รอตรวจสอบข้อกฎหมาย)'::text, p_vendor_address text DEFAULT ''::text, p_inspector_name text DEFAULT ''::text, p_due_date date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare next_no integer; amt bigint:=0; ent jsonb; q numeric;
unit_price bigint; rid uuid; membership_role text; sn jsonb; v_fiscal_year integer;
begin
 select role into membership_role from public.memberships
 where school_id=p_school_id and user_id=auth.uid() and active=true;
 if membership_role not in ('school_admin','procurement_officer','procurement_head') then
  raise exception 'not authorized' using errcode='42501';
 end if;
 -- Lock the school row for the duration of number issuance. An admin
 -- switching the school fiscal year cannot split a single transaction.
 select numbering_fiscal_year into v_fiscal_year
 from public.schools where id=p_school_id for share;
 if v_fiscal_year is null or v_fiscal_year not between 2500 and 2700 then
  raise exception 'โรงเรียนยังไม่ได้กำหนดปีงบประมาณสำหรับเลขเอกสาร' using errcode='22023';
 end if;
 -- Database transaction lock protects 15-day / 10-document trial from race conditions.
 perform public.assert_school_can_create_procurement(p_school_id);
 if p_kind not in ('purchase','hire') or v_fiscal_year not between 2500 and 2700 then
  raise exception 'invalid document type/year';
 end if;
 if length(trim(coalesce(p_title,'')))<1 or length(p_title)>500 then
  raise exception 'title required';
 end if;
 if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100 then
  raise exception 'invalid items';
 end if;
 for ent in select value from jsonb_array_elements(p_items) loop
  if length(trim(coalesce(ent->>'name','')))<1 then raise exception 'item name required'; end if;
  q:=(ent->>'qty')::numeric;
  unit_price:=(ent->>'price_satang')::bigint;
  if q<=0 or q>100000 or unit_price<1 then raise exception 'invalid amount'; end if;
  amt:=amt+round(q*unit_price)::bigint;
 end loop;
 if amt<1 then
  raise exception 'amount must be positive';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_school_id::text||':'||p_kind||':'||v_fiscal_year::text,0));
 insert into public.document_counters(school_id,kind,fiscal_year,last_number)
 values(p_school_id,p_kind,v_fiscal_year,1)
 on conflict(school_id,kind,fiscal_year)
 do update set last_number=public.document_counters.last_number+1
 returning last_number into next_no;
 select jsonb_build_object('officer',officer_name,'head',head_name,'director',director_name)
 into sn from public.schools where id=p_school_id;
 insert into public.procurements
 (school_id,kind,fiscal_year,document_number,document_date,title,department,
 reason,budget_source,method,vendor_name,vendor_address,due_date,inspector_name,
 items,total_satang,signers,created_by)
 values(p_school_id,p_kind,v_fiscal_year,next_no,p_document_date,trim(p_title),
 coalesce(p_department,''),coalesce(p_reason,''),coalesce(p_budget_source,''),
 coalesce(p_method,''),coalesce(p_vendor_name,''),coalesce(p_vendor_address,''),
 p_due_date,coalesce(p_inspector_name,''),p_items,amt,coalesce(sn,'{}'::jsonb),
 auth.uid()) returning id into rid;
 insert into public.audit_logs(school_id,actor,action,entity_type,entity_id,details)
 values(p_school_id,auth.uid(),'create_procurement','procurement',rid,
 jsonb_build_object('number',next_no,'kind',p_kind,'amount_satang',amt));
 return rid;
end $function$;

-- Applies to request/approval/payment, receipt R., and requisition J.
CREATE OR REPLACE FUNCTION public.issue_official_number(p_record_id uuid, p_field text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE rec public.procurements%rowtype; member_role text; v_series text; v_year integer;
 v_n integer; v_value text; existing_row public.official_number_registry%rowtype;
BEGIN
 IF p_field NOT IN ('memo_number','approval_memo_number','payment_memo_number','acceptance_number','requisition_number') THEN
  RAISE EXCEPTION 'ประเภทเลขที่ไม่ถูกต้อง' USING ERRCODE='22023';
 END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'กรุณาเข้าสู่ระบบ' USING ERRCODE='42501'; END IF;
 SELECT * INTO rec FROM public.procurements WHERE id=p_record_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบรายการ' USING ERRCODE='P0002'; END IF;
 SELECT m.role INTO member_role FROM public.memberships m WHERE m.school_id=rec.school_id AND m.user_id=auth.uid() AND m.active;
 IF member_role NOT IN ('school_admin','procurement_head','procurement_officer')
 OR (member_role='procurement_officer' AND rec.created_by<>auth.uid()) THEN
  RAISE EXCEPTION 'ไม่มีสิทธิ์ออกเลขให้รายการนี้' USING ERRCODE='42501'; END IF;
 IF p_field='requisition_number' AND rec.kind<>'purchase' THEN
  RAISE EXCEPTION 'ใบเบิกพัสดุใช้เฉพาะงานจัดซื้อ' USING ERRCODE='22023'; END IF;
 v_series:=CASE WHEN p_field='memo_number' THEN 'request'
  WHEN p_field IN('approval_memo_number','payment_memo_number') THEN 'general'
  WHEN p_field='acceptance_number' THEN 'acceptance' ELSE 'requisition' END;
 -- The fiscal year was fixed when this procurement was created.
 -- Number allocation never uses a calendar or delivery date.
 v_year := rec.fiscal_year;
 -- Avoid creating a second number if already registered.
 SELECT * INTO existing_row FROM public.official_number_registry
 WHERE procurement_id=rec.id AND document_field=p_field AND status IN('reserved','used') FOR UPDATE;
 IF FOUND THEN RETURN CASE WHEN p_field='acceptance_number' THEN 'ร. ' ELSE
  CASE WHEN p_field='requisition_number' THEN 'จ. ' ELSE '' END END
  ||existing_row.serial_no||'/'||existing_row.year_be; END IF;
 IF COALESCE(rec.document_meta->>p_field,'')<>'' THEN
  RAISE EXCEPTION 'รายการนี้มีเลขเดิมที่ยังไม่ผูกทะเบียน กรุณาเปิดทะเบียนคุมเลขเพื่อตรวจสอบ' USING ERRCODE='22023';
 END IF;
 IF rec.state='cancelled' THEN RAISE EXCEPTION 'ไม่สามารถออกเลขให้รายการยกเลิก' USING ERRCODE='22023'; END IF;
 INSERT INTO public.official_number_counters(school_id,series,year_be,last_number)
 VALUES(rec.school_id,v_series,v_year,1)
 ON CONFLICT(school_id,series,year_be) DO UPDATE
 SET last_number=public.official_number_counters.last_number+1
 RETURNING last_number INTO v_n;
 v_value:=CASE WHEN v_series='acceptance' THEN 'ร. ' WHEN v_series='requisition' THEN 'จ. ' ELSE '' END||v_n||'/'||v_year;
 INSERT INTO public.official_number_registry
 (school_id,procurement_id,document_field,series,year_be,serial_no,original_text,status,created_by)
 VALUES(rec.school_id,rec.id,p_field,v_series,v_year,v_n,v_value,'reserved',auth.uid());
 UPDATE public.procurements SET
 document_meta=jsonb_set(COALESCE(document_meta,'{}'::jsonb),ARRAY[p_field],to_jsonb(v_value),true),
 updated_at=clock_timestamp() WHERE id=rec.id;
 INSERT INTO public.audit_logs(school_id,actor,action,entity_type,entity_id,details)
 VALUES(rec.school_id,auth.uid(),'reserve_official_number','procurement',rec.id,
  jsonb_build_object('field',p_field,'series',v_series,'number',v_value));
 RETURN v_value;
END $function$;
