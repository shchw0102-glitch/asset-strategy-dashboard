// 공개 시세 전용 어댑터. 자산 수량·원금·금융계좌 정보는 받거나 전송하지 않습니다.
const definitions = {
  cntn: { symbol: "CNTN", currency: "USD", max: 1e6, interval: 60_000 },
  cc: { symbol: "KRW-CC", currency: "KRW", max: 1e8, interval: 15_000 },
  fx: { symbol: "KRW=X", currency: "KRW", max: 1e5, interval: 60_000 },
};
function validPrice(value, key) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= (key === "fx" ? 1 : Number.MIN_VALUE) &&
    value <= definitions[key].max
  );
}
function validTime(value, now) {
  return Number.isSafeInteger(value) && value > 0 && value <= now + 30_000;
}
export function parseYahoo(data, key, now = Date.now()) {
  const definition = definitions[key];
  const meta = data?.chart?.result?.[0]?.meta;
  if (
    !definition ||
    key === "cc" ||
    data?.chart?.error ||
    meta?.symbol !== definition.symbol ||
    meta?.currency !== definition.currency ||
    !validPrice(meta?.regularMarketPrice, key) ||
    !validTime(meta?.regularMarketTime * 1000, now) ||
    meta?.instrumentType !== (key === "fx" ? "CURRENCY" : "EQUITY")
  )
    throw new Error("시세 응답의 종목·통화·가격·시각을 확인할 수 없습니다.");
  const period = meta.currentTradingPeriod?.regular;
  return {
    key,
    symbol: definition.symbol,
    name: key === "cntn" ? "Canton Strategic Holdings" : "USD/KRW",
    currency: definition.currency,
    price: meta.regularMarketPrice,
    asOf: meta.regularMarketTime * 1000,
    receivedAt: now,
    source: "Yahoo Finance",
    transport: "poll",
    marketSession:
      period && now >= period.start * 1000 && now < period.end * 1000
        ? "regular"
        : "outside",
    sourceUrl:
      key === "cntn"
        ? "https://finance.yahoo.com/quote/CNTN/"
        : "https://finance.yahoo.com/quote/KRW=X/",
  };
}
export function parseUpbit(data, now = Date.now()) {
  const item = Array.isArray(data)
    ? data.find((q) => q.market === "KRW-CC")
    : null;
  if (
    !item ||
    !validPrice(item.trade_price, "cc") ||
    !validTime(item.trade_timestamp, now)
  )
    throw new Error(
      "업비트 CC 응답의 종목·가격·체결시각을 확인할 수 없습니다.",
    );
  return {
    key: "cc",
    symbol: "KRW-CC",
    name: "캔톤 (Canton)",
    currency: "KRW",
    price: item.trade_price,
    asOf: item.trade_timestamp,
    receivedAt: now,
    source: "Upbit",
    transport: "poll",
    marketSession: "continuous",
    sourceUrl: "https://upbit.com/exchange?code=CRIX.UPBIT.KRW-CC",
  };
}
export function createMarketService({
  fetcher = fetch,
  clock = Date.now,
} = {}) {
  const cache = new Map();
  async function download(url) {
    const response = await fetcher(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 AssetStrategyDashboard/1.0",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error(`제공처 HTTP ${response.status}`);
    return response.json();
  }
  async function refresh(key) {
    if (key === "cc")
      return parseUpbit(
        await download("https://api.upbit.com/v1/ticker?markets=KRW-CC"),
        clock(),
      );
    let error;
    for (const host of [
      "query1.finance.yahoo.com",
      "query2.finance.yahoo.com",
    ]) {
      try {
        return parseYahoo(
          await download(
            `https://${host}/v8/finance/chart/${encodeURIComponent(definitions[key].symbol)}?interval=1m&range=1d`,
          ),
          key,
          clock(),
        );
      } catch (e) {
        error = e;
      }
    }
    throw error;
  }
  async function read(key) {
    const previous = cache.get(key);
    if (previous?.pending) return previous.pending;
    if (previous && clock() - previous.attemptedAt < definitions[key].interval)
      return previous.result;
    const entry = {
      attemptedAt: clock(),
      result: previous?.result ?? { quote: null, error: null },
      pending: null,
    };
    entry.pending = (async () => {
      try {
        const quote = await refresh(key);
        if (entry.result.quote && quote.asOf < entry.result.quote.asOf)
          throw new Error(
            "이전 시각의 응답이 도착하여 마지막 확인 가격을 유지합니다.",
          );
        entry.result = { quote, error: null };
      } catch (e) {
        entry.result = {
          quote: entry.result.quote,
          error: `시세 조회 실패 · ${e instanceof Error ? e.message : "네트워크 오류"}`,
        };
      } finally {
        entry.pending = null;
      }
      return entry.result;
    })();
    cache.set(key, entry);
    return entry.pending;
  }
  return {
    async snapshot() {
      const values = await Promise.all(Object.keys(definitions).map(read));
      return {
        version: 1,
        generatedAt: clock(),
        quotes: Object.fromEntries(
          Object.keys(definitions).map((key, index) => [key, values[index]]),
        ),
      };
    },
  };
}
