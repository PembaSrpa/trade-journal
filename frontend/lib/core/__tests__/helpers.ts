import type { Account, StoredTrade } from "../../types";

let n = 0;
export function trade(over: Partial<StoredTrade> = {}): StoredTrade {
  n++;
  return {
    id: over.id ?? `t${n}`,
    account_id: "a1",
    pair: "EUR/USD",
    asset_class: "forex",
    direction: "long",
    status: "closed",
    entry_price: 1.0,
    exit_price: 1.01,
    initial_sl: null,
    tp: null,
    lot_size: 1,
    lot_unit: "standard",
    commission: 0,
    swap: 0,
    risk_percent: null,
    conversion_rate: null,
    entry_time: "2026-07-28T10:00:00.000Z",
    exit_time: "2026-07-28T11:00:00.000Z",
    session: null,
    setup_tag: null,
    exit_type: null,
    followed_plan: true,
    reasoning: null,
    lesson: null,
    screenshot_url: null,
    tags: [],
    playbook_id: null,
    rule_checks: {},
    emotional_state: null,
    confidence_score: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

export function account(over: Partial<Account> = {}): Account {
  return {
    id: "a1",
    name: "Main",
    type: "demo",
    currency: "USD",
    starting_balance: 10000,
    broker_name: null,
    leverage: null,
    broker_timezone_offset: 0,
    is_archived: false,
    created_at: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}
