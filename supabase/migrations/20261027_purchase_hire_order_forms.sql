-- Add two original-style order forms to KRU PASADU without changing historical documents.
DO $migration$
DECLARE def text; updated text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='set_procurement_document_meta'
 AND pg_get_function_identity_arguments(p.oid)='p_record_id uuid, p_meta jsonb';
 IF def IS NULL THEN RAISE EXCEPTION 'Cannot find metadata RPC'; END IF;
 updated:=replace(def,
  '''sign_payment_date'',''sign_requisition_date''',
  '''sign_payment_date'',''sign_requisition_date'',''order_vendor_tax_id'',''order_bank_account_number'',''order_bank_account_name'',''order_bank_name'',''order_delivery_days'',''order_delivery_location'',''order_warranty'',''order_penalty_percent'',''order_penalty_min_baht'',''order_vendor_signer_name'',''order_vendor_signer_position'',''order_school_sign_date'',''order_vendor_sign_date''');
 IF def=updated THEN
  IF position('''order_vendor_tax_id''' in def)>0 THEN RETURN; END IF;
  RAISE EXCEPTION 'Metadata allowlist structure changed'; END IF;
 EXECUTE updated;
END $migration$;
ALTER TABLE public.school_document_templates DROP CONSTRAINT IF EXISTS school_document_templates_template_key_check;
ALTER TABLE public.school_document_templates ADD CONSTRAINT school_document_templates_template_key_check
 CHECK(template_key IN ('request','annex','approval','order','acceptance','payment','requisition'));
ALTER TABLE public.school_document_template_versions DROP CONSTRAINT IF EXISTS school_document_template_versions_template_key_check;
ALTER TABLE public.school_document_template_versions ADD CONSTRAINT school_document_template_versions_template_key_check
 CHECK(template_key IN ('request','annex','approval','order','acceptance','payment','requisition'));
DO $migration$
DECLARE def text; updated text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='save_school_document_template'
 AND pg_get_function_identity_arguments(p.oid)='p_school_id uuid, p_template_key text, p_layout jsonb, p_expected_revision integer';
 IF def IS NULL THEN RAISE EXCEPTION 'Cannot find template RPC'; END IF;
 updated:=replace(def,
  '''request'',''annex'',''approval'',''acceptance'',''payment'',''requisition''',
  '''request'',''annex'',''approval'',''order'',''acceptance'',''payment'',''requisition''');
 IF def=updated THEN
  IF position('''order''' in def)>0 THEN RETURN; END IF;
  RAISE EXCEPTION 'Template key allowlist structure changed'; END IF;
 EXECUTE updated;
END $migration$;
