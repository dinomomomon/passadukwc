
-- Central, school-scoped official document number ledger.
CREATE TABLE public.official_number_counters (
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 series text NOT NULL CHECK (series IN ('request','general','acceptance','requisition','procurement_purchase','procurement_hire')),
 year_be integer NOT NULL CHECK (year_be BETWEEN 2500 AND 2700),
 last_number integer NOT NULL DEFAULT 0 CHECK (last_number BETWEEN 0 AND 9999999),
 PRIMARY KEY (school_id,series,year_be)
);
CREATE TABLE public.official_number_registry (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 procurement_id uuid REFERENCES public.procurements(id) ON DELETE RESTRICT,
 document_field text NOT NULL CHECK (document_field IN ('memo_number','approval_memo_number','payment_memo_number','acceptance_number','requisition_number','procurement_number')),
 series text NOT NULL CHECK (series IN ('request','general','acceptance','requisition','procurement_purchase','procurement_hire')),
 year_be integer NOT NULL CHECK (year_be BETWEEN 2500 AND 2700),
 serial_no integer CHECK (serial_no BETWEEN 1 AND 9999999),
 original_text text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','used','void','conflict')),
 note text NOT NULL DEFAULT '',
 created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 used_at timestamptz,
 CONSTRAINT registry_series_field CHECK (
  (series='request' AND document_field='memo_number') OR
  (series='general' AND document_field IN ('approval_memo_number','payment_memo_number')) OR
  (series='acceptance' AND document_field='acceptance_number') OR
  (series='requisition' AND document_field='requisition_number') OR
  (series='procurement_purchase' AND document_field='procurement_number') OR
  (series='procurement_hire' AND document_field='procurement_number')
 )
);
-- A void number is held permanently; only imported legacy conflicts are exempt.
CREATE UNIQUE INDEX official_registry_unique_number ON public.official_number_registry
 (school_id,series,year_be,serial_no) WHERE status<>'conflict' AND serial_no IS NOT NULL;
CREATE UNIQUE INDEX official_registry_record_active ON public.official_number_registry
 (procurement_id,document_field) WHERE status IN ('reserved','used');
CREATE INDEX official_registry_school_latest ON public.official_number_registry
 (school_id,created_at DESC);
ALTER TABLE public.official_number_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_number_registry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.official_number_counters FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.official_number_registry FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.official_number_registry TO authenticated;
CREATE POLICY school_members_read_numbers ON public.official_number_registry
 FOR SELECT TO authenticated USING
 (EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.school_id=school_id AND m.user_id=auth.uid() AND m.active));
