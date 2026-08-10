export type AssetClass = "forex" | "index" | "stock" | "crypto" | "commodity";

export interface Instrument {
  symbol: string;
  label: string;
  assetClass: AssetClass;
}

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  forex: "Forex",
  index: "Index",
  stock: "Stock",
  crypto: "Crypto",
  commodity: "Commodity",
};

// The unit shown/used for lot_size per asset class. Forex keeps the
// standard/mini/micro contract-size picker; everything else is a plain
// quantity (contracts, shares, coins) with no contract-size multiplier.
export const USES_LOT_UNIT: Record<AssetClass, boolean> = {
  forex: true,
  commodity: true,
  index: false,
  stock: false,
  crypto: false,
};

export const PRICE_MOVE_LABEL: Record<AssetClass, string> = {
  forex: "pips",
  commodity: "pips",
  index: "points",
  stock: "points",
  crypto: "points",
};

const FOREX: Instrument[] = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "USD/CAD", "AUD/USD", "NZD/USD",
  "EUR/GBP", "EUR/JPY", "EUR/CHF", "EUR/AUD", "EUR/CAD", "EUR/NZD", "EUR/TRY", "EUR/SEK", "EUR/NOK", "EUR/ZAR",
  "GBP/JPY", "GBP/CHF", "GBP/AUD", "GBP/CAD", "GBP/NZD", "GBP/ZAR",
  "AUD/JPY", "AUD/CHF", "AUD/CAD", "AUD/NZD",
  "NZD/JPY", "NZD/CHF", "NZD/CAD",
  "CAD/JPY", "CAD/CHF", "CHF/JPY",
  "USD/ZAR", "USD/TRY", "USD/MXN", "USD/SGD", "USD/SEK", "USD/NOK", "USD/DKK", "USD/HKD", "USD/CNH", "USD/PLN", "USD/THB",
].map((symbol) => ({ symbol, label: symbol, assetClass: "forex" as const }));

const INDICES: Instrument[] = [
  { symbol: "US500", label: "US500 (S&P 500)" },
  { symbol: "NAS100", label: "NAS100 (Nasdaq 100)" },
  { symbol: "US30", label: "US30 (Dow Jones)" },
  { symbol: "UK100", label: "UK100 (FTSE 100)" },
  { symbol: "DE40", label: "DE40 (DAX 40)" },
  { symbol: "JP225", label: "JP225 (Nikkei 225)" },
  { symbol: "EU50", label: "EU50 (Euro Stoxx 50)" },
  { symbol: "AUS200", label: "AUS200 (ASX 200)" },
].map((i) => ({ ...i, assetClass: "index" as const }));

const STOCKS: Instrument[] = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "NFLX", "AMD", "INTC",
].map((symbol) => ({ symbol, label: symbol, assetClass: "stock" as const }));

const CRYPTO: Instrument[] = [
  { symbol: "BTC/USD", label: "BTC/USD (Bitcoin)" },
  { symbol: "ETH/USD", label: "ETH/USD (Ethereum)" },
  { symbol: "SOL/USD", label: "SOL/USD (Solana)" },
  { symbol: "XRP/USD", label: "XRP/USD (Ripple)" },
].map((i) => ({ ...i, assetClass: "crypto" as const }));

const COMMODITIES: Instrument[] = [
  { symbol: "XAU/USD", label: "XAU/USD (Gold)" },
  { symbol: "XAG/USD", label: "XAG/USD (Silver)" },
  { symbol: "USOIL", label: "USOIL (WTI Crude)" },
  { symbol: "UKOIL", label: "UKOIL (Brent Crude)" },
].map((i) => ({ ...i, assetClass: "commodity" as const }));

export const INSTRUMENTS: Instrument[] = [...FOREX, ...INDICES, ...STOCKS, ...CRYPTO, ...COMMODITIES];

export const INSTRUMENT_GROUPS: { assetClass: AssetClass; label: string; instruments: Instrument[] }[] = [
  { assetClass: "forex", label: "Forex", instruments: FOREX },
  { assetClass: "index", label: "Indices", instruments: INDICES },
  { assetClass: "stock", label: "Stocks", instruments: STOCKS },
  { assetClass: "crypto", label: "Crypto", instruments: CRYPTO },
  { assetClass: "commodity", label: "Commodities", instruments: COMMODITIES },
];

export function findInstrument(symbol: string): Instrument | undefined {
  return INSTRUMENTS.find((i) => i.symbol.toUpperCase() === symbol.toUpperCase());
}

// Best-effort guess for a symbol typed free-hand (not picked from the list),
// so P&L still calculates sanely instead of silently defaulting to forex.
export function guessAssetClass(symbol: string): AssetClass {
  const known = findInstrument(symbol);
  if (known) return known.assetClass;
  const s = symbol.toUpperCase();
  if (/^(BTC|ETH|SOL|XRP|DOGE|LTC)/.test(s)) return "crypto";
  if (/^(US500|NAS100|US30|UK100|DE40|JP225|EU50|AUS200|SPX|NDX|DJI)/.test(s)) return "index";
  if (/^(XAU|XAG|OIL|WTI|BRENT)/.test(s)) return "commodity";
  if (/[A-Z]{3}\/?[A-Z]{3}$/.test(s)) return "forex";
  return "stock";
}
