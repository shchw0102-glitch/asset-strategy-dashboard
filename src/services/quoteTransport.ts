import { isAndroidApp, nativeRequest } from "./android";
// These provider modules are pure JavaScript (no Node imports). Both platforms
// use exactly the same validation, TTL, rate limiting and fallback logic.
import { createMarketService } from "../../server/market.mjs";
import { createStockService } from "../../server/stocks.mjs";
const nativeFetch: typeof fetch = async (input) => {
  const value = await nativeRequest<{ status: number; body: string }>("fetch", { url: String(input) });
  return new Response(value.body, { status: value.status, headers: { "Content-Type": "application/json" } });
};
const market = createMarketService({ fetcher: nativeFetch });
const stocks = createStockService({ fetcher: nativeFetch });
export async function marketSnapshot(signal?: AbortSignal) {
  if (isAndroidApp()) return market.snapshot();
  const response = await fetch("./api/market", { signal, cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`시세 서버 응답 ${response.status}`);
  return response.json();
}
export async function stockSnapshot(symbol: string, signal?: AbortSignal) {
  if (isAndroidApp()) return stocks.read(symbol);
  const response = await fetch(`/api/stocks?symbol=${encodeURIComponent(symbol)}`, { signal });
  if (!response.ok) throw new Error(`시세 서버 응답 오류 (${response.status})`);
  return response.json();
}
