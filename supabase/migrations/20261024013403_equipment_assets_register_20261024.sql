-- KRU PASADU: tenant-isolated equipment asset register (no changes to legacy procurement tables).
create table if not exists public.asset_policies(
 school_id uuid primary key references public.schools(id) on delete cascade,
 capitalization_threshold_satang bigint not null default 1000000 check(capitalization_threshold_satang>=0),
 policy_confirmed boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id)
);
create table if not exists public.asset_categories(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 100),
 code_prefix text not null check(length(btrim(code_prefix)) between 1 and 24),
 suggested_life_months integer not null default 60 check(suggested_life_months between 1 and 600),
 created_at timestamptz not null default now(),
 unique(school_id,id),
 unique(school_id,name),
 unique(school_id,code_prefix)
);
create table if not exists public.equipment_assets(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete restrict,
 asset_code text not null check(length(btrim(asset_code)) between 1 and 80),
 name text not null check(length(btrim(name)) between 1 and 250),
 category_id uuid,
 serial_number text not null default '',
 acquired_on date not null,
 placed_in_service_on date not null,
 cost_satang bigint not null check(cost_satang > 0 and cost_satang <= 10000000000000),
 salvage_satang bigint not null default 0 check(salvage_satang>=0 and salvage_satang<=cost_satang),
 useful_life_months integer not null check(useful_life_months between 1 and 600),
 accounting_class text not null default 'controlled' check(accounting_class in ('capitalized','controlled')),
 asset_status text not null default 'active' check(asset_status in ('active','repair','transferred','disposed','lost')),
 location text not null default '',
 responsible_person text not null default '',
 source_procurement_id uuid references public.procurements(id) on delete set null,
 source_item_index integer check(source_item_index is null or source_item_index >= 0),
 source_unit_index integer check(source_unit_index is null or source_unit_index >= 1),
 notes text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid not null default auth.uid() references auth.users(id),
 updated_by uuid references auth.users(id),
 unique(school_id,asset_code),
 foreign key(school_id,category_id) references public.asset_categories(school_id,id)
);
create unique index if not exists equipment_source_unit_unique on public.equipment_assets(school_id,source_procurement_id,source_item_index,source_unit_index) where source_procurement_id is not null and source_item_index is not null and source_unit_index is not null;
create index if not exists equipment_assets_school_date on public.equipment_assets(school_id,acquired_on desc);
create index if not exists equipment_assets_school_status on public.equipment_assets(school_id,asset_status);
create index if not exists equipment_assets_school_category on public.equipment_assets(school_id,category_id);
create index if not exists equipment_assets_source_id on public.equipment_assets(source_procurement_id);
create table if not exists public.equipment_asset_history(
 id bigint generated always as identity primary key,
 school_id uuid not null references public.schools(id) on delete restrict,
 asset_id uuid not null references public.equipment_assets(id) on delete restrict,
 changed_by uuid references auth.users(id),
 changed_at timestamptz not null default now(),
 event_kind text not null check(event_kind in ('created','updated')),
 old_record jsonb,
 new_record jsonb not null
);
create index if not exists equipment_history_school_asset on public.equipment_asset_history(school_id,asset_id,changed_at desc);

create or replace function public.asset_guard_and_audit() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_allowed boolean;
begin
 v_allowed := exists(select 1 from public.memberships m
   where m.school_id=new.school_id and m.user_id=auth.uid() and m.active
   and m.role in ('school_admin','procurement_officer','procurement_head'));
 if not v_allowed then raise exception 'ไม่มีสิทธิ์จัดการทะเบียนครุภัณฑ์'; end if;
 if tg_op='UPDATE' and (new.school_id is distinct from old.school_id or new.created_by is distinct from old.created_by or new.id is distinct from old.id)
 then raise exception 'ไม่อนุญาตให้เปลี่ยนโรงเรียนหรือเจ้าของข้อมูล'; end if;
 if new.source_procurement_id is not null and not exists(select 1 from public.procurements p
   where p.id=new.source_procurement_id and p.school_id=new.school_id and p.deleted_at is null)
 then raise exception 'รายการจัดซื้ออ้างอิงต้องอยู่ในโรงเรียนเดียวกัน'; end if;
 if tg_op='INSERT' then
   new.created_by:=auth.uid();new.updated_by:=auth.uid();
 else new.updated_by:=auth.uid();end if;
 new.updated_at:=now();
 insert into public.equipment_asset_history(school_id,asset_id,changed_by,event_kind,old_record,new_record)
 values(new.school_id,new.id,auth.uid(),case when tg_op='INSERT' then 'created' else 'updated' end,
 case when tg_op='INSERT' then null else to_jsonb(old) end,to_jsonb(new));
 return new;
