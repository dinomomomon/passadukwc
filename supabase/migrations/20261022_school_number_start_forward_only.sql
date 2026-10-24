-- School-admin only numbering configuration. Keeps the existing shared series
-- and the official_number_registry as the source of truth.
-- Prevents lowering an existing counter or reusing void/reserved numbers.
CREATE OR REPLACE FUNCTION public.set_official_number_start(
 p_school_id uuid,p_series text,p_year integer,p_next integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $function$
DECLARE
 max_registered integer;
 last_allocated integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_school_admin(p_school_id) THEN
  RAISE EXCEPTION 'เฉพาะแอดมินโรงเรียนเท่านั้น' USING ERRCODE='42501';
 END IF;
 IF p_series NOT IN ('request','general','acceptance','requisition')
    OR p_year NOT BETWEEN 2500 AND 2700 OR p_next NOT BETWEEN 1 AND 9999999 THEN
  RAISE EXCEPTION 'กรุณาระบุทะเบียน ปี และเลขถัดไปให้ถูกต้อง' USING ERRCODE='22023';
 END IF;
 -- Serialize with the existing allocator: both use the same counter row.
 -- Creating an empty counter also prevents a concurrent first allocation race.
 INSERT INTO public.official_number_counters(school_id,series,year_be,last_number)
 VALUES(p_school_id,p_series,p_year,0)
 ON CONFLICT(school_id,series,year_be) DO NOTHING;
 SELECT c.last_number INTO last_allocated
 FROM public.official_number_counters c
 WHERE c.school_id=p_school_id AND c.series=p_series AND c.year_be=p_year FOR UPDATE;
 SELECT COALESCE(MAX(r.serial_no),0) INTO max_registered
 FROM public.official_number_registry r
 WHERE r.school_id=p_school_id AND r.series=p_series AND r.year_be=p_year;
 IF p_next<=GREATEST(COALESCE(last_allocated,0),max_registered) THEN
  RAISE EXCEPTION 'เลขถัดไปต้องมากกว่าเลขที่เคยจอง ใช้ ยกเลิก หรือผ่านตัวนับแล้ว (ล่าสุด %)',
   GREATEST(COALESCE(last_allocated,0),max_registered) USING ERRCODE='22023';
 END IF;
 UPDATE public.official_number_counters
 SET last_number=p_next-1
 WHERE school_id=p_school_id AND series=p_series AND year_be=p_year;
 INSERT INTO public.audit_logs(school_id,actor,action,entity_type,details)
 VALUES(p_school_id,auth.uid(),'set_official_number_start','official_number_registry',
  jsonb_build_object('series',p_series,'year',p_year,'old_last',last_allocated,
   'registry_max',max_registered,'next',p_next));
END $function$;

REVOKE ALL ON FUNCTION public.set_official_number_start(uuid,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_official_number_start(uuid,text,integer,integer) TO authenticated;

-- Expose only the authenticated school admin's four controlled counters.
-- This does not provide unfiltered SELECT access to the underlying table.
CREATE OR REPLACE FUNCTION public.get_official_number_starts(
 p_school_id uuid,p_year integer
) RETURNS TABLE(series text,last_number integer,registry_max integer,next_number integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_school_admin(p_school_id) THEN
  RAISE EXCEPTION 'เฉพาะแอดมินโรงเรียนเท่านั้น' USING ERRCODE='42501';
 END IF;
 IF p_year NOT BETWEEN 2500 AND 2700 THEN
  RAISE EXCEPTION 'ปี พ.ศ. ไม่ถูกต้อง' USING ERRCODE='22023';
 END IF;
 RETURN QUERY
 WITH types(series) AS (VALUES ('request'::text),('general'::text),
                              ('acceptance'::text),('requisition'::text)),
 registered AS (
  SELECT r.series,MAX(r.serial_no)::integer AS max_serial
  FROM public.official_number_registry r
  WHERE r.school_id=p_school_id AND r.year_be=p_year
    AND r.series IN ('request','general','acceptance','requisition')
  GROUP BY r.series
 )
 SELECT t.series,
        COALESCE(c.last_number,0)::integer,
        COALESCE(r.max_serial,0)::integer,
        (GREATEST(COALESCE(c.last_number,0),COALESCE(r.max_serial,0))+1)::integer
 FROM types t
 LEFT JOIN public.official_number_counters c
   ON c.school_id=p_school_id AND c.series=t.series AND c.year_be=p_year
 LEFT JOIN registered r ON r.series=t.series
 ORDER BY CASE t.series WHEN 'request' THEN 1 WHEN 'general' THEN 2
                        WHEN 'acceptance' THEN 3 ELSE 4 END;
END $function$;

REVOKE ALL ON FUNCTION public.get_official_number_starts(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_official_number_starts(uuid,integer) TO authenticated;
