// 고정된 Yahoo 호스트의 주식/ETF 공개 시세만 조회합니다.
export const validStockSymbol = (symbol) => typeof symbol === "string" &&
  /^(?:[A-Z]{1,10}(?:[.-][A-Z]{1,2})?|[0-9]{6}\.K[QS])$/.test(symbol);
export const stockCurrency = (symbol) => /^\d{6}\.K[QS]$/.test(symbol) ? "KRW" : "USD";
export function parseStock(data, symbol, now = Date.now()) {
  const meta = data?.chart?.result?.[0]?.meta;
  const time = meta?.regularMarketTime * 1000;
  const currency = stockCurrency(symbol);
  if (!validStockSymbol(symbol) || data?.chart?.error || meta?.symbol !== symbol ||
    meta?.currency !== currency || !["EQUITY", "ETF"].includes(meta?.instrumentType) ||
    !Number.isFinite(meta?.regularMarketPrice) || meta.regularMarketPrice <= 0 ||
    meta.regularMarketPrice > (currency === "USD" ? 1e6 : 1e8) ||
    !Number.isSafeInteger(time) || time <= 0 || time > now + 30_000) {
    throw new Error("종목코드·통화·시세를 확인할 수 없습니다. 미국 티커 또는 국내 코드.KS/.KQ를 확인하세요.");
  }
  const period = meta.currentTradingPeriod?.regular;
  return {
    symbol, currency,
    name: String(meta.longName || meta.shortName || symbol).slice(0, 100),
    price: meta.regularMarketPrice, asOf: time, receivedAt: now,
    source: "Yahoo Finance",
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/`,
    marketSession: period && now >= period.start * 1000 && now < period.end * 1000 ? "regular" : "outside",
  };
}
export function createStockService({ fetcher = fetch, clock = Date.now } = {}) {
  const cache = new Map();
  let active = 0;
  const waiting = [];
  async function fetchQuote(symbol) {
    let last;
    for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
      try {
        const response = await fetcher(`https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`, {
          signal: AbortSignal.timeout(7000),
          headers: { "User-Agent": "Mozilla/5.0 AssetStrategyDashboard/1.0", Accept: "application/json" },
        });
        if (!response.ok) throw new Error(`제공처 HTTP ${response.status}`);
        return parseStock(await response.json(), symbol, clock());
      } catch (error) { last = error; }
    }
    throw last;
  }
  async function limited(symbol) {
    if (active >= 4) await new Promise((resolve) => waiting.push(resolve));
    else active++;
    try { return await fetchQuote(symbol); }
    finally { if (waiting.length) waiting.shift()(); else active--; }
  }
  return {
    async read(symbol) {
      if (!validStockSymbol(symbol)) throw new Error("허용되지 않는 종목코드입니다.");
      const previous = cache.get(symbol);
      if (previous?.pending) return previous.pending;
      if (previous && clock() - previous.attemptedAt < 60_000) return previous.result;
      if (!previous && cache.size >= 128) {
        const oldest = [...cache].find(([, entry]) => !entry.pending);
        if (!oldest) return { quote: null, error: "조회 요청이 많습니다. 잠시 후 다시 시도하세요." };
        cache.delete(oldest[0]);
      }
      const entry = { attemptedAt: clock(), result: previous?.result ?? { quote: null, error: null }, pending: null };
      entry.pending = (async () => {
        try {
          const quote = await limited(symbol);
          if (entry.result.quote && quote.asOf < entry.result.quote.asOf) throw new Error("이전 시각의 응답이 도착했습니다.");
          entry.result = { quote, error: null };
        } catch (error) {
          entry.result = { quote: entry.result.quote, error: `시세 조회 실패 · ${error instanceof Error ? error.message : "네트워크 오류"}` };
        } finally { entry.pending = null; }
        return entry.result;
      })();
      cache.set(symbol, entry);
      return entry.pending;
    },
  };
}
