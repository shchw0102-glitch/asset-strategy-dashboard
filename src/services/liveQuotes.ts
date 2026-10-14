import type { Holdings } from "../strategy/types";
export type MarketKey = "cntn" | "cc" | "fx";
export type MarketModes = Record<MarketKey, "auto" | "manual">;
export interface LiveQuote {
  key: MarketKey;
  symbol: string;
  name: string;
  currency: "USD" | "KRW";
  price: number;
  asOf: number;
  receivedAt: number;
  source: "Yahoo Finance" | "Upbit";
  transport: "poll" | "websocket";
  marketSession: "regular" | "outside" | "continuous";
  sourceUrl: string;
}
export type LiveQuotes = Partial<Record<MarketKey, LiveQuote>>;
export const DEFAULT_MODES: MarketModes = {
  cntn: "auto",
  cc: "auto",
  fx: "auto",
};
export const QUOTE_CACHE_KEY = "asset-strategy-market-quotes-v1";
export const marketKeys: MarketKey[] = ["cntn", "cc", "fx"];
export const quoteLinks = {
  cntn: "https://finance.yahoo.com/quote/CNTN/",
  cc: "https://upbit.com/exchange?code=CRIX.UPBIT.KRW-CC",
  fx: "https://finance.yahoo.com/quote/KRW=X/",
};
export function validQuote(
  value: unknown,
  key: MarketKey,
  now = Date.now(),
): value is LiveQuote {
  if (!value || typeof value !== "object") return false;
  const q = value as LiveQuote;
  return (
    q.key === key &&
    q.symbol === { cntn: "CNTN", cc: "KRW-CC", fx: "KRW=X" }[key] &&
    q.currency === (key === "cntn" ? "USD" : "KRW") &&
    typeof q.price === "number" &&
    Number.isFinite(q.price) &&
    q.price >= (key === "fx" ? 1 : Number.MIN_VALUE) &&
    q.price <= { cntn: 1e6, cc: 1e8, fx: 1e5 }[key] &&
    Number.isSafeInteger(q.asOf) &&
    q.asOf > 0 &&
    q.asOf <= now + 30_000 &&
    Number.isSafeInteger(q.receivedAt) &&
    q.receivedAt >= q.asOf - 30_000 &&
    q.receivedAt <= now + 30_000 &&
    q.source === (key === "cc" ? "Upbit" : "Yahoo Finance") &&
    (q.transport === "poll" || (key === "cc" && q.transport === "websocket")) &&
    ["regular", "outside", "continuous"].includes(q.marketSession) &&
    q.sourceUrl === quoteLinks[key]
  );
}
export function mergeQuote(
  quotes: LiveQuotes,
  quote: unknown,
  key: MarketKey,
  now = Date.now(),
): LiveQuotes {
  if (!validQuote(quote, key, now)) return quotes;
  const old = quotes[key];
  if (
    old &&
    (quote.asOf < old.asOf ||
      (quote.asOf === old.asOf && quote.receivedAt < old.receivedAt))
  )
    return quotes;
  return { ...quotes, [key]: quote };
}
export function parseSocketQuote(
  raw: string,
  now = Date.now(),
): LiveQuote | null {
  try {
    const t = JSON.parse(raw);
    if (t.type !== "ticker" || t.code !== "KRW-CC") return null;
    const q: LiveQuote = {
      key: "cc",
      symbol: "KRW-CC",
      name: "캔톤 (Canton)",
      currency: "KRW",
      price: t.trade_price,
      asOf: t.trade_timestamp,
      receivedAt: now,
      source: "Upbit",
      transport: "websocket",
      marketSession: "continuous",
      sourceUrl: quoteLinks.cc,
    };
    return validQuote(q, "cc", now) ? q : null;
  } catch {
    return null;
  }
}
export function effectiveHoldings(
  manual: Holdings,
  modes: MarketModes,
  quotes: LiveQuotes,
): Holdings {
  return {
    ...manual,
    cntnPrice:
      modes.cntn === "auto" && quotes.cntn
        ? quotes.cntn.price
        : manual.cntnPrice,
    ccPrice:
      modes.cc === "auto" && quotes.cc ? quotes.cc.price : manual.ccPrice,
    exchangeRate:
      modes.fx === "auto" && quotes.fx ? quotes.fx.price : manual.exchangeRate,
  };
}
export function quoteStatus(
  quote: LiveQuote | undefined,
  key: MarketKey,
  mode: "auto" | "manual",
  now: number,
  error?: string,
): { label: string; healthy: boolean } {
  if (mode === "manual") return { label: "수동 입력 적용", healthy: false };
  if (!quote)
    return {
      label: error ? "조회 실패 · 수동값 적용" : "조회 중 · 수동값 적용",
      healthy: false,
    };
  if (error || now - quote.receivedAt > (key === "cc" ? 45_000 : 150_000))
    return { label: "연결 지연 · 마지막 조회값", healthy: false };
  if (key === "cc")
    return now - quote.asOf > 60_000
      ? { label: "최근 체결 대기 · 마지막 체결가", healthy: false }
      : {
          label:
            quote.transport === "websocket"
              ? "업비트 실시간 연결"
              : "업비트 15초 조회",
          healthy: true,
        };
  if (quote.marketSession === "outside")
    return { label: "장외·휴장 · 최근 정규 시세", healthy: true };
  return {
    label:
      now - quote.asOf > 120_000
        ? "제공처 시세 지연"
        : "자동 조회 · 제공처 지연 가능",
    healthy: now - quote.asOf <= 120_000,
  };
}
export function readQuoteCache(): LiveQuotes {
  try {
    const raw = JSON.parse(localStorage.getItem(QUOTE_CACHE_KEY) || "{}");
    let quotes: LiveQuotes = {};
    for (const key of marketKeys) quotes = mergeQuote(quotes, raw?.[key], key);
    return quotes;
  } catch {
    return {};
  }
}
