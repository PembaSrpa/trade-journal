-- Adds asset-class awareness so P&L math stops assuming every trade is a
-- forex pair. Existing rows default to 'forex' so nothing already logged
-- changes value.

alter table public.trades
  add column asset_class text not null default 'forex'
  check (asset_class in ('forex', 'index', 'stock', 'crypto', 'commodity'));

-- lot_unit was forex-only (standard/mini/micro = 100k/10k/1k contract sizes).
-- Index, stock, and crypto trades are sized directly in contracts/shares/coins,
-- so they use 'units' instead (a straight 1:1 multiplier).
alter table public.trades drop constraint if exists trades_lot_unit_check;
alter table public.trades
  add constraint trades_lot_unit_check
  check (lot_unit in ('standard', 'mini', 'micro', 'units'));
