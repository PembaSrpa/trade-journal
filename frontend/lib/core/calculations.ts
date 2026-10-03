import type { AssetClass, Direction, LotUnit } from "../types";

export const CONTRACT_SIZE: Record<LotUnit, number> = {
  standard: 100000,
  mini: 10000,
  micro: 1000,
  units: 1,
};

const JPY_PIP_SIZE = 0.01;
const DEFAULT_PIP_SIZE = 0.0001;

// Metals/oil use 2-decimal "pips" on most CFD platforms.
const COARSE_PIP_SYMBOLS = ["XAU", "XAG", "OIL", "WTI", "BRENT"];

// Quoted directly in points/dollars per unit rather than pips x contract size.
const POINT_BASED: AssetClass[] = ["index", "stock", "crypto"];

export function isPointBased(assetClass: AssetClass): boolean {
  return POINT_BASED.includes(assetClass);
}

/** Round half away from zero (matches what a trader expects; avoids -0.5 -> -0 surprises). */
export function round(value: number, digits: number): number {
  const f = 10 ** digits;
  const r = (Math.sign(value) * Math.round(Math.abs(value) * f + 1e-9)) / f;
  return r === 0 ? 0 : r;
}

export function pipSize(pair: string): number {
  const p = pair.toUpperCase();
  if (p.includes("JPY")) return JPY_PIP_SIZE;
  if (COARSE_PIP_SYMBOLS.some((s) => p.includes(s))) return 0.01;
  return DEFAULT_PIP_SIZE;
}

export function calcPips(
  assetClass: AssetClass,
  pair: string,
  direction: Direction,
  entry: number,
  exit: number
): number {
  let diff = exit - entry;
  if (direction === "short") diff = -diff;
  if (isPointBased(assetClass)) return round(diff, 2);
  return round(diff / pipSize(pair), 1);
}

/** Splits "EUR/USD" or "EURUSD" into [base, quote]. Returns nulls when the symbol has no currency pair. */
export function splitPair(assetClass: AssetClass, pair: string): [string | null, string | null] {
  const p = pair.toUpperCase().trim();
  if (p.includes("/")) {
    const [base, quote] = p.split("/");
    return [base || null, quote || null];
  }
  if (assetClass === "forex" && /^[A-Z]{6}$/.test(p)) return [p.slice(0, 3), p.slice(3)];
  // Single-symbol commodities (USOIL, XAUUSD handled above) are quoted in USD.
  if (assetClass === "commodity") return [null, "USD"];
  return [null, null];
}

export interface PnlInput {
  assetClass: AssetClass;
  pair: string;
  direction: Direction;
  entryPrice: number;
  exitPrice: number;
  lotSize: number;
  lotUnit: LotUnit;
  commission: number;
  swap: number;
  /** Account currency. When omitted, no conversion is attempted. */
  accountCurrency?: string;
  /** 1 quote-currency unit = this many account-currency units. Used when neither side of the pair is the account currency. */
  conversionRate?: number | null;
}

export interface PnlResult {
  pnl: number;
  /** Quote currency differs from the account currency and no way to convert was available. */
  unconverted: boolean;
}

export function calcPnl(i: PnlInput): PnlResult {
  let gross: number;
  if (isPointBased(i.assetClass)) {
    let diff = i.exitPrice - i.entryPrice;
    if (i.direction === "short") diff = -diff;
    gross = diff * i.lotSize;
  } else {
    const pips = calcPips(i.assetClass, i.pair, i.direction, i.entryPrice, i.exitPrice);
    const pipValue = i.lotSize * CONTRACT_SIZE[i.lotUnit] * pipSize(i.pair);
    gross = pips * pipValue;
  }

  // Gross P&L is in the pair's quote currency. Commission and swap are
  // entered in account currency, so only the gross part is converted.
  let factor = 1;
  let unconverted = false;
  const account = i.accountCurrency?.toUpperCase();
  if (account) {
    const [base, quote] = splitPair(i.assetClass, i.pair);
    if (quote && quote !== account) {
      if (i.conversionRate && i.conversionRate > 0) {
        factor = i.conversionRate;
      } else if (!isPointBased(i.assetClass) && base === account && i.exitPrice > 0) {
        // e.g. USD/JPY on a USD account: yen P&L / USD/JPY rate = dollars.
        factor = 1 / i.exitPrice;
      } else {
        unconverted = true;
      }
    }
  }

  return { pnl: round(gross * factor - i.commission + i.swap, 2), unconverted };
}

export function calcRMultiple(
  direction: Direction,
  entry: number,
  exit: number,
  initialSl: number | null | undefined
): number | null {
  if (initialSl === null || initialSl === undefined) return null;
  const risk = Math.abs(entry - initialSl);
  if (risk === 0) return null;
  let reward = exit - entry;
  if (direction === "short") reward = -reward;
  return round(reward / risk, 2);
}

export function calcHoldMinutes(entryTime: string, exitTime: string | null | undefined): number | null {
  if (!exitTime) return null;
  const ms = Date.parse(exitTime) - Date.parse(entryTime);
  return Math.floor(ms / 60000);
}

export type Session = "asia" | "london" | "new_york";

/**
 * Real market hours, by the UTC hour of the entry instant (DST not modelled):
 *   Asia      21:00-07:00  (Sydney + Tokyo)
 *   London    07:00-12:00
 *   New York  12:00-21:00  (the 12:00-16:00 London/NY overlap is counted as New York)
 * The previous implementation split the day into three equal 8-hour blocks that
 * didn't correspond to actual market opens.
 */
export function calcSession(entryTime: string): Session {
  const hour = new Date(entryTime).getUTCHours();
  if (hour >= 7 && hour < 12) return "london";
  if (hour >= 12 && hour < 21) return "new_york";
  return "asia";
}
