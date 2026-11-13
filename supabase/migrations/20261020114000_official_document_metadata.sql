-- Consistent with the live Supabase migration "add_official_document_metadata_and_guarded_save".
-- Optional government-form values must come from records, never generated as fictional evidence.
alter table public.schools add column if not exists memo_prefix text not null default '';
alter table public.schools add column if not exists address text not null default '';
alter table public.procurements add column if not exists document_meta jsonb not null default '{}'::jsonb;
comment on column public.procurements.document_meta is 'Optional evidence and numbering fields for official purchase/hire paper templates; no inferred approval or receipts';

create or replace function public.set_procurement_document_meta(p_record_id uuid,p_meta jsonb)
returns void language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_school uuid; v_key text; v_value jsonb; v_role text;
begin
 if auth.uid() is null then raise exception 'unauthenticated' using errcode='42501'; end if;
 if p_meta is null or jsonb_typeof(p_meta)<>'object' or length(p_meta::text)>14000 then
    raise exception 'invalid document metadata' using errcode='22023';
 end if;
 select p.school_id into v_school from public.procurements p
   where p.id=p_record_id and (p.created_by=auth.uid() or exists
    (select 1 from public.memberships m where m.school_id=p.school_id and m.user_id=auth.uid() and m.active and m.role in ('school_admin','procurement_head')))
   for update;
 if v_school is null then raise exception 'not authorized for record' using errcode='42501'; end if;
 select role into v_role from public.memberships where school_id=v_school and user_id=auth.uid() and active;
 if v_role not in ('school_admin','procurement_officer','procurement_head') then
   raise exception 'not authorized for school' using errcode='42501';
 end if;
 for v_key,v_value in select key,value from jsonb_each(p_meta) loop
   if v_key <> all(array[
      'memo_number','inspector_position','order_number','order_date','delivery_date',
      'inspection_date','invoice_number','invoice_date','acceptance_number','acceptance_date',
      'requisition_number','requisition_date','receipt_number','receipt_date','inspection_location',
      'inspection_expert','requester_name','requester_position','issuer_name','issuer_position',
      'receiver_name','receiver_position','delegate_name','budget_year','budget_plan',
      'budget_activity','budget_project','budget_total_baht','budget_paid_baht',
      'vat_baht','withholding_baht','fine_baht','payable_baht','item_base_baht',
      'finance_note','receipt_note','acceptance_note'
   ]) or jsonb_typeof(v_value) not in ('string','null','number') or length(v_value::text)>650 then
     raise exception 'invalid metadata field %',v_key using errcode='22023';
   end if;
 end loop;
 update public.procurements set document_meta=p_meta,updated_at=now() where id=p_record_id;
 insert into public.audit_logs(school_id,actor,action,entity_type,entity_id,details)
 values(v_school,auth.uid(),'set_procurement_document_meta','procurement',p_record_id,
 jsonb_build_object('fields',(select coalesce(jsonb_agg(key),'[]'::jsonb) from jsonb_object_keys(p_meta) as key)));
end $$;
revoke all on function public.set_procurement_document_meta(uuid,jsonb) from public,anon;
grant execute on function public.set_procurement_document_meta(uuid,jsonb) to authenticated;
