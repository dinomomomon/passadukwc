DROP POLICY IF EXISTS school_members_read_numbers ON public.official_number_registry;
CREATE POLICY school_members_read_numbers ON public.official_number_registry
 FOR SELECT TO authenticated
 USING (EXISTS (
   SELECT 1 FROM public.memberships AS m
   WHERE m.school_id=official_number_registry.school_id
     AND m.user_id=auth.uid() AND m.active=true
 ));