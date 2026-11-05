-- Restore original automatic official number allocation for all three memorandum
-- documents. The FINANCE DATE (not the book number) is handwritten only at print.
-- Existing payments, counters and registry rows are preserved unmodified.
CREATE OR REPLACE FUNCTION public.auto_register_procurement_numbers()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp
AS $function$
BEGIN
 INSERT INTO public.official_number_registry
 (school_id,procurement_id,document_field,series,year_be,serial_no,original_text,status,created_by)
 VALUES(NEW.school_id,NEW.id,'procurement_number',
 CASE WHEN NEW.kind='purchase' THEN 'procurement_purchase' ELSE 'procurement_hire' END,
 NEW.fiscal_year,NEW.document_number,NEW.document_number::text||'/'||NEW.fiscal_year::text,'used',auth.uid());
 PERFORM public.issue_official_number(NEW.id,'memo_number');
 PERFORM public.issue_official_number(NEW.id,'approval_memo_number');
 PERFORM public.issue_official_number(NEW.id,'payment_memo_number');
 RETURN NEW;
END $function$;
