-- Expand permitted stored dates without changing RPC authorization or registry safeguards.
DO $migration$
DECLARE definition text; edited text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='set_procurement_document_meta' AND pg_get_function_identity_arguments(p.oid)='p_record_id uuid, p_meta jsonb';
 IF definition IS NULL THEN RAISE EXCEPTION 'Document metadata RPC not found'; END IF;
 edited:=replace(definition,
 '''finance_note'',''receipt_note'',''acceptance_note''',
 '''finance_note'',''receipt_note'',''acceptance_note'',''sign_request_date'',''sign_annex_date'',''sign_approval_date'',''sign_acceptance_date'',''payment_document_date'',''sign_payment_date'',''sign_requisition_date''');
 IF edited=definition THEN
  IF position('''sign_request_date''' in definition)>0 THEN RETURN; END IF;
  RAISE EXCEPTION 'Metadata allowlist has changed';
 END IF;
 EXECUTE edited;
END $migration$;
