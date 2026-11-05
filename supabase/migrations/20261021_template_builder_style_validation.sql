
-- Strictly validate block styling too; no arbitrary CSS/HTML can be stored.
CREATE OR REPLACE FUNCTION public.validate_official_template(p_layout jsonb)
RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE item jsonb; k text; pair record;
BEGIN
 IF p_layout IS NULL OR jsonb_typeof(p_layout)<>'object' OR length(p_layout::text)>55000 THEN
  RAISE EXCEPTION 'ข้อมูลแม่แบบไม่ถูกต้องหรือมีขนาดเกิน 55 KB' USING ERRCODE='22023'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_layout) t(k)
    WHERE t.k NOT IN ('title','legal','blocks','order','styles')) THEN
  RAISE EXCEPTION 'พบคุณสมบัติแม่แบบที่ไม่รองรับ' USING ERRCODE='22023'; END IF;
 FOR k IN SELECT unnest(ARRAY['title','legal']) LOOP
  IF p_layout?k AND (jsonb_typeof(p_layout->k)<>'string' OR length(p_layout->>k)>400) THEN
   RAISE EXCEPTION 'ข้อความหัวเรื่องยาวเกินไป' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF p_layout?'order' AND (jsonb_typeof(p_layout->'order')<>'array'
   OR jsonb_array_length(p_layout->'order')>60) THEN
   RAISE EXCEPTION 'ลำดับบล็อกไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
 IF p_layout?'blocks' AND (jsonb_typeof(p_layout->'blocks')<>'array'
   OR jsonb_array_length(p_layout->'blocks')>24) THEN
   RAISE EXCEPTION 'เพิ่มบล็อกได้ไม่เกิน 24 บล็อกต่อหน้า' USING ERRCODE='22023'; END IF;
 IF p_layout?'styles' AND (jsonb_typeof(p_layout->'styles')<>'object'
   OR (SELECT count(*) FROM jsonb_object_keys(p_layout->'styles'))>60) THEN
   RAISE EXCEPTION 'รูปแบบบล็อกต้นฉบับไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_layout->'blocks','[]'::jsonb)) LOOP
  IF jsonb_typeof(item)<>'object' OR item->>'type' NOT IN ('paragraph','heading','note','divider')
    OR length(coalesce(item->>'id','')) NOT BETWEEN 1 AND 60
    OR length(coalesce(item->>'text',''))>4000
    OR coalesce(item->>'align','left') NOT IN ('left','center','right')
    OR coalesce(item->>'placement','after-content')<>'after-content'
    OR coalesce(item->>'size','16') NOT IN ('12','14','16','18','20','22','24')
    OR jsonb_typeof(item->'text') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'รูปแบบบล็อกแม่แบบไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
 END LOOP;
 FOR pair IN SELECT * FROM jsonb_each(COALESCE(p_layout->'styles','{}'::jsonb)) LOOP
  IF pair.key !~ '^d[0-9]{1,2}$' OR jsonb_typeof(pair.value)<>'object'
    OR coalesce(pair.value->>'align','left') NOT IN ('left','center','right')
    OR coalesce(pair.value->>'size','16') NOT IN ('12','14','16','18','20','22','24')
    OR (pair.value?'bold' AND jsonb_typeof(pair.value->'bold')<>'boolean') THEN
    RAISE EXCEPTION 'รูปแบบการจัดบล็อกไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.validate_official_template(jsonb) FROM PUBLIC,anon;
