
CREATE TABLE IF NOT EXISTS public.acceptance_number_counters (
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  calendar_year_be integer NOT NULL CHECK (calendar_year_be BETWEEN 2500 AND 2700),
  last_number integer NOT NULL CHECK (last_number >= 0),
  PRIMARY KEY (school_id,calendar_year_be)
);
ALTER TABLE public.acceptance_number_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.acceptance_number_counters FROM PUBLIC,anon,authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS procurements_unique_acceptance_number
 ON public.procurements (school_id,(document_meta->>'acceptance_number'))
 WHERE coalesce(document_meta->>'acceptance_number','') <> '';
CREATE OR REPLACE FUNCTION public.ensure_procurement_acceptance_number(p_record_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $fn$
DECLARE v_rec public.procurements%rowtype; v_role text; yr int; n int; proposed text; tries int:=0;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ต้องเข้าสู่ระบบ' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_rec FROM public.procurements WHERE id=p_record_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบรายการ' USING ERRCODE='P0002'; END IF;
 SELECT role INTO v_role FROM public.memberships
   WHERE school_id=v_rec.school_id AND user_id=auth.uid() AND active=true;
 IF v_role NOT IN ('school_admin','procurement_head','procurement_officer')
 OR (v_role='procurement_officer' AND v_rec.created_by <> auth.uid()) THEN
   RAISE EXCEPTION 'ไม่มีสิทธิ์จัดเลขใบตรวจรับ' USING ERRCODE='42501';
 END IF;
 IF length(coalesce(v_rec.document_meta->>'acceptance_number',''))>0
   THEN RETURN v_rec.document_meta->>'acceptance_number'; END IF;
 -- The receipt number is issued once and does not change if receipt dates change.
 -- Calendar year is derived from recorded delivery date, otherwise document date.
 yr := extract(year FROM coalesce(nullif(v_rec.document_meta->>'delivery_date','')::date,v_rec.document_date))::int;
 yr := CASE WHEN yr<2400 THEN yr+543 ELSE yr END;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_rec.school_id::text||':receipt:'||yr::text,0));
 LOOP
   INSERT INTO public.acceptance_number_counters(school_id,calendar_year_be,last_number)
   VALUES(v_rec.school_id,yr,1)
   ON CONFLICT(school_id,calendar_year_be)
   DO UPDATE SET last_number=public.acceptance_number_counters.last_number+1
   RETURNING last_number INTO n;
   proposed:='ร. '||n||'/'||yr;
   EXIT WHEN NOT EXISTS(SELECT 1 FROM public.procurements
      WHERE school_id=v_rec.school_id
      AND document_meta->>'acceptance_number'=proposed);
   tries:=tries+1;
   IF tries>1000 THEN RAISE EXCEPTION 'ไม่สามารถออกเลขใบตรวจรับได้'; END IF;
 END LOOP;
 UPDATE public.procurements SET
  document_meta=jsonb_set(coalesce(document_meta,'{}'::jsonb),'{acceptance_number}',to_jsonb(proposed),true),
  updated_at=clock_timestamp() WHERE id=p_record_id;
 INSERT INTO public.audit_logs(school_id,actor,action,entity_type,entity_id,details)
 VALUES(v_rec.school_id,auth.uid(),'allocate_acceptance_number','procurement',p_record_id,
 jsonb_build_object('number',proposed,'calendar_year_be',yr));
 RETURN proposed;
END $fn$;
REVOKE ALL ON FUNCTION public.ensure_procurement_acceptance_number(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ensure_procurement_acceptance_number(uuid) TO authenticated;
