# Trading Journal

A forex trading journal for logging trades, tracking performance, and catching the psychological patterns that quietly wreck accounts. Available as a web app and as an Android APK, both backed by the same account.

## Access

- **Web app:** [trade-journal-three-umber.vercel.app](https://trade-journal-three-umber.vercel.app)
- **Android APK:** download the latest build from the [Releases page](https://github.com/PembaSrpa/trade-journal/releases)

## Getting started

1. Sign up with an email and password.
2. Go to **Settings** and add your first account — give it a name, mark it demo or live, set a currency and starting balance, and optionally a broker and leverage.
3. Log your first trade from **Journal → New**.

You can add as many accounts as you want (demo, live, prop firm, whatever) and switch between them from the account selector. Every trade, notebook entry, and playbook is scoped to one account, so numbers never mix across accounts unless you ask for that on purpose.

## Accounts

Each account tracks its own balance, currency, and trade history independently. Two accounts of the same type can be viewed together:

- **All demo accounts** — combined stats across every demo account.
- **All funded accounts** — combined stats across every live account.

Combined views are read-only, for **Overview** stats only. To log or edit a trade, or use the notebook, switch to one specific account first.

Archiving an account hides it from the switcher but keeps its full trade history. Deleting an account removes it and every trade in it permanently — there's no undo.

## Logging a trade

The **New Trade** form is one screen, split into sections:

- **Trade details** — pair, direction (long/short), entry and exit price, entry and exit time. Hold duration is calculated automatically once both times are set.
- **Psychology** — your emotional state going in (calm, confident, anxious, FOMO, revenge, etc.) and a 1–5 confidence rating. This is what powers the psychology breakdowns on Overview.
- **Risk & result** — stop loss, take profit, lot size and unit (standard/mini/micro), and how the trade closed (TP hit, SL hit, trailed out, manual close).
- **Playbook** — attach a saved strategy and check off which of its rules you actually followed on this trade.
- **Chart screenshot** — attach an image of the setup, up to 5MB.
- **Reflection & tags** — why you took the trade, what you learned, a setup tag for grouping (e.g. "Pullback EMA"), and any number of freeform tags (e.g. "FOMO", "A+ setup").
- **Followed my trading plan** — a simple yes/no toggle.

P&L, pips, and R-multiple are calculated for you once entry and exit are both filled in — you never enter them by hand.

Trades opened within 30 minutes of a losing trade on the same account are automatically flagged as a **potential revenge trade**, both on the trade itself and in your Overview psychology stats.

## Journal

The **Journal** tab is your trade log. Filter by Today, This week, This month, or a custom date range (pick a specific year, month, or day). Sort newest or oldest first. Each trade card shows the pair, direction, result, session, emotional state, confidence stars, and tags at a glance, with a revenge-trade badge where relevant.

From here you can:
- Open any trade to view full details, edit it, or delete it.
- **Export** your filtered trade list as CSV or PDF for taxes, prop firm reviews, or your own records.

## Overview

Your dashboard. Everything here reflects whichever account (or combined view) you have selected:

- **Top stats** — win rate, net P/L, average R:R, average hold time, max drawdown, open trades.
- **Equity curve** — how your balance has moved over time.
- **Daily P/L calendar** — a calendar heatmap of profit and loss by day.
- **Current balance, expectancy, and profit factor.**
- **Streaks** — current streak, best winning run, worst losing run.
- **Average win vs. average loss.**
- **Best day / worst day** by P&L.
- **By setup** — win rate and net P&L broken down by your setup tags, so you can see which strategies actually make money.
- **Psychology** — win rate by emotional state, win rate by trading session (London / New York / Asia), and a revenge-trade warning banner when applicable.
- **Rule adherence trend** — how consistently you're following your playbook rules over time.
- **Market news** — a live forex/crypto news feed, filterable by category and currency pair, so you can check context around your trades without leaving the app.

## Notebook

A place for anything that isn't tied to a single trade — your pre-market bias, a session recap, general thoughts on the day. Entries are organized by date; pick a date, write, and save. Past entries are listed alongside the editor and can be reopened, edited, or deleted at any time.

## Playbooks

Playbooks are your written trading strategies, broken into individual rules (e.g. "Wait for London open," "Confirm with 15m structure," "Risk no more than 1%"). Create as many as you want per account.

When logging a trade, attach a playbook and check off which rules you followed. This is what feeds the **rule adherence trend** on your Overview — a running measure of how disciplined you're actually being, not just how you feel you're doing.

## Settings

Manage accounts (create, archive, delete) and playbooks for the currently selected account.

## Mobile app (APK)

The Android app is the same product as the web app — same account, same data, same login. Trades logged while offline are saved on your phone and pushed automatically once you're back online, or you can tap **Sync** any time to push and pull the latest data manually. Anything you log shows up on desktop and vice versa.

## Data & exports

- Trade data, notebook entries, and playbooks are private to your account.
- Chart screenshots are stored securely and only accessible via signed URLs tied to your login.
- Trade history can be exported at any time as CSV (for spreadsheets) or PDF (for review/reporting), filtered to whatever date range you're currently viewing in the Journal.