# Trading Journal

A personal trading journal that runs **entirely on your device** — no account, no server, no sign-in, no internet.
Log trades, track performance, and spot psychological patterns (revenge trading, emotion vs. outcome, rule adherence).
It ships as a static website and as an Android app (Capacitor) from the same code.

## How your data is stored
- Everything lives in the browser/WebView's **IndexedDB** on your device. Nothing is uploaded anywhere.
- Because there is no server, **clearing the app's data or uninstalling it deletes the journal.** Use
  **Settings → Backup & privacy → Export backup** regularly (the app reminds you if it's been over 30 days).

### Export / import
- **Export backup** creates one `trading-journal-backup-YYYY-MM-DD.json` containing accounts, trades, playbooks,
  notebook entries, deposits/withdrawals and chart screenshots (embedded). On Android it opens the share sheet
  (save to Drive/Files, email it to yourself, etc.); on the web it downloads.
- **Import backup** validates the file first (bad files change nothing), then asks:
  - **Merge** — adds only what's missing. Existing records are never overwritten or duplicated, so it's safe to run twice.
  - **Replace everything** — wipes this device's data and loads the backup. If writing fails partway, your previous data is restored.
- Use export → import to move to a new phone or keep a safety copy.

## Features
- Accounts (demo/live), trades across forex, indices, stocks, crypto and commodities, tags, playbooks with rule checklists, notebook, chart screenshots.
- Overview: equity curve, daily P/L calendar, win rate, expectancy, profit factor, drawdown, streaks, setup / emotion / session breakdowns, rule-adherence trend, revenge-trade detection.
- Journal export to **CSV** and **PDF** (generated on-device, respects the selected date range).
- Optional **PIN lock** (a privacy screen; it does not encrypt stored data).
- Optional **market news** — the only online feature. Paste a free Finnhub API key in Settings; without it the panel just says it's optional.

## How numbers are computed
- **Pips / P&L:** forex P&L is `pips × pip value`; pip = 0.0001 (0.01 for JPY pairs, metals and oil). Indices, stocks and crypto use `price move × quantity`.
- **Currency conversion:** forex/commodity P&L is first in the pair's quote currency, then converted to the account currency:
  quote = account currency → as is; base = account currency (e.g. USD/JPY on a USD account) → divided by the exit price;
  otherwise (e.g. EUR/GBP on a USD account) → multiplied by the trade's **Conversion rate** field. Without a rate the trade is
  flagged **unconverted** (badge in the Journal, a note on the Overview) instead of silently mixing currencies. Commission and swap are
  entered in account currency and are not converted.
- **Win rate** excludes breakeven trades (shown separately); **expectancy** counts them as zero outcomes.
- **Sessions** use the entry's UTC hour: Asia 21:00–07:00, London 07:00–12:00, New York 12:00–21:00 (the London/NY overlap counts as New York; daylight-saving shifts are not modelled).
- **Revenge trade:** opened within 30 minutes of the exit of the previous closed trade, if that trade lost (per account).
- **Date ranges:** a trade belongs to the period it was *opened* in. With a range selected the equity curve starts from the balance at the range start (starting balance + everything before it) and drawdown is measured inside the range.
- Clearing a trade's exit price re-opens it.