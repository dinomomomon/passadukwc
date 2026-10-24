
-- Add protected literal-fragment Word-like editing without ever persisting system field values.
CREATE OR REPLACE FUNCTION public.validate_official_template(p_layout jsonb)
RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE item jsonb; k text; pair record; subpair record; value jsonb; outerkey text;
BEGIN
 IF p_layout IS NULL OR jsonb_typeof(p_layout)<>'object' OR length(p_layout::text)>55000 THEN
  RAISE EXCEPTION 'ข้อมูลแม่แบบไม่ถูกต้องหรือใหญ่เกิน 55 KB' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_layout) t(k)
  WHERE t.k NOT IN ('title','legal','blocks','order','styles','textEdits','signatureOffsets')) THEN
  RAISE EXCEPTION 'คุณสมบัติแม่แบบไม่รองรับ' USING ERRCODE='22023'; END IF;
 FOR k IN SELECT unnest(ARRAY['title','legal']) LOOP
  IF p_layout?k AND (jsonb_typeof(p_layout->k)<>'string' OR length(p_layout->>k)>400) THEN
   RAISE EXCEPTION 'ข้อความหัวเรื่องไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF p_layout?'order' AND (jsonb_typeof(p_layout->'order')<>'array' OR jsonb_array_length(p_layout->'order')>60) THEN
  RAISE EXCEPTION 'ลำดับบล็อกไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
 IF p_layout?'blocks' AND (jsonb_typeof(p_layout->'blocks')<>'array' OR jsonb_array_length(p_layout->'blocks')>24) THEN
  RAISE EXCEPTION 'จำนวนบล็อกเกินกำหนด' USING ERRCODE='22023'; END IF;
 IF p_layout?'styles' AND (jsonb_typeof(p_layout->'styles')<>'object'
  OR (SELECT count(*) FROM jsonb_object_keys(p_layout->'styles'))>60) THEN
  RAISE EXCEPTION 'รูปแบบบล็อกไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT entry.value FROM jsonb_array_elements(COALESCE(p_layout->'blocks','[]'::jsonb)) AS entry(value) LOOP
  IF jsonb_typeof(item)<>'object' OR item->>'type' NOT IN ('paragraph','heading','note','divider')
    OR length(coalesce(item->>'id','')) NOT BETWEEN 1 AND 60
    OR length(coalesce(item->>'text',''))>4000
    OR coalesce(item->>'align','left') NOT IN ('left','center','right')
    OR coalesce(item->>'placement','after-content')<>'after-content'
    OR coalesce(item->>'size','16') NOT IN ('12','14','16','18','20','22','24')
    OR jsonb_typeof(item->'text') IS DISTINCT FROM 'string' THEN
   RAISE EXCEPTION 'ข้อมูลบล็อกไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
 END LOOP;
 FOR pair IN SELECT * FROM jsonb_each(COALESCE(p_layout->'styles','{}'::jsonb)) LOOP
  IF pair.key !~ '^d[0-9]{1,2}$' OR jsonb_typeof(pair.value)<>'object'
   OR coalesce(pair.value->>'align','left') NOT IN ('left','center','right')
   OR coalesce(pair.value->>'size','16') NOT IN ('12','14','16','18','20','22','24')
   OR (pair.value?'bold' AND jsonb_typeof(pair.value->'bold')<>'boolean') THEN
   RAISE EXCEPTION 'บล็อกจัดรูปแบบไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF p_layout?'textEdits' AND (jsonb_typeof(p_layout->'textEdits')<>'object'
  OR (SELECT count(*) FROM jsonb_object_keys(p_layout->'textEdits'))>60) THEN
  RAISE EXCEPTION 'ข้อมูลข้อความไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
 FOR pair IN SELECT * FROM jsonb_each(COALESCE(p_layout->'textEdits','{}'::jsonb)) LOOP
  IF pair.key !~ '^d[0-9]{1,2}$' OR jsonb_typeof(pair.value)<>'object'
   OR (SELECT count(*) FROM jsonb_object_keys(pair.value))>80 THEN
    RAISE EXCEPTION 'ข้อความของบล็อกไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
  FOR subpair IN SELECT * FROM jsonb_each(pair.value) LOOP
   IF subpair.key !~ '^(0|[1-9][0-9]{0,2})$' OR jsonb_typeof(subpair.value)<>'array'
     OR jsonb_array_length(subpair.value)>30 THEN
    RAISE EXCEPTION 'ดัชนีข้อความไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
   FOR value IN SELECT entry.value FROM jsonb_array_elements(subpair.value) AS entry(value) LOOP
    IF jsonb_typeof(value)<>'string' OR length(value#>>'{}')>4000 THEN
     RAISE EXCEPTION 'เนื้อหาข้อความยาวเกินกำหนด' USING ERRCODE='22023'; END IF;
   END LOOP;
  END LOOP;
 END LOOP;
 IF p_layout?'signatureOffsets' AND (jsonb_typeof(p_layout->'signatureOffsets')<>'object'
  OR (SELECT count(*) FROM jsonb_object_keys(p_layout->'signatureOffsets'))>12) THEN
  RAISE EXCEPTION 'ตำแหน่งลายเซ็นไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
 FOR pair IN SELECT * FROM jsonb_each(COALESCE(p_layout->'signatureOffsets','{}'::jsonb)) LOOP
  IF pair.key !~ '^(staff[01]|director|finance|inspector|requisition[0-3])$'
   OR jsonb_typeof(pair.value)<>'object' OR NOT (pair.value ? 'x' AND pair.value ? 'y') OR
   jsonb_typeof(pair.value->'x')<>'number' OR jsonb_typeof(pair.value->'y')<>'number' OR
   abs((pair.value->>'x')::numeric)>15 OR abs((pair.value->>'y')::numeric)>15 THEN
    RAISE EXCEPTION 'ตำแหน่งลายเซ็นต้องไม่เกิน 15 มม.' USING ERRCODE='22023'; END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.validate_official_template(jsonb) FROM PUBLIC,anon;
