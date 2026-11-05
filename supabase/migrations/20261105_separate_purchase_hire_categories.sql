-- Independently configurable hiring document prefixes per school.
-- Existing purchasing categories and issued document metadata are untouched.
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS procurement_hire_categories jsonb NOT NULL
  DEFAULT '[{"name":"งานจ้างทั่วไป","prefix":"พจ"}]'::jsonb;

DO $$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid='public.schools'::regclass
    AND conname='schools_hire_categories_are_array'
 ) THEN
  ALTER TABLE public.schools
   ADD CONSTRAINT schools_hire_categories_are_array
   CHECK(jsonb_typeof(procurement_hire_categories)='array');
 END IF;
END $$;
COMMENT ON COLUMN public.schools.procurement_hire_categories IS
 'School-admin configured hiring categories and memo prefixes; independent of procurement_categories for purchases.';
