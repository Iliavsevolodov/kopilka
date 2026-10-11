create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  currency text not null default 'RUB' check (char_length(currency)=3),
  timezone text not null default 'Europe/Moscow',
  locale text not null default 'ru-RU',
  onboarding_completed boolean not null default false,
  monthly_income_target_minor bigint not null default 0,
  emergency_fund_months numeric(5,2) not null default 3 check (emergency_fund_months>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('card','bank_account','cash','savings','deposit','investment','wallet','other')),
  currency text not null default 'RUB' check (char_length(currency)=3),
  current_balance_minor bigint not null default 0,
  include_in_total boolean not null default true,
  icon text,
  color text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('expense','income')),
  name text not null,
  icon text,
  parent_id uuid references public.categories(id) on delete set null,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id,kind,name)
);

create table if not exists public.recurring_transaction_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('expense','income')),
  name text not null,
  amount_minor bigint not null check (amount_minor>0),
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid not null references public.accounts(id) on delete restrict,
  frequency text not null check (frequency in ('daily','weekly','monthly','yearly')),
  interval_value integer not null default 1 check (interval_value>0),
  day_of_month smallint check (day_of_month between 1 and 31),
  day_of_week smallint check (day_of_week between 0 and 6),
  start_date date not null,
  end_date date,
  next_occurrence timestamptz not null,
  auto_confirm boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  destination_account_id uuid references public.accounts(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  type text not null check (type in ('expense','income','transfer','adjustment')),
  amount_minor bigint not null check (amount_minor>0),
  currency text not null check (char_length(currency)=3),
  transaction_date timestamptz not null default now(),
  description text,
  notes text,
  is_impulsive boolean not null default false,
  is_mandatory boolean not null default false,
  recurring_template_id uuid references public.recurring_transaction_templates(id) on delete set null,
  source text not null default 'manual' check (source in ('manual','csv','bank_api','recurring','planned')),
  external_transaction_id text,
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((type='transfer' and destination_account_id is not null and destination_account_id<>account_id) or (type<>'transfer' and destination_account_id is null))
);
create unique index if not exists transactions_external_source_unique on public.transactions(user_id,source,external_transaction_id) where external_transaction_id is not null;

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  amount_minor bigint not null check (amount_minor>0),
  period text not null default 'monthly' check (period in ('weekly','monthly','yearly')),
  starts_on date not null default current_date,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount_minor bigint not null check (target_amount_minor>0),
  current_amount_minor bigint not null default 0 check (current_amount_minor>=0),
  target_date date,
  priority smallint not null default 2 check (priority between 1 and 3),
  account_id uuid references public.accounts(id) on delete set null,
  icon text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.financial_goals(id) on delete cascade,
  amount_minor bigint not null check (amount_minor>0),
  contributed_at timestamptz not null default now(),
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.planned_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('expense','income')),
  amount_minor bigint not null check (amount_minor>0),
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  planned_for timestamptz not null,
  description text,
  status text not null default 'planned' check (status in ('planned','confirmed','skipped','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounts_user_id_idx on public.accounts(user_id);
create index if not exists categories_user_id_idx on public.categories(user_id);
create index if not exists transactions_user_date_idx on public.transactions(user_id,transaction_date desc);
create index if not exists transactions_category_idx on public.transactions(category_id);
create index if not exists transactions_account_idx on public.transactions(account_id);
create index if not exists recurring_user_next_idx on public.recurring_transaction_templates(user_id,next_occurrence);
create index if not exists goals_user_id_idx on public.financial_goals(user_id);
create index if not exists budgets_user_id_idx on public.budgets(user_id);
create index if not exists planned_user_date_idx on public.planned_transactions(user_id,planned_for);

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.recurring_transaction_templates enable row level security;
alter table public.budgets enable row level security;
alter table public.financial_goals enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.planned_transactions enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid())=id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid())=id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);

