CREATE OR REPLACE FUNCTION public.set_procurement_document_meta(p_record_id uuid, p_meta jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      'memo_number','memo_prefix','approval_memo_number','payment_memo_number','inspector_position','order_number','order_date','delivery_date',
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
 if coalesce((p_meta->>'withholding_baht')::numeric,0)+coalesce((p_meta->>'fine_baht')::numeric,0)> (select total_satang/100.0 from public.procurements where id=p_record_id) then
   raise exception 'ยอดหักเกินวงเงินพัสดุ กรุณาตรวจสอบ' using errcode='22023';
 end if;
 if p_meta ? 'payable_baht' and (p_meta->>'payable_baht')::numeric > (select total_satang/100.0 from public.procurements where id=p_record_id) then
   raise exception 'ยอดจ่ายจริงเกินวงเงินพัสดุ กรุณาตรวจสอบ' using errcode='22023';
 end if;
 update public.procurements set document_meta=p_meta,updated_at=now() where id=p_record_id;
 insert into public.audit_logs(school_id,actor,action,entity_type,entity_id,details)
 values(v_school,auth.uid(),'set_procurement_document_meta','procurement',p_record_id,
 jsonb_build_object('fields',(select coalesce(jsonb_agg(key),'[]'::jsonb) from jsonb_object_keys(p_meta) as key)));
end $function$
;
