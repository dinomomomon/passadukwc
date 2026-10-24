-- Per-school procurement category labels and request memo prefixes.
-- No updates to existing school rows, past documents or sequential registers.
alter table public.schools add column if not exists procurement_categories jsonb;
alter table public.schools add constraint school_procurement_categories_array_check
 check (procurement_categories is null or
  case when jsonb_typeof(procurement_categories) = 'array'
   then jsonb_array_length(procurement_categories) between 1 and 10
  else false end);
comment on column public.schools.procurement_categories is
 'School-admin-configured purchasing categories [{name,prefix}]. NULL uses legacy two-category defaults. Existing document numbers are never rewritten.';
