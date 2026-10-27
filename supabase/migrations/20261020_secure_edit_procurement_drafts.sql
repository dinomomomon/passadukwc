CREATE OR REPLACE FUNCTION public.update_procurement_draft(p_record_id uuid, p_expected_updated_at timestamp with time zone, p_document_date date, p_title text, p_reason text, p_budget_source text, p_vendor_name text, p_department text, p_vendor_address text, p_inspector_name text, p_due_date date, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE rec public.procurements%rowtype; member_role text; ent jsonb; q numeric; price bigint; amount bigint:=0;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'กรุณาเข้าสู่ระบบ' USING ERRCODE='42501'; END IF;
 SELECT * INTO rec FROM public.procurements WHERE id=p_record_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบรายการ' USING ERRCODE='P0002'; END IF;
 SELECT role INTO member_role FROM public.memberships WHERE school_id=rec.school_id AND user_id=auth.uid() AND active=true;
 IF member_role IS NULL OR member_role NOT IN ('school_admin','procurement_head','procurement_officer')
 OR (member_role='procurement_officer' AND rec.created_by<>auth.uid()) THEN
 RAISE EXCEPTION 'ไม่มีสิทธิ์แก้ไขรายการนี้' USING ERRCODE='42501'; END IF;
 IF rec.state<>'draft' THEN RAISE EXCEPTION 'แก้ไขได้เฉพาะรายการฉบับร่าง' USING ERRCODE='42501'; END IF;
 IF p_expected_updated_at IS DISTINCT FROM rec.updated_at THEN
 RAISE EXCEPTION 'ข้อมูลถูกแก้ไขจากที่อื่น กรุณาโหลดรายการใหม่' USING ERRCODE='40001'; END IF;
 IF p_document_date IS NULL OR length(trim(coalesce(p_title,''))) NOT BETWEEN 1 AND 500
 OR length(trim(coalesce(p_budget_source,'')))<1 THEN
 RAISE EXCEPTION 'กรุณากรอกวันที่ เรื่อง และแหล่งงบประมาณ' USING ERRCODE='22023'; END IF;
 IF coalesce(jsonb_typeof(p_items),'')<>'array' THEN
 RAISE EXCEPTION 'รูปแบบรายการพัสดุไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN
 RAISE EXCEPTION 'จำนวนรายการไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
 FOR ent IN SELECT value FROM jsonb_array_elements(p_items) LOOP
 IF length(trim(coalesce(ent->>'name','')))<1 OR length(ent->>'name')>500
 OR length(trim(coalesce(ent->>'unit','')))<1 OR length(ent->>'unit')>100 THEN
 RAISE EXCEPTION 'รายการพัสดุหรือหน่วยนับไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
 q:=(ent->>'qty')::numeric;price:=(ent->>'price_satang')::bigint;
 IF q<=0 OR q>100000 OR price<1 OR price>500000 THEN
 RAISE EXCEPTION 'จำนวนหรือราคาต่อหน่วยไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
 amount:=amount+round(q*price)::bigint;
 END LOOP;
 IF amount<1 OR amount>500000 THEN RAISE EXCEPTION 'วงเงินเกิน 5,000 บาท' USING ERRCODE='22023'; END IF;
 UPDATE public.procurements SET document_date=p_document_date,title=trim(p_title),
 reason=coalesce(p_reason,''),budget_source=trim(p_budget_source),
 vendor_name=coalesce(p_vendor_name,''),department=coalesce(p_department,''),
 vendor_address=coalesce(p_vendor_address,''),inspector_name=coalesce(p_inspector_name,''),
 due_date=p_due_date,items=p_items,total_satang=amount,updated_at=clock_timestamp()
 WHERE id=p_record_id;
 INSERT INTO public.audit_logs(school_id,actor,action,entity_type,entity_id,details)
 VALUES(rec.school_id,auth.uid(),'update_procurement_draft','procurement',p_record_id,
 jsonb_build_object('old_title',rec.title,'new_title',trim(p_title),
 'old_amount_satang',rec.total_satang,'new_amount_satang',amount,
 'original_number',rec.document_number,'original_kind',rec.kind,
 'original_fiscal_year',rec.fiscal_year,'old_updated_at',rec.updated_at));
 RETURN p_record_id;
END $function$

REVOKE ALL ON FUNCTION public.update_procurement_draft(uuid,timestamptz,date,text,text,text,text,text,text,text,date,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_procurement_draft(uuid,timestamptz,date,text,text,text,text,text,text,text,date,jsonb) TO authenticated;