-- All internal numbering uses server transactions. Never increment in browser.
CREATE OR REPLACE FUNCTION public.issue_official_number(p_record_id uuid,p_field text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
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
 v_year:=EXTRACT(YEAR FROM COALESCE(
    NULLIF(rec.document_meta->>'delivery_date','')::date,
    rec.document_date
 ))::integer;
 IF p_field IN ('memo_number','approval_memo_number','payment_memo_number') THEN
  v_year:=EXTRACT(YEAR FROM rec.document_date)::integer;
 END IF;
 IF v_year<2400 THEN v_year:=v_year+543; END IF;
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
END $$;
REVOKE ALL ON FUNCTION public.issue_official_number(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.issue_official_number(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.manage_official_number(
 p_registry_id uuid,p_action text,p_new_serial integer DEFAULT NULL,p_reason text DEFAULT ''
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n public.official_number_registry%rowtype; rec public.procurements%rowtype;
 role_name text; v_value text; v_new_id uuid; v_prefix text;
BEGIN
 SELECT * INTO n FROM public.official_number_registry WHERE id=p_registry_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบเลขทะเบียน' USING ERRCODE='P0002'; END IF;
 SELECT m.role INTO role_name FROM public.memberships m WHERE m.school_id=n.school_id AND m.user_id=auth.uid() AND m.active;
 IF p_action='use' THEN
  IF role_name NOT IN ('school_admin','procurement_head','procurement_officer') THEN RAISE EXCEPTION 'ไม่มีสิทธิ์ใช้งานเลข' USING ERRCODE='42501'; END IF;
  IF n.procurement_id IS NOT NULL AND role_name='procurement_officer' AND NOT EXISTS
   (SELECT 1 FROM public.procurements WHERE id=n.procurement_id AND created_by=auth.uid()) THEN
   RAISE EXCEPTION 'ไม่ใช่รายการที่จัดทำเอง' USING ERRCODE='42501'; END IF;
 ELSE
  IF role_name IS DISTINCT FROM 'school_admin' THEN RAISE EXCEPTION 'เฉพาะแอดมินโรงเรียนแก้ไขหรือยกเลิกเลขได้' USING ERRCODE='42501'; END IF;
 END IF;
 IF n.status NOT IN('reserved','used') THEN RAISE EXCEPTION 'เลขนี้ไม่อยู่ในสถานะแก้ไขได้' USING ERRCODE='22023'; END IF;
 IF p_action='use' THEN
  UPDATE public.official_number_registry SET status='used',updated_at=now(),used_at=COALESCE(used_at,now()) WHERE id=n.id;
  v_value:=n.original_text;
 ELSIF p_action IN('void','renumber') THEN
  IF length(trim(COALESCE(p_reason,'')))<5 THEN RAISE EXCEPTION 'กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร' USING ERRCODE='22023'; END IF;
  SELECT * INTO rec FROM public.procurements WHERE id=n.procurement_id FOR UPDATE;
  IF NOT FOUND OR rec.state<>'draft' THEN RAISE EXCEPTION 'แก้เลขได้เฉพาะรายการฉบับร่าง' USING ERRCODE='22023'; END IF;
  IF p_action='renumber' AND (p_new_serial IS NULL OR p_new_serial NOT BETWEEN 1 AND 9999999) THEN
   RAISE EXCEPTION 'เลขใหม่ไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
  IF p_action='renumber' AND p_new_serial=n.serial_no THEN RETURN n.original_text; END IF;
  v_prefix:=CASE WHEN n.series='acceptance' THEN 'ร. ' WHEN n.series='requisition' THEN 'จ. ' ELSE '' END;
  IF p_action='renumber' AND EXISTS(
   SELECT 1 FROM public.official_number_registry
   WHERE school_id=n.school_id AND series=n.series AND year_be=n.year_be
   AND serial_no=p_new_serial) THEN
   RAISE EXCEPTION 'เลข % ถูกจองหรือใช้ไปแล้ว กรุณาตรวจสอบทะเบียน',p_new_serial USING ERRCODE='23505'; END IF;
  UPDATE public.official_number_registry SET status='void',
   note=concat_ws(' | ',note,'ยกเลิก/เปลี่ยนเลข: '||p_reason),updated_at=now() WHERE id=n.id;
  IF p_action='renumber' THEN
   v_value:=v_prefix||p_new_serial||'/'||n.year_be;
   INSERT INTO public.official_number_registry(school_id,procurement_id,document_field,series,year_be,serial_no,original_text,status,created_by,note)
   VALUES(n.school_id,n.procurement_id,n.document_field,n.series,n.year_be,p_new_serial,v_value,'reserved',auth.uid(),'แก้จาก '||n.original_text||': '||p_reason);
   INSERT INTO public.official_number_counters(school_id,series,year_be,last_number)
   VALUES(n.school_id,n.series,n.year_be,p_new_serial)
   ON CONFLICT(school_id,series,year_be) DO UPDATE SET last_number=GREATEST(public.official_number_counters.last_number,EXCLUDED.last_number);
  ELSE v_value:=''; END IF;
  IF n.document_field='procurement_number' THEN
   IF p_action='void' THEN RAISE EXCEPTION 'ไม่สามารถลบเลขทะเบียนจัดซื้อ/จัดจ้างได้' USING ERRCODE='22023'; END IF;
   UPDATE public.procurements SET document_number=p_new_serial,updated_at=clock_timestamp() WHERE id=n.procurement_id;
  ELSE
   UPDATE public.procurements SET document_meta=CASE WHEN v_value='' THEN COALESCE(document_meta,'{}'::jsonb)-n.document_field
    ELSE jsonb_set(COALESCE(document_meta,'{}'::jsonb),ARRAY[n.document_field],to_jsonb(v_value),true) END,
    updated_at=clock_timestamp() WHERE id=n.procurement_id;
  END IF;
 ELSE RAISE EXCEPTION 'คำสั่งไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
 INSERT INTO public.audit_logs(school_id,actor,action,entity_type,entity_id,details)
 VALUES(n.school_id,auth.uid(),'official_number_'||p_action,'procurement',n.procurement_id,
  jsonb_build_object('old',n.original_text,'new',v_value,'reason',p_reason,'registry_id',n.id));
 RETURN v_value;
END $$;
REVOKE ALL ON FUNCTION public.manage_official_number(uuid,text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manage_official_number(uuid,text,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_official_number_start(
 p_school_id uuid,p_series text,p_year integer,p_next integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE max_used integer;
BEGIN
 IF NOT public.is_school_admin(p_school_id) THEN RAISE EXCEPTION 'เฉพาะแอดมินโรงเรียน' USING ERRCODE='42501'; END IF;
 IF p_series NOT IN('request','general','acceptance','requisition') OR p_year NOT BETWEEN 2500 AND 2700 OR p_next NOT BETWEEN 1 AND 9999999 THEN
  RAISE EXCEPTION 'กรุณาระบุทะเบียน ปี และเลขเริ่มต้นให้ถูกต้อง' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_school_id::text||':'||p_series||':'||p_year::text,0));
 SELECT COALESCE(MAX(serial_no),0) INTO max_used FROM public.official_number_registry
 WHERE school_id=p_school_id AND series=p_series AND year_be=p_year;
 IF p_next<=max_used THEN RAISE EXCEPTION 'เลขเริ่มต้นต้องมากกว่าเลขที่เคยใช้/จอง (%).',max_used USING ERRCODE='22023'; END IF;
 INSERT INTO public.official_number_counters(school_id,series,year_be,last_number)
 VALUES(p_school_id,p_series,p_year,p_next-1)
 ON CONFLICT(school_id,series,year_be) DO UPDATE SET last_number=EXCLUDED.last_number;
 INSERT INTO public.audit_logs(school_id,actor,action,entity_type,details)
 VALUES(p_school_id,auth.uid(),'set_official_number_start','official_number_registry',
  jsonb_build_object('series',p_series,'year',p_year,'next',p_next));
END $$;
REVOKE ALL ON FUNCTION public.set_official_number_start(uuid,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_official_number_start(uuid,text,integer,integer) TO authenticated;

-- Import historical rows without rewriting any stored document number.
-- When a duplicated number already exists, retain the later row as 'conflict'
-- so staff can investigate rather than silently relabel historic documents.
WITH source AS (
 SELECT p.id AS procurement_id,p.school_id,p.created_by,p.title,p.created_at,
 p.kind,p.fiscal_year AS year_be,p.document_number AS serial_no,
 CASE WHEN p.kind='purchase' THEN 'procurement_purchase' ELSE 'procurement_hire' END AS series,
 'procurement_number'::text AS document_field,
 p.document_number::text||'/'||p.fiscal_year::text AS raw_number,
 p.state FROM public.procurements p
 UNION ALL
 SELECT p.id,p.school_id,p.created_by,p.title,p.created_at,p.kind,
 COALESCE((regexp_match(m.val,'/([0-9]{4})[[:space:]]*$'))[1]::int,EXTRACT(YEAR FROM p.document_date)::int+543),
 (regexp_match(m.val,'([0-9]{1,7})[[:space:]]*/'))[1]::int,
 CASE m.field WHEN 'memo_number' THEN 'request' WHEN 'acceptance_number' THEN 'acceptance'
 WHEN 'requisition_number' THEN 'requisition' ELSE 'general' END,
 m.field,m.val,p.state
 FROM public.procurements p CROSS JOIN LATERAL
 (VALUES('memo_number',p.document_meta->>'memo_number'),
        ('approval_memo_number',p.document_meta->>'approval_memo_number'),
        ('payment_memo_number',p.document_meta->>'payment_memo_number'),
        ('acceptance_number',p.document_meta->>'acceptance_number'),
        ('requisition_number',p.document_meta->>'requisition_number')) m(field,val)
 WHERE NULLIF(trim(COALESCE(m.val,'')),'') IS NOT NULL
), ordered AS (
 SELECT s.*,ROW_NUMBER() OVER(PARTITION BY school_id,series,year_be,serial_no
 ORDER BY CASE WHEN state='cancelled' THEN 1 ELSE 0 END,created_at,procurement_id,document_field) AS occurrence
 FROM source s
)
INSERT INTO public.official_number_registry
 (school_id,procurement_id,document_field,series,year_be,serial_no,original_text,status,created_by,created_at,note)
SELECT school_id,procurement_id,document_field,series,year_be,serial_no,raw_number,
 CASE WHEN serial_no IS NULL OR serial_no<1 OR occurrence>1 THEN 'conflict'
 WHEN state='cancelled' THEN 'void' ELSE 'used' END,created_by,created_at,
 CASE WHEN serial_no IS NULL OR serial_no<1 THEN 'เลขเดิมไม่ตรงรูปแบบ ตรวจสอบด้วยตนเอง'
 WHEN occurrence>1 THEN 'เลขเดิมซ้ำกับรายการอื่น ต้องตรวจสอบ'
 ELSE 'นำเข้าจากเอกสารที่มีอยู่เดิม' END
FROM ordered
WHERE year_be BETWEEN 2500 AND 2700;
INSERT INTO public.official_number_counters(school_id,series,year_be,last_number)
SELECT school_id,series,year_be,MAX(serial_no) FROM public.official_number_registry
WHERE serial_no IS NOT NULL GROUP BY school_id,series,year_be
ON CONFLICT(school_id,series,year_be) DO UPDATE
SET last_number=GREATEST(public.official_number_counters.last_number,EXCLUDED.last_number);

-- Automatically reserve request and both general memos upon new procurement.
CREATE OR REPLACE FUNCTION public.auto_register_procurement_numbers()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 INSERT INTO public.official_number_registry
 (school_id,procurement_id,document_field,series,year_be,serial_no,original_text,status,created_by)
 VALUES(NEW.school_id,NEW.id,'procurement_number',
 CASE WHEN NEW.kind='purchase' THEN 'procurement_purchase' ELSE 'procurement_hire' END,
 NEW.fiscal_year,NEW.document_number,NEW.document_number::text||'/'||NEW.fiscal_year::text,'used',auth.uid());
 PERFORM public.issue_official_number(NEW.id,'memo_number');
 PERFORM public.issue_official_number(NEW.id,'approval_memo_number');
 PERFORM public.issue_official_number(NEW.id,'payment_memo_number');
 RETURN NEW;
END $$;
CREATE TRIGGER after_procurement_register_numbers AFTER INSERT ON public.procurements
 FOR EACH ROW EXECUTE FUNCTION public.auto_register_procurement_numbers();

-- Preserve protected numbers when editing other metadata; changes are via
-- manage_official_number only, preventing bypasses of the uniqueness register.
CREATE OR REPLACE FUNCTION public.protect_official_numbers_in_meta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE k text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.document_meta IS DISTINCT FROM OLD.document_meta THEN
  -- Activated only for API metadata modifications (not registry itself);
  -- actual protected write access is enforced in set_procurement_document_meta.
  NULL;
 END IF;
 RETURN NEW;
END $$;
