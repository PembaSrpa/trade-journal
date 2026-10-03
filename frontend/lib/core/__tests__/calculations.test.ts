import { describe, expect, it } from "vitest";
import {
  calcHoldMinutes, calcPips, calcPnl, calcRMultiple, calcSession, pipSize, splitPair,
} from "../calculations";

const fx = (over: Record<string, unknown> = {}) =>
  calcPnl({
    assetClass: "forex", pair: "EUR/USD", direction: "long", entryPrice: 1.0842, exitPrice: 1.0891,
    lotSize: 1, lotUnit: "standard", commission: 0, swap: 0, ...over,
  } as Parameters<typeof calcPnl>[0]);

describe("pip size", () => {
  it("JPY, standard, metals/oil", () => {
    expect(pipSize("USD/JPY")).toBe(0.01);
    expect(pipSize("EUR/USD")).toBe(0.0001);
    expect(pipSize("XAU/USD")).toBe(0.01);
    expect(pipSize("USOIL")).toBe(0.01);
  });
});

describe("pips", () => {
  it("long/short win/loss", () => {
    expect(calcPips("forex", "EUR/USD", "long", 1.0842, 1.0891)).toBe(49);
    expect(calcPips("forex", "EUR/USD", "long", 1.0842, 1.0812)).toBe(-30);
    expect(calcPips("forex", "EUR/USD", "short", 1.0842, 1.0812)).toBe(30);
    expect(calcPips("forex", "EUR/USD", "short", 1.0842, 1.0891)).toBe(-49);
    expect(calcPips("forex", "USD/JPY", "long", 150, 150.5)).toBe(50);
  });
  it("point-based classes return raw points", () => {
    expect(calcPips("index", "US500", "long", 5000, 5050)).toBe(50);
    expect(calcPips("stock", "TSLA", "short", 250, 240)).toBe(10);
  });
});

describe("pnl (parity with the Python backend)", () => {
  it("lot units", () => {
    expect(fx().pnl).toBe(490);
    expect(fx({ lotUnit: "mini" }).pnl).toBe(49);
    expect(fx({ lotUnit: "micro" }).pnl).toBe(4.9);
  });
  it("commission subtracted, swap added", () => {
    expect(fx({ commission: 5, swap: 2 }).pnl).toBe(487);
  });
  it("loss is negative", () => {
    expect(fx({ entryPrice: 1.0891, exitPrice: 1.0842, lotSize: 0.1 }).pnl).toBeLessThan(0);
  });
  it("index / stock / crypto", () => {
    const base = { commission: 0, swap: 0, lotUnit: "units" as const };
    expect(calcPnl({ ...base, assetClass: "index", pair: "US500", direction: "long", entryPrice: 5000, exitPrice: 5050, lotSize: 3 }).pnl).toBe(150);
    expect(calcPnl({ ...base, assetClass: "stock", pair: "TSLA", direction: "long", entryPrice: 250, exitPrice: 260, lotSize: 10 }).pnl).toBe(100);
    expect(calcPnl({ ...base, assetClass: "crypto", pair: "BTC/USD", direction: "short", entryPrice: 65000, exitPrice: 64000, lotSize: 0.5 }).pnl).toBe(500);
    expect(calcPnl({ ...base, assetClass: "index", pair: "US500", direction: "long", entryPrice: 5000, exitPrice: 5050, lotSize: 1, commission: 2, swap: 1 }).pnl).toBe(49);
  });
});

