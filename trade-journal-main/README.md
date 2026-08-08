# Trading Journal — Step 11: Design Overhaul + Security Patches

Builds on steps 1–10. This was a real rebuild of the frontend's look and feel, not a color pass — several things were flagged as promised-but-not-delivered (full-bleed starfield, scroll/pinch date zoom) and got fixed properly, plus the layout itself was restructured since the old top-bar-and-narrow-column layout wasted horizontal space and looked broken on desktop.

## Visual/structural changes

- **Sidebar navigation** replaces the old cramped top bar — fixed left sidebar on desktop with icons, an animated active-state indicator (Framer Motion `layoutId`), account switcher, sync, and sign out. Collapses to a bottom tab bar on mobile instead of disappearing.
- **Full-bleed starfield** on login/signup — this was promised early on and shipped as a small boxed-in card instead. Now it's a real fixed full-viewport background with 180 twinkling stars and drifting shooting-star trails, with the auth form floating as a glass panel on top.
- **Wider, responsive content area** — main content now scales up to `max-w-5xl` with responsive grid columns (2 → 3 → 6 on stat cards) instead of a fixed narrow `max-w-2xl` column that looked cut off on a full monitor.
- **Real scroll-wheel and pinch-to-zoom** on the Journal date picker — this was speced early on, then shipped as +/- buttons instead. Desktop now zooms granularity with the mouse wheel, mobile with a real two-finger pinch gesture (tracked via touch events), buttons remain as a visible/accessible fallback.
- **Entry form redesigned** into distinct visual sections (trade details, risk & result, playbook, screenshot, reflection, tags) with icons and a large editable pair/price display, instead of one long flat list of fields.
- **Journal defaults to "Today"** instead of "This month."
- **Notebook truncation loosened** — was hard-capped at 2 lines (`line-clamp-2`), now shows 6 lines with an explicit "Show more" toggle for longer entries.
- **News pairs expanded** from 4 hardcoded options to 29 — all majors, most minors, and several popular exotics (USD/ZAR, USD/TRY, USD/MXN, USD/SGD).
- **Account deletion added** alongside archive, with a confirmation dialog and inline copy explaining the difference (archive hides but keeps history, delete is permanent and removes every trade in the account).

## Real bugs found while verifying this pass

Same discipline as steps 6 and 9 — every change below was caught by actually running `npm install` and `npm run build`, not by reading the diff.

- **`lucide-react@0.383.0`'s peer dependency didn't support React 19** — the pinned icon library version was incompatible with this project's React version, which would have blocked `npm install` entirely for anyone following the setup instructions. Bumped to `1.28.0`.
- **Critical: Next.js was pinned to a version with a CVSS 10.0 remote-code-execution vulnerability** (CVE-2025-66478, and two follow-up CVEs from an incomplete initial fix). `npm install` itself printed the security warning. Next.js was bumped from `15.1.3` to the latest stable `15.5.22`, which is past all known fixes in the 15.x line as of this build. React and its type definitions were bumped alongside it (`19.0.0` → `19.2.8`), since the same CVE chain required a patched React version too.
- **No ESLint configuration existed** despite a `lint` script being present in `package.json` — running it would have failed for you. Added `eslint` + `eslint-config-next` and a working `.eslintrc.json`.
- **A real stale-closure bug in `PlaybookManager.tsx`** — its `useEffect` called a `refresh` function without listing it as a dependency, which ESLint's `react-hooks/exhaustive-deps` rule correctly flagged. Fixed with `useCallback`.
- **An unescaped apostrophe** in journal empty-state copy that broke `npm run lint` outright (`react/no-unescaped-entities`).

## Verification performed

- `npm install` — completed cleanly with zero dependency conflicts and zero security warnings after the above fixes
- `npm run build` — full production build succeeded, all 12 routes compiled, TypeScript type-checked cleanly across every file touched in this pass (the Google Fonts step fails in this sandboxed build environment specifically because outbound network access is restricted to package registries, not because of any code issue — confirmed by temporarily swapping to a system font, rebuilding successfully, then restoring the real font)
- `npm run lint` — down to a single benign warning (using a plain `<img>` for signed, expiring screenshot URLs rather than `next/image`, which is a deliberate tradeoff since those URLs change host per Supabase project and expire hourly, not worth the domain-allowlist complexity)
- Backend test suite re-run to confirm this frontend-only pass didn't affect it — 47 passed, unchanged

## Setup



Run all four migrations in order: `0001_init.sql`, `0002_storage.sql`, `0003_notebook.sql`, `0004_playbooks.sql`. Everything else is unchanged from before.



Same as before — Supabase migrations (both files), frontend `.env.local` + `npm install`, backend `.env` + `pip install`. Full walkthrough:

### 1. Supabase project
1. Create a project at supabase.com
2. Run `supabase/migrations/0001_init.sql`, then `0002_storage.sql`
3. Disable "Confirm email" in Authentication settings
4. Collect Project URL, anon key, service role key, JWT secret

### 2. Frontend
```
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

### 3. Backend
```
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Get a free Finnhub API key for `FINNHUB_API_KEY`.

## What this review did not catch

Static review can't replace actually running the app — it can't verify the Supabase RLS policies behave as written, that the Finnhub API key works, or that the Capacitor build actually produces a working APK. That needs the real credentials and a real run. Recommend testing signup → login → create account → log a trade → view it → edit it → check Overview stats update → export → archive the account, in that order, since each step depends on the one before it.




