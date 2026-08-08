create table public.notebook_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  entry_date date not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_notebook_account_date on public.notebook_entries(account_id, entry_date);
create index idx_notebook_account_id on public.notebook_entries(account_id);

alter table public.notebook_entries enable row level security;

create policy notebook_owner on public.notebook_entries
  for all using (
    account_id in (select id from public.accounts where user_id = auth.uid())
  );

create trigger notebook_set_updated_at
before update on public.notebook_entries
for each row execute function public.handle_updated_at();
