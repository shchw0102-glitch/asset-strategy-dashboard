// 추가 API 어댑터용 계약입니다. 현재 연결은 liveQuotes/useLiveMarkets 및 server/market.mjs에 구현합니다.
export type QuoteSource = "manual" | "api";
export interface Quote {
  symbol: string;
  price: number;
  currency: "KRW" | "USD";
  source: QuoteSource;
  asOf: string | null;
}
export interface PropertyTransaction {
  address: string;
  priceKRW: number;
  areaM2: number;
  date: string;
}
export interface MarketDataProvider {
  cntn(): Promise<Quote>;
  crypto(symbol: string): Promise<Quote>;
  domesticStock(symbol: string): Promise<Quote>;
  usdKrw(): Promise<Quote>;
  propertyTransactions(region: string): Promise<PropertyTransaction[]>;
}
export function manualQuote(
  symbol: string,
  price: number,
  currency: Quote["currency"],
): Quote {
  return { symbol, price, currency, source: "manual", asOf: null };
}
