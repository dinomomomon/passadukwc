-- Number on the payment/finance approval memo is handwritten by the finance
-- unit, not assigned by Kru Pasadu. Preserve historical reservations, official
-- registry rows and other document series without recycling any numbers.
CREATE OR REPLACE FUNCTION public.auto_register_procurement_numbers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path=public,pg_temp
AS $function$
BEGIN
 INSERT INTO public.official_number_registry
 (school_id,procurement_id,document_field,series,year_be,serial_no,original_text,status,created_by)
 VALUES(NEW.school_id,NEW.id,'procurement_number',
 CASE WHEN NEW.kind='purchase' THEN 'procurement_purchase' ELSE 'procurement_hire' END,
 NEW.fiscal_year,NEW.document_number,NEW.document_number::text||'/'||NEW.fiscal_year::text,'used',auth.uid());
 PERFORM public.issue_official_number(NEW.id,'memo_number');
 PERFORM public.issue_official_number(NEW.id,'approval_memo_number');
 -- Deliberately no payment_memo_number: finance gives it a number manually.
 RETURN NEW;
END $function$;
