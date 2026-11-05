
-- School-specific official print templates (draft, published and immutable history).
CREATE TABLE public.school_document_templates (
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 template_key text NOT NULL CHECK(template_key IN ('request','annex','approval','acceptance','payment','requisition')),
 draft jsonb NOT NULL DEFAULT '{}'::jsonb,
 draft_revision integer NOT NULL DEFAULT 0 CHECK (draft_revision>=0),
 published jsonb,
 published_version integer NOT NULL DEFAULT 0 CHECK(published_version>=0),
 updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 published_at timestamptz,
 PRIMARY KEY(school_id,template_key)
);
CREATE TABLE public.school_document_template_versions (
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 template_key text NOT NULL CHECK(template_key IN ('request','annex','approval','acceptance','payment','requisition')),
 version integer NOT NULL CHECK(version>0),
 layout jsonb NOT NULL,
 published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 published_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(school_id,template_key,version)
);
CREATE INDEX template_versions_latest ON public.school_document_template_versions(school_id,template_key,version DESC);
ALTER TABLE public.school_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_document_template_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_document_templates FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.school_document_template_versions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.school_document_templates TO authenticated;
GRANT SELECT ON public.school_document_template_versions TO authenticated;
CREATE POLICY school_template_read ON public.school_document_templates FOR SELECT TO authenticated
 USING (public.is_school_member(school_id));
CREATE POLICY school_template_history_read ON public.school_document_template_versions FOR SELECT TO authenticated
 USING (public.is_school_member(school_id));
-- An immutable list of published editions. Never UPDATE/DELETE this history via the API.
CREATE OR REPLACE FUNCTION public.validate_official_template(p_layout jsonb)
RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE item jsonb; k text;
BEGIN
 IF p_layout IS NULL OR jsonb_typeof(p_layout)<>'object' OR length(p_layout::text)>55000 THEN
  RAISE EXCEPTION 'ข้อมูลแม่แบบไม่ถูกต้องหรือมีขนาดเกิน 55 KB' USING ERRCODE='22023'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_layout) t(k)
    WHERE t.k NOT IN ('title','legal','blocks','order')) THEN
  RAISE EXCEPTION 'พบคุณสมบัติแม่แบบที่ไม่รองรับ' USING ERRCODE='22023'; END IF;
 FOR k IN SELECT unnest(ARRAY['title','legal']) LOOP
  IF p_layout?k AND
     (jsonb_typeof(p_layout->k)<>'string' OR length(p_layout->>k)>400) THEN
     RAISE EXCEPTION 'ข้อความหัวเรื่องยาวเกินไป' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF p_layout?'order' AND (
   jsonb_typeof(p_layout->'order')<>'array' OR jsonb_array_length(p_layout->'order')>60) THEN
   RAISE EXCEPTION 'ลำดับบล็อกไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
 IF p_layout?'blocks' AND (
   jsonb_typeof(p_layout->'blocks')<>'array' OR jsonb_array_length(p_layout->'blocks')>24) THEN
   RAISE EXCEPTION 'เพิ่มบล็อกได้ไม่เกิน 24 บล็อกต่อหน้า' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_layout->'blocks','[]'::jsonb)) LOOP
  IF jsonb_typeof(item)<>'object' OR item->>'type' NOT IN ('paragraph','heading','note','divider')
    OR length(coalesce(item->>'id','')) NOT BETWEEN 1 AND 60
    OR length(coalesce(item->>'text',''))>4000
    OR coalesce(item->>'align','left') NOT IN ('left','center','right')
    OR coalesce(item->>'placement','after-content') NOT IN ('before-content','after-content','before-signatures')
    OR coalesce(item->>'size','16') NOT IN ('12','14','16','18','20','22','24')
    OR jsonb_typeof(item->'text') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'รูปแบบบล็อกแม่แบบไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.validate_official_template(jsonb) FROM PUBLIC,anon;

