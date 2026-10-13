import {
  defaultWatchMarkets,
  marketName,
  quoteIsFresh,
  quotePrice,
  type Quotes,
} from "./upbit";
import type { QuoteStatus } from "./useUpbitQuotes";

export default function MarketPanel({
  quotes,
  status,
  now,
  onAdd,
}: {
  quotes: Quotes;
  status: QuoteStatus;
  now: number;
  onAdd: (market: string) => void;
}) {
  const live =
    status === "live" &&
    defaultWatchMarkets.some((m) => quoteIsFresh(quotes[m], now));
  const labels: Record<QuoteStatus, string> = {
    live: "실시간 수신 중",
    connecting: "시세 연결 중",
    reconnecting: "다시 연결 중",
    offline: "오프라인",
  };
  const latest = Math.max(
    0,
    ...defaultWatchMarkets.map((m) => quotes[m]?.timestamp ?? 0),
  );
  return (
    <section className="panel market-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">UPBIT · KRW MARKET</span>
          <h2>업비트 실시간 시세</h2>
        </div>
        <span
          className={`connection-badge ${live ? "connected" : ""}`}
          role="status"
        >
          <i className="status-dot" />
          {status === "live" && !live ? "이전 시세 표시" : labels[status]}
        </span>
      </div>
      <div className="market-cards">
        {defaultWatchMarkets.map((m) => {
          const quote = quotes[m];
          const fresh = live && quoteIsFresh(quote, now);
          return (
            <div className="market-card" key={m}>
              <div className="market-name">
                <strong>{marketName(m)}</strong>
                <span>{m.replace("KRW-", "")}</span>
              </div>
              <strong className="market-price">
                {quote ? quotePrice(quote.price) : "시세 수신 대기"}
              </strong>
              <div className="market-card-bottom">
                <span
                  className={
                    quote && quote.changeRate < 0 ? "negative" : "positive"
                  }
                >
                  {quote
                    ? `${quote.changeRate > 0 ? "+" : ""}${quote.changeRate.toFixed(2)}%`
                    : "—"}{" "}
                  <small>전일 대비</small>
                </span>
                <button
                  className="text-button"
                  onClick={() => onAdd(m)}
                  aria-label={`${marketName(m)} 자산 추가`}
                >
                  자산 추가 +
                </button>
              </div>
              {!fresh && quote && (
                <span className="cached-quote">이전 수신 시세</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="market-footnote">
        <span>
          시세가 보유 수량에 자동 반영됩니다. 수량은 직접 입력해 주세요.
        </span>
        <span>
          {latest
            ? `마지막 수신 ${new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(latest)}`
            : "API 키 없이 시세만 조회합니다."}
        </span>
      </div>
    </section>
  );
}
