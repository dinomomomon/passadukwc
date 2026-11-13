-- Procurement VAT 7% choice and payment deductions.
-- Only widen the existing school-authorized metadata RPC; preserve SECURITY DEFINER
-- role guards, number registry locks and old procurement data unchanged.
DO $tax_migration$
DECLARE
 source_text text;
 updated_text text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO source_text
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='set_procurement_document_meta'
 AND pg_get_function_identity_arguments(p.oid)='p_record_id uuid, p_meta jsonb';
 IF source_text IS NULL THEN RAISE EXCEPTION 'Procurement metadata RPC missing'; END IF;
 updated_text:=replace(source_text,
  '''vat_baht'',''withholding_baht'',''fine_baht'',''payable_baht'',''item_base_baht''',
  '''vat_baht'',''withholding_baht'',''fine_baht'',''payable_baht'',''item_base_baht'',''vat_mode'',''discount_baht''');
 IF updated_text=source_text THEN RAISE EXCEPTION 'Cannot locate metadata allowlist'; END IF;
 updated_text:=replace(updated_text,
  'coalesce((p_meta->>''fine_baht'')::numeric,0)>',
  'coalesce((p_meta->>''fine_baht'')::numeric,0)+coalesce((p_meta->>''discount_baht'')::numeric,0)>');
 IF updated_text NOT LIKE '%coalesce((p_meta->>''discount_baht'')::numeric,0)>%' THEN
  RAISE EXCEPTION 'Cannot extend payment deduction limit';
 END IF;
 updated_text:=replace(updated_text,
  'declare v_school uuid; v_key text; v_value jsonb; v_role text;',
  'declare v_school uuid; v_key text; v_value jsonb; v_role text; v_tax_satang numeric; v_mode text;');
 IF updated_text NOT LIKE '%v_tax_satang numeric%' THEN RAISE EXCEPTION 'Cannot add safe tax variable'; END IF;
 updated_text:=replace(updated_text,
  ' -- Protected numbers may only be issued or changed through the registry RPC.',
  $extra$
 -- New explicit VAT selections are checked against saved item evidence, not trusted
 -- solely because the user supplied a number in the browser.
 IF p_meta ? 'vat_mode' THEN
  v_mode:=p_meta->>'vat_mode';
  IF v_mode NOT IN ('legacy','included','added','none','mixed') THEN
   RAISE EXCEPTION 'ประเภท VAT ไม่ถูกต้อง' USING ERRCODE='22023';
  END IF;
  IF v_mode<>'legacy' THEN
   IF EXISTS(
    SELECT 1 FROM jsonb_array_elements(
     (SELECT items FROM public.procurements WHERE id=p_record_id)
    ) x(item)
    WHERE x.item->>'entered_price_satang' IS NULL
      OR COALESCE((x.item->>'entered_price_satang')::numeric,-1)<0
      OR (CASE WHEN v_mode='mixed' THEN x.item->>'vat_treatment'
           ELSE v_mode END) NOT IN ('included','added','none')
      OR (v_mode='mixed' AND x.item->>'vat_treatment' IS NULL)
   ) THEN
    RAISE EXCEPTION 'ข้อมูล VAT ของรายการไม่ครบ ต้องแก้ไขรายการฉบับร่างก่อน'
     USING ERRCODE='22023';
   END IF;
   SELECT COALESCE(SUM(
    CASE (CASE WHEN v_mode='mixed' THEN x.item->>'vat_treatment' ELSE v_mode END)
     WHEN 'included' THEN round(round((x.item->>'qty')::numeric*
        (x.item->>'price_satang')::numeric)*7/107)
     WHEN 'added' THEN round((x.item->>'qty')::numeric*
        (x.item->>'price_satang')::numeric)-round((x.item->>'qty')::numeric*
        (x.item->>'entered_price_satang')::numeric)
     ELSE 0 END
   ),0) INTO v_tax_satang
   FROM jsonb_array_elements((SELECT items FROM public.procurements WHERE id=p_record_id)) x(item);
   IF (p_meta ? 'vat_baht') AND p_meta->>'vat_baht' IS NOT NULL AND
    abs(v_tax_satang-(p_meta->>'vat_baht')::numeric*100)>0.01 THEN
    RAISE EXCEPTION 'ยอด VAT ไม่ตรงกับราคาพัสดุ โปรดตรวจข้อมูลรายการ'
     USING ERRCODE='22023';
   END IF;
   IF (p_meta ? 'item_base_baht') AND p_meta->>'item_base_baht' IS NOT NULL AND
    abs((SELECT total_satang FROM public.procurements WHERE id=p_record_id)-v_tax_satang-
       (p_meta->>'item_base_baht')::numeric*100)>0.01 THEN
    RAISE EXCEPTION 'ฐานราคา VAT ไม่ตรงกับยอดรวม' USING ERRCODE='22023';
   END IF;
  END IF;
 END IF;
 IF EXISTS(
  SELECT 1 FROM jsonb_each_text(p_meta) v(key,value)
  WHERE v.key IN ('vat_baht','discount_baht','withholding_baht','fine_baht','payable_baht','item_base_baht')
   AND v.value IS NOT NULL AND v.value<>'' AND
   (v.value !~ '^(0|[1-9][0-9]*)([.][0-9]{1,2})?$' OR length(v.value)>30)
 ) THEN
  RAISE EXCEPTION 'จำนวนเงินต้องไม่ติดลบและมีทศนิยมไม่เกินสองตำแหน่ง'
   USING ERRCODE='22023';
 END IF;
 -- Protected numbers may only be issued or changed through the registry RPC.$extra$);
 IF updated_text NOT LIKE '%v_tax_satang-(p_meta%' AND
    updated_text NOT LIKE '%ฐานราคา VAT ไม่ตรงกับยอดรวม%' THEN
  RAISE EXCEPTION 'Cannot install VAT consistency guard';
 END IF;
 EXECUTE updated_text;
END $tax_migration$;