create policy "accounts_select_own" on public.accounts for select to authenticated using ((select auth.uid())=user_id);
create policy "accounts_insert_own" on public.accounts for insert to authenticated with check ((select auth.uid())=user_id);
create policy "accounts_update_own" on public.accounts for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create policy "categories_select_own" on public.categories for select to authenticated using ((select auth.uid())=user_id);
create policy "categories_insert_own" on public.categories for insert to authenticated with check ((select auth.uid())=user_id);
create policy "categories_update_own" on public.categories for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create policy "transactions_select_own" on public.transactions for select to authenticated using ((select auth.uid())=user_id);
create policy "transactions_insert_own" on public.transactions for insert to authenticated with check ((select auth.uid())=user_id);
create policy "transactions_update_own" on public.transactions for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create policy "recurring_select_own" on public.recurring_transaction_templates for select to authenticated using ((select auth.uid())=user_id);
create policy "recurring_insert_own" on public.recurring_transaction_templates for insert to authenticated with check ((select auth.uid())=user_id);
create policy "recurring_update_own" on public.recurring_transaction_templates for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create policy "budgets_select_own" on public.budgets for select to authenticated using ((select auth.uid())=user_id);
create policy "budgets_insert_own" on public.budgets for insert to authenticated with check ((select auth.uid())=user_id);
create policy "budgets_update_own" on public.budgets for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create policy "goals_select_own" on public.financial_goals for select to authenticated using ((select auth.uid())=user_id);
create policy "goals_insert_own" on public.financial_goals for insert to authenticated with check ((select auth.uid())=user_id);
create policy "goals_update_own" on public.financial_goals for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create policy "goal_contributions_select_own" on public.goal_contributions for select to authenticated using ((select auth.uid())=user_id);
create policy "goal_contributions_insert_own" on public.goal_contributions for insert to authenticated with check ((select auth.uid())=user_id);

create policy "planned_select_own" on public.planned_transactions for select to authenticated using ((select auth.uid())=user_id);
create policy "planned_insert_own" on public.planned_transactions for insert to authenticated with check ((select auth.uid())=user_id);
create policy "planned_update_own" on public.planned_transactions for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create or replace function public.create_financial_transaction(
 p_type text,p_amount_minor bigint,p_account_id uuid,p_destination_account_id uuid default null,p_category_id uuid default null,p_currency text default 'RUB',p_description text default null,p_notes text default null,p_is_impulsive boolean default false,p_is_mandatory boolean default false
) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_user_id uuid:=auth.uid();v_transaction_id uuid;
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 if p_amount_minor<=0 then raise exception 'Amount must be positive'; end if;
 if p_type not in ('expense','income','transfer') then raise exception 'Unsupported transaction type'; end if;
 if not exists(select 1 from public.accounts where id=p_account_id and user_id=v_user_id and is_archived=false) then raise exception 'Source account not found'; end if;
 if p_category_id is not null and not exists(select 1 from public.categories where id=p_category_id and user_id=v_user_id) then raise exception 'Category not found'; end if;
 if p_type='expense' then
   update public.accounts set current_balance_minor=current_balance_minor-p_amount_minor,updated_at=now() where id=p_account_id and user_id=v_user_id;
 elsif p_type='income' then
   update public.accounts set current_balance_minor=current_balance_minor+p_amount_minor,updated_at=now() where id=p_account_id and user_id=v_user_id;
 elsif p_type='transfer' then
   if p_destination_account_id is null or p_destination_account_id=p_account_id then raise exception 'Valid destination account required'; end if;
   if not exists(select 1 from public.accounts where id=p_destination_account_id and user_id=v_user_id and is_archived=false) then raise exception 'Destination account not found'; end if;
   update public.accounts set current_balance_minor=current_balance_minor-p_amount_minor,updated_at=now() where id=p_account_id and user_id=v_user_id;
   update public.accounts set current_balance_minor=current_balance_minor+p_amount_minor,updated_at=now() where id=p_destination_account_id and user_id=v_user_id;
 end if;
 insert into public.transactions(user_id,account_id,destination_account_id,category_id,type,amount_minor,currency,description,notes,is_impulsive,is_mandatory,source)
 values(v_user_id,p_account_id,case when p_type='transfer' then p_destination_account_id else null end,case when p_type='transfer' then null else p_category_id end,p_type,p_amount_minor,upper(p_currency),nullif(trim(p_description),''),nullif(trim(p_notes),''),p_is_impulsive,p_is_mandatory,'manual')
 returning id into v_transaction_id;
 return v_transaction_id;
end $$;

revoke all on function public.create_financial_transaction(text,bigint,uuid,uuid,uuid,text,text,text,boolean,boolean) from public;
revoke all on function public.create_financial_transaction(text,bigint,uuid,uuid,uuid,text,text,text,boolean,boolean) from anon;
grant execute on function public.create_financial_transaction(text,bigint,uuid,uuid,uuid,text,text,text,boolean,boolean) to authenticated;

grant usage on schema public to authenticated;
grant select,insert,update on public.profiles,public.accounts,public.categories,public.transactions,public.recurring_transaction_templates,public.budgets,public.financial_goals,public.planned_transactions to authenticated;
grant select,insert on public.goal_contributions to authenticated;
