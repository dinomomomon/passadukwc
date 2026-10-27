-- One or more procurement officers per school, without changing historical records or number allocations.
alter table public.schools
  add column if not exists officer_signers jsonb;
alter table public.schools
  add constraint school_officer_signers_array_check
  check (
    officer_signers is null
    or case when jsonb_typeof(officer_signers)='array'
      then jsonb_array_length(officer_signers) between 1 and 30
      else false
    end
  );
comment on column public.schools.officer_signers is
  'School-scoped procurement officer signers [{name,active,is_default}]. NULL means use legacy officer_name. Snapshot to procurements.signers on issue.';

-- The wrapper invokes the existing validated create_procurement RPC in the SAME transaction.
-- This leaves central numbering, subscription checks, and existing document metadata unchanged.
create or replace function public.create_procurement_with_officer(
  p_school_id uuid,
  p_kind text,
  p_fiscal_year integer,
  p_document_date date,
  p_title text,
  p_reason text,
  p_budget_source text,
  p_vendor_name text,
  p_items jsonb,
  p_officer_name text,
  p_department text default '',
  p_method text default 'วิธีเฉพาะเจาะจง (รอตรวจสอบข้อกฎหมาย)',
  p_vendor_address text default '',
  p_inspector_name text default '',
  p_due_date date default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_signers jsonb;
  v_legacy text;
  v_selected text;
  v_accepted boolean := false;
  v_record_id uuid;
begin
  if auth.uid() is null then
    raise exception 'กรุณาเข้าสู่ระบบ' using errcode='42501';
  end if;
  v_selected := trim(coalesce(p_officer_name,''));
  if v_selected='' or length(v_selected)>200 then
    raise exception 'กรุณาเลือกเจ้าหน้าที่พัสดุที่ใช้งานอยู่' using errcode='22023';
  end if;

  select officer_signers, officer_name
    into v_signers, v_legacy
    from public.schools where id = p_school_id;
  if not found then
    raise exception 'ไม่พบข้อมูลโรงเรียน' using errcode='P0002';
  end if;

  if v_signers is null then
    v_accepted := (v_selected = trim(coalesce(v_legacy,'')));
  elsif jsonb_typeof(v_signers)='array' then
    select exists (
      select 1 from jsonb_array_elements(v_signers) as item
      where trim(coalesce(item->>'name',''))=v_selected
        and item->>'active'='true'
    ) into v_accepted;
  end if;

  if not v_accepted then
    raise exception 'เจ้าหน้าที่พัสดุที่เลือกไม่อยู่ในรายชื่อที่เปิดใช้งานของโรงเรียน' using errcode='22023';
  end if;

  -- Membership, subscription quota and sequential numbering are handled by original RPC.
  v_record_id := public.create_procurement(
    p_school_id => p_school_id,
    p_kind => p_kind,
    p_fiscal_year => p_fiscal_year,
    p_document_date => p_document_date,
    p_title => p_title,
    p_reason => p_reason,
    p_budget_source => p_budget_source,
    p_vendor_name => p_vendor_name,
    p_items => p_items,
    p_department => p_department,
    p_method => p_method,
    p_vendor_address => p_vendor_address,
    p_inspector_name => p_inspector_name,
    p_due_date => p_due_date
  );

  update public.procurements
     set signers = jsonb_set(coalesce(signers,'{}'::jsonb),'{officer}',to_jsonb(v_selected),true)
   where id = v_record_id and school_id = p_school_id;

  return v_record_id;
end $function$;

revoke all on function public.create_procurement_with_officer(
  uuid,text,integer,date,text,text,text,text,jsonb,text,text,text,text,text,date
) from public, anon;
grant execute on function public.create_procurement_with_officer(
  uuid,text,integer,date,text,text,text,text,jsonb,text,text,text,text,text,date
) to authenticated;
notify pgrst, 'reload schema';