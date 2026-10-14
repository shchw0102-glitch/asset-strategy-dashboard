import { stockSnapshot } from "./quoteTransport";
import type { StockHolding } from "../strategy/types";
export const validStockSymbol = (symbol: unknown): symbol is string => typeof symbol === "string" &&
  /^(?:[A-Z]{1,10}(?:[.-][A-Z]{1,2})?|[0-9]{6}\.K[QS])$/.test(symbol);
export const stockCurrency = (symbol: string): "USD" | "KRW" => /^\d{6}\.K[QS]$/.test(symbol) ? "KRW" : "USD";
export interface StockQuote {
  symbol: string; name: string; currency: "USD" | "KRW"; price: number;
  asOf: number; receivedAt: number; source: "Yahoo Finance";
  sourceUrl: string; marketSession: "regular" | "outside";
}
export type StockQuotes = Record<string, StockQuote>;
export const STOCK_CACHE_KEY = "asset-strategy-stock-quotes-v1";
export function validStockQuote(value: unknown, symbol: string, now = Date.now()): value is StockQuote {
  if (!value || typeof value !== "object") return false;
  const q = value as StockQuote;
  return validStockSymbol(symbol) && q.symbol === symbol && q.currency === stockCurrency(symbol) &&
    typeof q.name === "string" && q.name.length > 0 && q.name.length <= 100 &&
    typeof q.price === "number" && Number.isFinite(q.price) && q.price > 0 && q.price <= (q.currency === "USD" ? 1e6 : 1e8) &&
    Number.isSafeInteger(q.asOf) && q.asOf > 0 && q.asOf <= now + 30_000 &&
    Number.isSafeInteger(q.receivedAt) && q.receivedAt >= q.asOf - 30_000 && q.receivedAt <= now + 30_000 &&
    q.source === "Yahoo Finance" && q.sourceUrl === `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/` &&
    ["regular", "outside"].includes(q.marketSession);
}
export function mergeStockQuote(quotes: StockQuotes, quote: StockQuote): StockQuotes {
  if (!validStockQuote(quote, quote.symbol)) return quotes;
  const previous = quotes[quote.symbol];
  if (previous && (previous.asOf > quote.asOf || (previous.asOf === quote.asOf && previous.receivedAt > quote.receivedAt))) return quotes;
  return { ...quotes, [quote.symbol]: quote };
}
export function effectiveStocks(stocks: StockHolding[], quotes: StockQuotes): StockHolding[] {
  return stocks.map((stock) => {
    const q = quotes[stock.symbol];
    return stock.mode === "auto" && q && q.currency === stock.currency
      ? { ...stock, price: q.price, name: q.name } : stock;
  });
}
export function readStockCache(): StockQuotes {
  try {
    const data = JSON.parse(localStorage.getItem(STOCK_CACHE_KEY) || "{}");
    const quotes: StockQuotes = {};
    for (const [symbol, quote] of Object.entries(data).slice(0, 20))
      if (validStockQuote(quote, symbol)) quotes[symbol] = quote;
    return quotes;
  } catch { return {}; }
}
export async function fetchStock(symbol: string, signal?: AbortSignal): Promise<{ quote: StockQuote | null; error: string | null }> {
  if (!validStockSymbol(symbol)) throw new Error("종목코드를 확인하세요.");
  if (location.protocol === "file:") throw new Error("실행하기.cmd 또는 start-android.sh로 앱을 실행해야 주가를 조회할 수 있습니다.");
  const data = await stockSnapshot(symbol, signal);
  if (!data.quote && typeof data.error === "string") return { quote: null, error: data.error };
  if (!validStockQuote(data.quote, symbol)) throw new Error("종목·통화·시세 응답을 검증하지 못했습니다.");
  return { quote: data.quote, error: typeof data.error === "string" ? data.error : null };
}
