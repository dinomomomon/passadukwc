-- Permit an additional 15 mm DOWNWARD movement of only the director's
-- request-memo approval, while keeping x, upward and all other signatures
-- at their original +/-15 mm. No existing saved layout is rewritten.
DO $request_signature_limit$
DECLARE
 validator_def text;
 save_def text;
 publish_def text;
 original_text text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO validator_def
 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
 WHERE n.nspname='public' AND p.proname='validate_official_template'
  AND pg_get_function_identity_arguments(p.oid)='p_layout jsonb';
 IF validator_def IS NULL THEN RAISE EXCEPTION 'Template validator is missing'; END IF;
 original_text:=validator_def;
 validator_def:=replace(validator_def,
  'abs((pair.value->>''x'')::numeric)>15 OR abs((pair.value->>''y'')::numeric)>15',
  'abs((pair.value->>''x'')::numeric)>15 OR (pair.key=''director'' AND ((pair.value->>''y'')::numeric < -15 OR (pair.value->>''y'')::numeric > 30)) OR (pair.key<>''director'' AND abs((pair.value->>''y'')::numeric)>15)');
 IF validator_def=original_text THEN RAISE EXCEPTION 'Unknown validator limits; refusing migration'; END IF;

 SELECT pg_get_functiondef(p.oid) INTO save_def
 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
 WHERE n.nspname='public' AND p.proname='save_school_document_template'
  AND pg_get_function_identity_arguments(p.oid)='p_school_id uuid, p_template_key text, p_layout jsonb, p_expected_revision integer';
 IF save_def IS NULL THEN RAISE EXCEPTION 'Save template RPC is missing'; END IF;
 original_text:=save_def;
 save_def:=replace(save_def,
  'PERFORM public.validate_official_template(p_layout);',
  $save_check$PERFORM public.validate_official_template(p_layout);
 IF p_template_key<>'request'
   AND COALESCE((p_layout->'signatureOffsets'->'director'->>'y')::numeric,0)>15 THEN
  RAISE EXCEPTION 'อนุญาตให้เลื่อนลายเซ็นผู้อำนวยการลงเกิน 15 มม. เฉพาะรายงานขอซื้อ/ขอจ้าง'
    USING ERRCODE='22023';
 END IF;$save_check$);
 IF save_def=original_text THEN RAISE EXCEPTION 'Unknown save RPC structure; refusing migration'; END IF;

 SELECT pg_get_functiondef(p.oid) INTO publish_def
 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
 WHERE n.nspname='public' AND p.proname='publish_school_document_template'
  AND pg_get_function_identity_arguments(p.oid)='p_school_id uuid, p_template_key text, p_expected_revision integer';
 IF publish_def IS NULL THEN RAISE EXCEPTION 'Publish template RPC is missing'; END IF;
 original_text:=publish_def;
 publish_def:=replace(publish_def,
  'PERFORM public.validate_official_template(template_row.draft);',
  $publish_check$PERFORM public.validate_official_template(template_row.draft);
 IF p_template_key<>'request'
   AND COALESCE((template_row.draft->'signatureOffsets'->'director'->>'y')::numeric,0)>15 THEN
  RAISE EXCEPTION 'อนุญาตให้เลื่อนลายเซ็นผู้อำนวยการลงเกิน 15 มม. เฉพาะรายงานขอซื้อ/ขอจ้าง'
   USING ERRCODE='22023';
 END IF;$publish_check$);
 IF publish_def=original_text THEN RAISE EXCEPTION 'Unknown publish RPC structure; refusing migration'; END IF;

 EXECUTE validator_def;
 EXECUTE save_def;
 EXECUTE publish_def;
END $request_signature_limit$;
