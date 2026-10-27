
-- Existing acceptance allocation now shares the central transaction and ledger.
CREATE OR REPLACE FUNCTION public.ensure_procurement_acceptance_number(p_record_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 RETURN public.issue_official_number(p_record_id,'acceptance_number');
END $$;
REVOKE ALL ON FUNCTION public.ensure_procurement_acceptance_number(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ensure_procurement_acceptance_number(uuid) TO authenticated;
-- Legacy procurement renumbering is routed through ledger correction.
CREATE OR REPLACE FUNCTION public.change_procurement_number(p_record_id uuid,p_new_number integer,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n_id uuid; r public.procurements%rowtype;
BEGIN
 SELECT * INTO r FROM public.procurements WHERE id=p_record_id FOR UPDATE;
 IF NOT FOUND OR NOT public.is_school_admin(r.school_id) THEN RAISE EXCEPTION 'ไม่มีสิทธิ์แก้เลข' USING ERRCODE='42501'; END IF;
 SELECT id INTO n_id FROM public.official_number_registry
 WHERE procurement_id=p_record_id AND document_field='procurement_number'
   AND status IN ('reserved','used') LIMIT 1;
 IF n_id IS NULL THEN RAISE EXCEPTION 'เลขทะเบียนเดิมยังไม่อยู่ในทะเบียนกลาง'; END IF;
 PERFORM public.manage_official_number(n_id,'renumber',p_new_number,p_reason);
 UPDATE public.document_counters SET last_number=GREATEST(last_number,p_new_number)
 WHERE school_id=r.school_id AND kind=r.kind AND fiscal_year=r.fiscal_year;
END $$;
REVOKE ALL ON FUNCTION public.change_procurement_number(uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.change_procurement_number(uuid,integer,text) TO authenticated;
-- Server assigns receipt and requisition numbers when actual delivery is recorded.
-- Uses the same transaction as the metadata save; no allocations if the save fails.
CREATE OR REPLACE FUNCTION public.after_delivery_allocate_official_numbers()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' AND COALESCE(NEW.document_meta->>'delivery_date','')<>''
 AND COALESCE(OLD.document_meta->>'delivery_date','') IS DISTINCT FROM COALESCE(NEW.document_meta->>'delivery_date','') THEN
  IF COALESCE(NEW.document_meta->>'acceptance_number','')='' THEN
   PERFORM public.issue_official_number(NEW.id,'acceptance_number');
  END IF;
  IF NEW.kind='purchase' AND COALESCE(NEW.document_meta->>'requisition_number','')='' THEN
   PERFORM public.issue_official_number(NEW.id,'requisition_number');
  END IF;
 END IF;
 RETURN NEW;
END $$;
-- Trigger recursion is safe: the second UPDATE changes only number fields,
-- not delivery_date, and therefore does not allocate again.
CREATE TRIGGER after_delivery_registry_numbers AFTER UPDATE OF document_meta ON public.procurements
 FOR EACH ROW EXECUTE FUNCTION public.after_delivery_allocate_official_numbers();
