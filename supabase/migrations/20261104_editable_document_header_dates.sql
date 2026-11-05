-- Add editable document *display* header dates without changing original
-- procurement.document_date, its historical registry number, sign-offs or auth.
DO $header_dates$
DECLARE original_def text; patched_def text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO original_def
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='set_procurement_document_meta'
 AND pg_get_function_identity_arguments(p.oid)='p_record_id uuid, p_meta jsonb';
 IF original_def IS NULL THEN RAISE EXCEPTION 'Missing procurement metadata RPC'; END IF;
 patched_def:=replace(original_def,
 '''sign_request_date'',''sign_annex_date'',''sign_approval_date'',''sign_acceptance_date''',
 '''request_document_date'',''annex_document_date'',''approval_document_date'',''sign_request_date'',''sign_annex_date'',''sign_approval_date'',''sign_acceptance_date''');
 IF patched_def=original_def THEN
   IF position('''request_document_date''' in original_def)>0 THEN RETURN; END IF;
   RAISE EXCEPTION 'Unexpected metadata allowlist structure; migration not applied';
 END IF;
 EXECUTE patched_def;
END $header_dates$;
