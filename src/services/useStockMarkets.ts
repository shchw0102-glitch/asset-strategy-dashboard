import { useEffect, useState } from "react";
import type { StockHolding } from "../strategy/types";
import { fetchStock, mergeStockQuote, readStockCache, STOCK_CACHE_KEY, type StockQuote } from "./stocks";
export function useStockMarkets(stocks: StockHolding[]) {
  const [quotes, setQuotes] = useState(readStockCache);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const symbolsKey = stocks.filter((s) => s.mode === "auto").map((s) => s.symbol).sort().join(",");
  const allSymbols = stocks.map((s) => s.symbol).sort().join(",");
  const accept = (quote: StockQuote) => setQuotes((old) => mergeStockQuote(old, quote));
  useEffect(() => {
    try {
      const saved = Object.fromEntries(allSymbols.split(",").filter((symbol) => quotes[symbol]).map((symbol) => [symbol, quotes[symbol]]));
      localStorage.setItem(STOCK_CACHE_KEY, JSON.stringify(saved));
    } catch { /* 시세 캐시 실패는 사용자의 자산 저장을 막지 않습니다. */ }
  }, [quotes, allSymbols]);
  useEffect(() => {
    if (!symbolsKey) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controllers = new Set<AbortController>();
    async function cycle() {
      const symbols = symbolsKey.split(",");
      for (let index = 0; index < symbols.length && !stopped; index += 4) {
        await Promise.all(symbols.slice(index, index + 4).map(async (symbol) => {
          const controller = new AbortController();
          controllers.add(controller);
          const timeout = setTimeout(() => controller.abort(), 20_000);
          try {
            const result = await fetchStock(symbol, controller.signal);
            if (!stopped) {
              if (result.quote) setQuotes((old) => mergeStockQuote(old, result.quote!));
              setErrors((old) => ({ ...old, [symbol]: result.error || "" }));
            }
          } catch (error) {
            if (!stopped) setErrors((old) => ({ ...old, [symbol]: error instanceof Error ? error.message : "조회 실패" }));
          } finally { clearTimeout(timeout); controllers.delete(controller); }
        }));
      }
      if (!stopped) timer = setTimeout(cycle, 60_000);
    }
    void cycle();
    return () => { stopped = true; clearTimeout(timer); controllers.forEach((controller) => controller.abort()); };
  }, [symbolsKey]);
  return { quotes, errors, accept };
}