end $$;
-- History FK is initially checked before insert trigger fires; row insertion is not yet visible to it.
-- Replace with an AFTER audit trigger and a separate BEFORE validation trigger.
create or replace function public.asset_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.memberships m where m.school_id=new.school_id and m.user_id=auth.uid()
   and m.active and m.role in ('school_admin','procurement_officer','procurement_head'))
 then raise exception 'ไม่มีสิทธิ์จัดการทะเบียนครุภัณฑ์'; end if;
 if tg_op='UPDATE' and (new.school_id is distinct from old.school_id or new.created_by is distinct from old.created_by or new.id is distinct from old.id)
 then raise exception 'ไม่อนุญาตให้เปลี่ยนโรงเรียนหรือเจ้าของข้อมูล'; end if;
 if new.source_procurement_id is not null and not exists(select 1 from public.procurements p
    where p.id=new.source_procurement_id and p.school_id=new.school_id and p.deleted_at is null)
 then raise exception 'รายการจัดซื้ออ้างอิงต้องอยู่ในโรงเรียนเดียวกัน'; end if;
 if tg_op='INSERT' then new.created_by:=auth.uid();end if;
 new.updated_by:=auth.uid();new.updated_at:=now();
 return new;
end $$;
create or replace function public.asset_history_writer() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.equipment_asset_history(school_id,asset_id,changed_by,event_kind,old_record,new_record)
 values(new.school_id,new.id,auth.uid(),case when tg_op='INSERT' then 'created' else 'updated' end,
 case when tg_op='INSERT' then null else to_jsonb(old) end,to_jsonb(new));
 return null;
end $$;
drop trigger if exists equipment_guard_trigger on public.equipment_assets;
create trigger equipment_guard_trigger before insert or update on public.equipment_assets for each row execute function public.asset_guard();
drop trigger if exists equipment_history_trigger on public.equipment_assets;
create trigger equipment_history_trigger after insert or update on public.equipment_assets for each row execute function public.asset_history_writer();
drop function if exists public.asset_guard_and_audit();

alter table public.asset_policies enable row level security;
alter table public.asset_categories enable row level security;
alter table public.equipment_assets enable row level security;
alter table public.equipment_asset_history enable row level security;
create policy "asset policy school members read" on public.asset_policies for select to authenticated using(public.is_school_member(school_id));
create policy "asset policy admin insert" on public.asset_policies for insert to authenticated with check(public.is_school_admin(school_id));
create policy "asset policy admin edit" on public.asset_policies for update to authenticated using(public.is_school_admin(school_id)) with check(public.is_school_admin(school_id));
create policy "asset categories members read" on public.asset_categories for select to authenticated using(public.is_school_member(school_id));
create policy "asset categories admin insert" on public.asset_categories for insert to authenticated with check(public.is_school_admin(school_id));
create policy "asset categories admin edit" on public.asset_categories for update to authenticated using(public.is_school_admin(school_id)) with check(public.is_school_admin(school_id));
create policy "asset records members read" on public.equipment_assets for select to authenticated using(public.is_school_member(school_id));
create policy "asset records staff insert" on public.equipment_assets for insert to authenticated with check(
 exists(select 1 from public.memberships m where m.school_id=equipment_assets.school_id and m.user_id=auth.uid() and m.active and m.role in ('school_admin','procurement_officer','procurement_head')));
create policy "asset records staff edit" on public.equipment_assets for update to authenticated using(
 exists(select 1 from public.memberships m where m.school_id=equipment_assets.school_id and m.user_id=auth.uid() and m.active and m.role in ('school_admin','procurement_officer','procurement_head')))
 with check(exists(select 1 from public.memberships m where m.school_id=equipment_assets.school_id and m.user_id=auth.uid() and m.active and m.role in ('school_admin','procurement_officer','procurement_head')));
create policy "asset history members read" on public.equipment_asset_history for select to authenticated using(public.is_school_member(school_id));
-- Client cannot insert audit rows or delete assets, categories or policies.
revoke all on public.asset_policies,public.asset_categories,public.equipment_assets,public.equipment_asset_history from anon;
grant select,insert,update on public.asset_policies,public.asset_categories,public.equipment_assets to authenticated;
grant select on public.equipment_asset_history to authenticated;
revoke all on function public.asset_guard(),public.asset_history_writer() from public,anon,authenticated;
comment on table public.equipment_assets is 'Equipment register by school. Each row describes one physical item. Accounting depreciation is computed client-side from configured policy, not loss compensation.';
