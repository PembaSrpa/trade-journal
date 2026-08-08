create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('demo', 'live')),
  currency text not null default 'USD',
  starting_balance numeric(14,2) not null default 0,
  broker_name text,
  leverage text,
  broker_timezone_offset integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.account_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  type text not null check (type in ('deposit', 'withdrawal', 'correction')),
  amount numeric(14,2) not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  pair text not null,
  direction text not null check (direction in ('long', 'short')),
  status text not null default 'open' check (status in ('open', 'closed')),
  entry_price numeric(14,5) not null,
  exit_price numeric(14,5),
  initial_sl numeric(14,5),
  tp numeric(14,5),
  lot_size numeric(10,2) not null,
  lot_unit text not null default 'standard' check (lot_unit in ('standard', 'mini', 'micro')),
  commission numeric(10,2) not null default 0,
  swap numeric(10,2) not null default 0,
  risk_percent numeric(5,2),
  entry_time timestamptz not null,
  exit_time timestamptz,
  session text check (session in ('london', 'new_york', 'asia')),
  setup_tag text,
  exit_type text check (exit_type in ('tp_hit', 'sl_hit', 'trailed_out', 'manual_close')),
  followed_plan boolean not null default true,
  reasoning text,
  lesson text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trade_screenshots (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

create table public.trade_tags (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  tag text not null
);

create index idx_accounts_user_id on public.accounts(user_id);
create index idx_trades_account_id on public.trades(account_id);
create index idx_trades_entry_time on public.trades(entry_time desc);
create index idx_transactions_account_id on public.account_transactions(account_id);
create index idx_screenshots_trade_id on public.trade_screenshots(trade_id);
create index idx_tags_trade_id on public.trade_tags(trade_id);

alter table public.users enable row level security;
alter table public.accounts enable row level security;
alter table public.account_transactions enable row level security;
alter table public.trades enable row level security;
alter table public.trade_screenshots enable row level security;
alter table public.trade_tags enable row level security;

create policy users_self on public.users
  for all using (id = auth.uid());

create policy accounts_owner on public.accounts
  for all using (user_id = auth.uid());

create policy transactions_owner on public.account_transactions
  for all using (
    account_id in (select id from public.accounts where user_id = auth.uid())
  );

create policy trades_owner on public.trades
  for all using (
    account_id in (select id from public.accounts where user_id = auth.uid())
  );

create policy screenshots_owner on public.trade_screenshots
  for all using (
    trade_id in (
      select t.id from public.trades t
      join public.accounts a on a.id = t.account_id
      where a.user_id = auth.uid()
    )
  );

create policy tags_owner on public.trade_tags
  for all using (
    trade_id in (
      select t.id from public.trades t
      join public.accounts a on a.id = t.account_id
      where a.user_id = auth.uid()
    )
  );

create function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trades_set_updated_at
before update on public.trades
for each row execute function public.handle_updated_at();
