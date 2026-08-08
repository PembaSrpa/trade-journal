alter table public.trades
  add column emotional_state text check (
    emotional_state in (
      'confident', 'calm', 'disciplined', 'fomo', 'greedy',
      'anxious', 'hesitant', 'revenge', 'bored'
    )
  ),
  add column confidence_score smallint check (confidence_score between 1 and 5);

create index idx_trades_emotional_state on public.trades(emotional_state);
