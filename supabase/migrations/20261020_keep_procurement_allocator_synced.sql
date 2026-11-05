CREATE OR REPLACE FUNCTION public.manage_official_number(p_registry_id uuid, p_action text, p_new_serial integer DEFAULT NULL::integer, p_reason text DEFAULT ''::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
   -- Keep the original purchase/hire allocator ahead of every corrected number.
   UPDATE public.document_counters
   SET last_number=GREATEST(last_number,p_new_serial)
   WHERE school_id=n.school_id AND kind=rec.kind AND fiscal_year=rec.fiscal_year;
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
END $function$
;
