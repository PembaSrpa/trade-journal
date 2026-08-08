create table public.playbooks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.playbook_rules (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references public.playbooks(id) on delete cascade,
  rule_text text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.trades
  add column playbook_id uuid references public.playbooks(id) on delete set null,
  add column rule_checks jsonb not null default '{}'::jsonb;

create index idx_playbooks_account_id on public.playbooks(account_id);
create index idx_playbook_rules_playbook_id on public.playbook_rules(playbook_id);
create index idx_trades_playbook_id on public.trades(playbook_id);

alter table public.playbooks enable row level security;
alter table public.playbook_rules enable row level security;

create policy playbooks_owner on public.playbooks
  for all using (
    account_id in (select id from public.accounts where user_id = auth.uid())
  );

create policy playbook_rules_owner on public.playbook_rules
  for all using (
    playbook_id in (
      select p.id from public.playbooks p
      join public.accounts a on a.id = p.account_id
      where a.user_id = auth.uid()
    )
  );
