
-- Keep imported conflicts visible, even after an administrator resolves them.
ALTER TABLE public.official_number_registry
 DROP CONSTRAINT official_number_registry_status_check;
ALTER TABLE public.official_number_registry
 ADD CONSTRAINT official_number_registry_status_check
 CHECK (status IN ('reserved','used','void','conflict','resolved'));
DROP INDEX public.official_registry_unique_number;
CREATE UNIQUE INDEX official_registry_unique_number ON public.official_number_registry
 (school_id,series,year_be,serial_no)
 WHERE status NOT IN('conflict','resolved') AND serial_no IS NOT NULL;

CREATE OR REPLACE FUNCTION public.resolve_official_number_conflict(
 p_registry_id uuid,p_new_serial integer,p_reason text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE rowdata public.official_number_registry%rowtype; rec public.procurements%rowtype;
 nextvaltext text; prefix text;
BEGIN
 SELECT * INTO rowdata FROM public.official_number_registry WHERE id=p_registry_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบรายการเลขเดิม' USING ERRCODE='P0002'; END IF;
 IF NOT public.is_school_admin(rowdata.school_id) THEN RAISE EXCEPTION 'เฉพาะแอดมินโรงเรียน' USING ERRCODE='42501'; END IF;
 IF rowdata.status<>'conflict' THEN RAISE EXCEPTION 'รายการนี้ไม่อยู่ในสถานะเลขเดิมมีปัญหา' USING ERRCODE='22023'; END IF;
 IF p_new_serial NOT BETWEEN 1 AND 9999999 OR length(trim(coalesce(p_reason,'')))<5 THEN
  RAISE EXCEPTION 'กรุณาระบุเลขใหม่และเหตุผลอย่างน้อย 5 ตัวอักษร' USING ERRCODE='22023'; END IF;
 SELECT * INTO rec FROM public.procurements WHERE id=rowdata.procurement_id FOR UPDATE;
 IF NOT FOUND OR rec.state<>'draft' THEN RAISE EXCEPTION 'แก้ได้เฉพาะรายการฉบับร่าง' USING ERRCODE='22023'; END IF;
 IF EXISTS (SELECT 1 FROM public.official_number_registry
  WHERE school_id=rowdata.school_id AND series=rowdata.series AND year_be=rowdata.year_be AND serial_no=p_new_serial) THEN
  RAISE EXCEPTION 'เลขที่นี้เคยถูกใช้หรือจองแล้ว' USING ERRCODE='23505'; END IF;
 IF EXISTS(SELECT 1 FROM public.official_number_registry WHERE procurement_id=rowdata.procurement_id
  AND document_field=rowdata.document_field AND status IN('reserved','used')) THEN
  RAISE EXCEPTION 'รายการนี้มีเลขทะเบียนที่ใช้งานอยู่แล้ว' USING ERRCODE='23505'; END IF;
 prefix:=CASE rowdata.series WHEN 'acceptance' THEN 'ร. ' WHEN 'requisition' THEN 'จ. ' ELSE '' END;
 nextvaltext:=prefix||p_new_serial||'/'||rowdata.year_be;
 UPDATE public.official_number_registry SET status='resolved',
  note=concat_ws(' | ',note,'ปรับเลขจาก '||original_text||' เป็น '||nextvaltext||': '||p_reason),
  updated_at=now() WHERE id=rowdata.id;
 INSERT INTO public.official_number_registry
 (school_id,procurement_id,document_field,series,year_be,serial_no,original_text,status,created_by,note)
 VALUES(rowdata.school_id,rowdata.procurement_id,rowdata.document_field,rowdata.series,rowdata.year_be,
  p_new_serial,nextvaltext,'reserved',auth.uid(),'แก้ไขเลขเดิมที่ผิดรูปแบบ: '||p_reason);
 UPDATE public.procurements SET document_meta=jsonb_set(COALESCE(document_meta,'{}'::jsonb),
  ARRAY[rowdata.document_field],to_jsonb(nextvaltext),true),updated_at=clock_timestamp()
 WHERE id=rowdata.procurement_id;
 INSERT INTO public.official_number_counters(school_id,series,year_be,last_number)
 VALUES(rowdata.school_id,rowdata.series,rowdata.year_be,p_new_serial)
 ON CONFLICT(school_id,series,year_be) DO UPDATE
 SET last_number=GREATEST(public.official_number_counters.last_number,EXCLUDED.last_number);
 INSERT INTO public.audit_logs(school_id,actor,action,entity_type,entity_id,details)
 VALUES(rowdata.school_id,auth.uid(),'resolve_official_number_conflict','procurement',rowdata.procurement_id,
  jsonb_build_object('old',rowdata.original_text,'new',nextvaltext,'reason',p_reason));
 RETURN nextvaltext;
END $$;
REVOKE ALL ON FUNCTION public.resolve_official_number_conflict(uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resolve_official_number_conflict(uuid,integer,text) TO authenticated;
