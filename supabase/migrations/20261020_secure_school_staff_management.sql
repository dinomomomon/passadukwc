-- Route school staff writes through the Supabase Edge Function school-staff.
-- Role and tenant are validated with an authenticated user JWT at the edge.
-- Keep list_school_members callable for the school-admin directory UI.
revoke execute on function public.manage_school_membership(uuid,text,text,boolean)
from public, anon, authenticated;
