ALTER TABLE public.procurements DROP CONSTRAINT IF EXISTS procurements_total_satang_check;
ALTER TABLE public.procurements ADD CONSTRAINT procurements_total_satang_check CHECK(total_satang>0);
DO $$
DECLARE def text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='create_procurement';
 IF def IS NULL OR position('if amt<1 or amt>500000 then' in def)=0 THEN RAISE EXCEPTION 'Unexpected create_procurement definition'; END IF;
 def:=replace(def,'if amt<1 or amt>500000 then','if amt<1 then');
 def:=replace(def,'amount exceeds configured 5000 baht limit','amount must be positive');
 EXECUTE def;
 SELECT pg_get_functiondef(p.oid) INTO def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='update_procurement_draft';
 IF def IS NULL OR position('price<1 OR price>500000' in def)=0 OR position('amount<1 OR amount>500000' in def)=0 THEN RAISE EXCEPTION 'Unexpected update_procurement_draft definition'; END IF;
 def:=replace(def,'price<1 OR price>500000','price<1');
 def:=replace(def,'amount<1 OR amount>500000','amount<1');
 def:=replace(def,'วงเงินเกิน 5,000 บาท','วงเงินต้องมากกว่า 0 บาท');
 EXECUTE def;
END $$;