describe("currency conversion (fix #1)", () => {
  it("quote == account currency: unchanged, not flagged", () => {
    const r = fx({ accountCurrency: "USD" });
    expect(r).toEqual({ pnl: 490, unconverted: false });
  });
  it("base == account currency (USD/JPY on USD account) divides by exit price", () => {
    // 50 pips * (1 std lot * 100000 * 0.01 = 1000 JPY/pip) = 50,000 JPY; / 150.50 = 332.23 USD
    const r = calcPnl({
      assetClass: "forex", pair: "USD/JPY", direction: "long", entryPrice: 150, exitPrice: 150.5,
      lotSize: 1, lotUnit: "standard", commission: 0, swap: 0, accountCurrency: "USD",
    });
    expect(r.pnl).toBe(332.23);
    expect(r.unconverted).toBe(false);
  });
  it("cross pair with a conversion rate multiplies by it", () => {
    // EUR/GBP 1 std lot, +20 pips => 200 GBP; GBP->USD 1.25 => 250
    const r = calcPnl({
      assetClass: "forex", pair: "EUR/GBP", direction: "long", entryPrice: 0.85, exitPrice: 0.852,
      lotSize: 1, lotUnit: "standard", commission: 0, swap: 0, accountCurrency: "USD", conversionRate: 1.25,
    });
    expect(r).toEqual({ pnl: 250, unconverted: false });
  });
  it("cross pair without a rate is flagged instead of silently wrong", () => {
    const r = calcPnl({
      assetClass: "forex", pair: "EUR/GBP", direction: "long", entryPrice: 0.85, exitPrice: 0.852,
      lotSize: 1, lotUnit: "standard", commission: 0, swap: 0, accountCurrency: "USD",
    });
    expect(r.unconverted).toBe(true);
  });
  it("commission/swap are account currency and are not converted", () => {
    const r = calcPnl({
      assetClass: "forex", pair: "EUR/GBP", direction: "long", entryPrice: 0.85, exitPrice: 0.852,
      lotSize: 1, lotUnit: "standard", commission: 5, swap: 0, accountCurrency: "USD", conversionRate: 1.25,
    });
    expect(r.pnl).toBe(245);
  });
  it("indices without a currency in the symbol are never flagged", () => {
    const r = calcPnl({
      assetClass: "index", pair: "UK100", direction: "long", entryPrice: 8000, exitPrice: 8010,
      lotSize: 1, lotUnit: "units", commission: 0, swap: 0, accountCurrency: "USD",
    });
    expect(r).toEqual({ pnl: 10, unconverted: false });
  });
  it("splitPair handles slashless forex", () => {
    expect(splitPair("forex", "EURUSD")).toEqual(["EUR", "USD"]);
    expect(splitPair("commodity", "USOIL")).toEqual([null, "USD"]);
  });
});

describe("R multiple / hold / session", () => {
  it("R multiple", () => {
    expect(calcRMultiple("long", 1.0842, 1.0891, 1.0812)).toBeCloseTo(1.63, 2);
    expect(calcRMultiple("long", 1.0842, 1.0812, 1.0812)).toBe(-1);
    expect(calcRMultiple("long", 1.0842, 1.0891, null)).toBeNull();
    expect(calcRMultiple("long", 1.0842, 1.0891, 1.0842)).toBeNull();
  });
  it("hold minutes", () => {
    expect(calcHoldMinutes("2026-07-28T08:15:00Z", "2026-07-28T10:40:00Z")).toBe(145);
    expect(calcHoldMinutes("2026-07-28T08:15:00Z", null)).toBeNull();
    expect(calcHoldMinutes("2026-07-28T22:00:00Z", "2026-07-29T02:00:00Z")).toBe(240);
  });
  it("sessions follow real market hours (fix #8)", () => {
    expect(calcSession("2026-07-28T03:15:00Z")).toBe("asia");
    expect(calcSession("2026-07-28T06:59:00Z")).toBe("asia");
    expect(calcSession("2026-07-28T07:00:00Z")).toBe("london");
    expect(calcSession("2026-07-28T11:59:00Z")).toBe("london");
    expect(calcSession("2026-07-28T14:00:00Z")).toBe("new_york"); // overlap counts as NY
    expect(calcSession("2026-07-28T20:59:00Z")).toBe("new_york");
    expect(calcSession("2026-07-28T21:00:00Z")).toBe("asia");
    expect(calcSession("2026-07-28T23:30:00Z")).toBe("asia");
  });
});