CREATE OR REPLACE FUNCTION public.save_school_document_template(
 p_school_id uuid,p_template_key text,p_layout jsonb,p_expected_revision integer
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE oldrev integer; nextrev integer;
BEGIN
 IF NOT public.is_school_admin(p_school_id) THEN RAISE EXCEPTION 'เฉพาะแอดมินของโรงเรียนเท่านั้น' USING ERRCODE='42501'; END IF;
 IF p_template_key NOT IN ('request','annex','approval','acceptance','payment','requisition') THEN
  RAISE EXCEPTION 'ประเภทเอกสารไม่ถูกต้อง' USING ERRCODE='22023'; END IF;
 PERFORM public.validate_official_template(p_layout);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_school_id::text||':'||p_template_key,0));
 INSERT INTO public.school_document_templates(school_id,template_key)
 VALUES(p_school_id,p_template_key) ON CONFLICT DO NOTHING;
 SELECT draft_revision INTO oldrev FROM public.school_document_templates
  WHERE school_id=p_school_id AND template_key=p_template_key FOR UPDATE;
 IF oldrev<>p_expected_revision THEN RAISE EXCEPTION 'แม่แบบถูกแก้ไขจากหน้าต่างอื่น กรุณาโหลดข้อมูลใหม่' USING ERRCODE='40001'; END IF;
 UPDATE public.school_document_templates SET draft=p_layout,draft_revision=draft_revision+1,
  updated_by=auth.uid(),updated_at=now()
 WHERE school_id=p_school_id AND template_key=p_template_key RETURNING draft_revision INTO nextrev;
 INSERT INTO public.audit_logs(school_id,actor,action,entity_type,details)
 VALUES(p_school_id,auth.uid(),'school_template_draft_saved','school_document_template',
 jsonb_build_object('key',p_template_key,'revision',nextrev));
 RETURN nextrev;
END $$;
REVOKE ALL ON FUNCTION public.save_school_document_template(uuid,text,jsonb,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_school_document_template(uuid,text,jsonb,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_school_document_template(
 p_school_id uuid,p_template_key text,p_expected_revision integer
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE template_row public.school_document_templates%rowtype; version_no integer;
BEGIN
 IF NOT public.is_school_admin(p_school_id) THEN RAISE EXCEPTION 'เฉพาะแอดมินของโรงเรียนเท่านั้น' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_school_id::text||':'||p_template_key,0));
 SELECT * INTO template_row FROM public.school_document_templates WHERE school_id=p_school_id
  AND template_key=p_template_key FOR UPDATE;
 IF NOT FOUND OR template_row.draft_revision<>p_expected_revision THEN
  RAISE EXCEPTION 'ฉบับร่างมีการเปลี่ยนแปลง กรุณาบันทึกและโหลดใหม่' USING ERRCODE='40001'; END IF;
 PERFORM public.validate_official_template(template_row.draft);
 version_no:=template_row.published_version+1;
 INSERT INTO public.school_document_template_versions(school_id,template_key,version,layout,published_by)
 VALUES(p_school_id,p_template_key,version_no,template_row.draft,auth.uid());
 UPDATE public.school_document_templates SET published=template_row.draft,published_version=version_no,
  published_at=now(),updated_by=auth.uid(),updated_at=now()
 WHERE school_id=p_school_id AND template_key=p_template_key;
 INSERT INTO public.audit_logs(school_id,actor,action,entity_type,details)
 VALUES(p_school_id,auth.uid(),'school_template_published','school_document_template',
 jsonb_build_object('key',p_template_key,'version',version_no));
 RETURN version_no;
END $$;
REVOKE ALL ON FUNCTION public.publish_school_document_template(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.publish_school_document_template(uuid,text,integer) TO authenticated;

-- Pin each document to the published template versions at the moment it leaves
-- the editable draft state; previous signed documents never silently switch.
ALTER TABLE public.procurements ADD COLUMN document_template_versions jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE OR REPLACE FUNCTION public.pin_document_template_versions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE packed jsonb;
BEGIN
 IF OLD.state='draft' AND NEW.state<>'draft' THEN
  SELECT COALESCE(jsonb_object_agg(template_key,to_jsonb(published_version)),'{}'::jsonb)
  INTO packed FROM public.school_document_templates
  WHERE school_id=NEW.school_id AND published_version>0;
  NEW.document_template_versions:=COALESCE(NEW.document_template_versions,'{}'::jsonb)||packed;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER before_procurement_pin_template BEFORE UPDATE OF state ON public.procurements
 FOR EACH ROW EXECUTE FUNCTION public.pin_document_template_versions();

-- Existing non-draft records are intentionally left pinned to the
-- unmodified master document (empty map), preserving historical output.
