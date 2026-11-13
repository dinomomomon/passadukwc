-- Safe, auditable removal of draft procurement records.
-- Never physically delete the record or recycle document/register numbers.
ALTER TABLE public.procurements
 ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
 ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS procurements_active_school_created_idx
 ON public.procurements(school_id,created_at DESC) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.delete_procurement_draft(
 p_record_id uuid,
 p_expected_updated_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
 rec public.procurements%rowtype;
 v_actor uuid;
BEGIN
 v_actor := auth.uid();
 IF v_actor IS NULL THEN
  RAISE EXCEPTION 'กรุณาเข้าสู่ระบบ' USING ERRCODE='42501';
 END IF;
 SELECT * INTO rec FROM public.procurements
  WHERE id=p_record_id FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'ไม่พบรายการจัดซื้อจัดจ้าง' USING ERRCODE='P0002';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.memberships m
  WHERE m.school_id=rec.school_id AND m.user_id=v_actor AND m.active
   AND (m.role IN ('school_admin','procurement_head')
        OR (m.role='procurement_officer' AND rec.created_by=v_actor))
 ) THEN
  RAISE EXCEPTION 'ไม่มีสิทธิ์ลบรายการนี้' USING ERRCODE='42501';
 END IF;
 IF rec.state<>'draft' OR rec.deleted_at IS NOT NULL THEN
  RAISE EXCEPTION 'ลบได้เฉพาะรายการฉบับร่างที่ยังไม่ถูกลบ' USING ERRCODE='22023';
 END IF;
 IF p_expected_updated_at IS NULL OR rec.updated_at IS DISTINCT FROM p_expected_updated_at THEN
  RAISE EXCEPTION 'รายการถูกแก้ไขโดยผู้อื่น กรุณารีเฟรชข้อมูลก่อนลบ' USING ERRCODE='40001';
 END IF;
 -- Preserve official documents already marked used; procurement_number itself
 -- is always marked used on creation and is intentionally excluded.
 IF EXISTS(
   SELECT 1 FROM public.official_number_registry n
   WHERE n.procurement_id=rec.id AND n.document_field<>'procurement_number'
      AND n.status='used'
 ) OR EXISTS(
   SELECT 1 FROM public.document_versions v
   WHERE v.procurement_id=rec.id
 ) THEN
   RAISE EXCEPTION 'รายการนี้มีเลขเอกสารที่ใช้แล้วหรือไฟล์เอกสารราชการ กรุณาใช้ขั้นตอนยกเลิกแทนการลบ'
     USING ERRCODE='22023';
 END IF;
 -- The registry retains every number, including void numbers.
 UPDATE public.official_number_registry
 SET status='void',updated_at=clock_timestamp(),
     note=concat_ws(' | ',NULLIF(note,''),'ยกเลิกเลขจากการลบฉบับร่าง'),
     used_at=NULL
 WHERE procurement_id=rec.id AND status='reserved';
 -- Setting cancelled makes all existing issue-number and edit RPC state guards
 -- deny further modification, even if the record id is known.
 UPDATE public.procurements
 SET state='cancelled',deleted_at=clock_timestamp(),deleted_by=v_actor,
     updated_at=clock_timestamp()
 WHERE id=rec.id;
 INSERT INTO public.audit_logs
    (school_id,actor,action,entity_type,entity_id,details)
 VALUES(rec.school_id,v_actor,'soft_delete_procurement_draft','procurement',
        rec.id,
        jsonb_build_object(
          'kind',rec.kind,'document_number',rec.document_number,
          'fiscal_year',rec.fiscal_year,'original_state',rec.state,
          'note','Record hidden from active lists; official numbers preserved'));
END
$function$;
REVOKE ALL ON FUNCTION public.delete_procurement_draft(uuid,timestamptz)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delete_procurement_draft(uuid,timestamptz)
 TO authenticated;
