-- Manual school-specific official A4 headings.
-- Replays the live Supabase validator update without relaxing dynamic/locked fields.
-- The validator may accept only title, legal and second-law text, plus whitelisted
-- heading sizes, alignment and weight. Existing official numbers and signatures
-- remain controlled by their separate database functions.
DO $migration$
DECLARE src text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO src
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='validate_official_template'
   AND pg_get_function_identity_arguments(p.oid)='p_layout jsonb';
 IF src IS NULL THEN
  RAISE EXCEPTION 'Template validator not yet installed; run school templates migrations first';
 END IF;
 IF position('headingStyles' IN src)>0 AND position('legalSecond' IN src)>0 THEN
  RETURN; -- Already applied on the live school database.
 END IF;
 IF position('''title'',''legal'',''decisionText'',''blocks''' IN src)=0
    OR position('ARRAY[''title'',''legal'',''decisionText'']' IN src)=0
    OR position(' FOR item IN SELECT entry.value FROM jsonb_array_elements(' IN src)=0 THEN
  RAISE EXCEPTION 'Unknown template validation version; refusing unsafe migration';
 END IF;
 src:=replace(src,'''title'',''legal'',''decisionText'',''blocks''',
     '''title'',''legal'',''legalSecond'',''headingStyles'',''decisionText'',''blocks''');
 src:=replace(src,'ARRAY[''title'',''legal'',''decisionText'']',
     'ARRAY[''title'',''legal'',''legalSecond'',''decisionText'']');
 src:=replace(src,' FOR item IN SELECT entry.value FROM jsonb_array_elements(',
 ' IF p_layout?''headingStyles'' THEN
   IF jsonb_typeof(p_layout->''headingStyles'')<>''object''
     OR (SELECT count(*) FROM jsonb_object_keys(p_layout->''headingStyles''))>3 THEN
      RAISE EXCEPTION ''รูปแบบหัวกระดาษไม่ถูกต้อง'' USING ERRCODE=''22023'';
   END IF;
   FOR pair IN SELECT * FROM jsonb_each(p_layout->''headingStyles'') LOOP
     IF pair.key NOT IN (''title'',''legal'',''legalSecond'')
      OR jsonb_typeof(pair.value)<>''object''
      OR (SELECT count(*) FROM jsonb_object_keys(pair.value))>3
      OR EXISTS(SELECT 1 FROM jsonb_object_keys(pair.value) fields(f)
                WHERE fields.f NOT IN (''size'',''align'',''bold''))
      OR (pair.value?''size'' AND (jsonb_typeof(pair.value->''size'')<>''number''
        OR (pair.value->>''size'') NOT IN (''12'',''14'',''16'',''18'',''20'',''22'',''24'')))
      OR (pair.value?''align'' AND (jsonb_typeof(pair.value->''align'')<>''string''
        OR (pair.value->>''align'') NOT IN (''left'',''center'',''right'')))
      OR (pair.value?''bold'' AND jsonb_typeof(pair.value->''bold'')<>''boolean'') THEN
       RAISE EXCEPTION ''รูปแบบตัวอักษรหัวกระดาษไม่ถูกต้อง'' USING ERRCODE=''22023'';
     END IF;
   END LOOP;
 END IF;
 FOR item IN SELECT entry.value FROM jsonb_array_elements(');
 EXECUTE src;
END $migration$;
