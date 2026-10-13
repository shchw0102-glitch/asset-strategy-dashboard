import { maxAmount, type Asset } from "./portfolio";
import marketList from "./upbit-markets.json";

export const upbitMarkets = marketList;
export const defaultWatchMarkets = ["KRW-BTC", "KRW-ETH", "KRW-XRP"];
export const upbitSocketUrl = "wss://api.upbit.com/websocket/v1";
export const quoteCacheKey = "moa-upbit-quotes-v1";
export const quoteStaleAfter = 60_000;
export type Quote = {
  market: string;
  price: number;
  changeRate: number;
  timestamp: number;
};
export type Quotes = Record<string, Quote>;
const marketCodes = new Set(upbitMarkets.map((m) => m.market));

export function isSupportedMarket(market: string): boolean {
  return marketCodes.has(market);
}
export function marketName(market: string): string {
  return upbitMarkets.find((m) => m.market === market)?.name ?? market;
}
export function quoteIsFresh(
  quote: Quote | undefined,
  now = Date.now(),
): boolean {
  return (
    !!quote &&
    quote.timestamp <= now + 30_000 &&
    now - quote.timestamp < quoteStaleAfter
  );
}
export function parseUpbitTicker(text: string, now = Date.now()): Quote | null {
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== "object") return null;
  const t = data as Record<string, unknown>;
  if (
    t.type !== "ticker" ||
    typeof t.code !== "string" ||
    !isSupportedMarket(t.code) ||
    typeof t.trade_price !== "number" ||
    !Number.isFinite(t.trade_price) ||
    t.trade_price <= 0 ||
    typeof t.signed_change_rate !== "number" ||
    !Number.isFinite(t.signed_change_rate) ||
    typeof t.timestamp !== "number" ||
    !Number.isSafeInteger(t.timestamp) ||
    t.timestamp <= 0 ||
    t.timestamp > now + 30_000
  )
    return null;
  return {
    market: t.code,
    price: t.trade_price,
    changeRate: t.signed_change_rate * 100,
    timestamp: t.timestamp,
  };
}
export function canApplyQuote(asset: Asset, quote: Quote | undefined): boolean {
  if (!asset.pricing || !quote) return false;
  const value = Math.round(asset.pricing.quantity * quote.price);
  return Number.isSafeInteger(value) && value >= 0 && value <= maxAmount;
}
export function valuateAssets(assets: Asset[], quotes: Quotes): Asset[] {
  return assets.map((a) => {
    const quote = a.pricing && quotes[a.pricing.market];
    if (!a.pricing || !quote || !canApplyQuote(a, quote)) return a;
    const value = Math.round(a.pricing.quantity * quote.price);
    return { ...a, value };
  });
}
export function quotePrice(price: number): string {
  return `${price.toLocaleString("ko-KR", { maximumFractionDigits: price < 1 ? 8 : 4 })}원`;
}
export function readQuoteCache(): Quotes {
  try {
    const data = JSON.parse(localStorage.getItem(quoteCacheKey) || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const quotes: Quotes = {};
    for (const [market, raw] of Object.entries(data)) {
      if (!raw || typeof raw !== "object") continue;
      const t = raw as Quote;
      const quote = parseUpbitTicker(
        JSON.stringify({
          type: "ticker",
          code: market,
          trade_price: t.price,
          signed_change_rate: t.changeRate / 100,
          timestamp: t.timestamp,
        }),
      );
      if (quote) quotes[market] = quote;
    }
    return quotes;
  } catch {
    return {};
  }
}
