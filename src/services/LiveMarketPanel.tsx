import { useState } from "react";
import { num, usd } from "../strategy/components";
import type { Holdings } from "../strategy/types";
import {
  marketKeys,
  quoteLinks,
  quoteStatus,
  type LiveQuotes,
  type MarketKey,
  type MarketModes,
} from "./liveQuotes";
const labels = {
  cntn: "CNTN · 미국 주식",
  cc: "CC · 업비트 캔톤",
  fx: "USD/KRW · 환율",
};
function time(value: number) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value);
}
export function LiveMarketPanel({
  modes,
  quotes,
  errors,
  holdings,
  now,
  onMode,
  refresh,
  canRefresh,
}: {
  modes: MarketModes;
  quotes: LiveQuotes;
  errors: Partial<Record<MarketKey, string>>;
  holdings: Holdings;
  now: number;
  onMode: (key: MarketKey, mode: "auto" | "manual") => void;
  refresh: () => void;
  canRefresh: boolean;
}) {
  const [expanded, setExpanded] = useState(
    () => window.matchMedia("(min-width: 761px)").matches,
  );
  const needsAttention = marketKeys.some(
    (key) =>
      modes[key] === "auto" &&
      !quoteStatus(quotes[key], key, modes[key], now, errors[key]).healthy,
  );
  const allManual = marketKeys.every((key) => modes[key] === "manual");
  const prices = {
    cntn: holdings.cntnPrice,
    cc: holdings.ccPrice,
    fx: holdings.exchangeRate,
  };
  return (
    <details
      className="live-markets"
      aria-label="실시간 시세 연결"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary className="market-summary">
        <div>
          <strong>시세·자동 반영 설정</strong>
          <small className={needsAttention ? "pending" : ""}>
            {allManual
              ? "수동 입력값 사용"
              : needsAttention
                ? "지연·미조회 있음 · 상세 확인"
                : "자동 조회 적용 중 · 상세 확인"}
          </small>
        </div>
        <span className="summary-prices">
          CNTN {usd(holdings.cntnPrice)} · CC {num(holdings.ccPrice, 4)}원
        </span>
        <span className="expand-mark" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div className="live-heading">
        <div>
          <strong>시세 자동 반영</strong>
          <span> CC 실시간 스트림 · 주가·환율 60초 조회</span>
        </div>
        <button
          className="text-button"
          disabled={
            !canRefresh || Object.values(modes).every((m) => m === "manual")
          }
          onClick={refresh}
        >
          지금 조회
        </button>
      </div>
      <div className="quote-grid">
        {marketKeys.map((key) => {
          const quote = quotes[key],
            status = quoteStatus(quote, key, modes[key], now, errors[key]);
          return (
            <article className="quote-card" key={key} data-market={key}>
              <div className="quote-top">
                <a
                  href={quoteLinks[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {labels[key]} ↗
                </a>
                <select
                  aria-label={`${key === "fx" ? "환율" : key.toUpperCase()} 가격 반영 방식`}
                  value={modes[key]}
                  onChange={(e) =>
                    onMode(key, e.target.value as "auto" | "manual")
                  }
                >
                  <option value="auto">자동 조회</option>
                  <option value="manual">수동 입력</option>
                </select>
              </div>
              <strong className="quote-price">
                {key === "cntn" ? usd(prices[key]) : `${num(prices[key], 4)}원`}
                <small>
                  {key === "cntn" ? "USD" : key === "fx" ? " / USD" : "KRW"}
                </small>
              </strong>
              <span
                className={`quote-status ${status.healthy ? "connected" : "pending"}`}
              >
                ● {status.label}
              </span>
              {modes[key] === "auto" && quote ? (
                <p className="quote-times">
                  {quote.source} · 가격 기준 {time(quote.asOf)}
                  <br />
                  조회 {time(quote.receivedAt)} (한국시간)
                </p>
              ) : (
                <p className="quote-times">
                  사용자 입력값
                  {modes[key] === "auto"
                    ? " · 첫 시세를 받기 전 임시 적용"
                    : ""}
                  <br />
                  {key === "cntn"
                    ? "Canton Strategic Holdings · Nasdaq"
                    : key === "cc"
                      ? "업비트 KRW-CC · 캔톤"
                      : "1 USD 기준 원화 환율"}
                </p>
              )}
              {modes[key] === "auto" && errors[key] && (
                <small className="quote-error">{errors[key]}</small>
              )}
            </article>
          );
        })}
      </div>
      <p className="live-caption">
        자동 시세는 현재 평가액과 각 시뮬레이터의 출발 자산에 반영됩니다. 직접
        정한 미래 시나리오 가격은 유지됩니다. 주가는 최근 정규장 가격이며 제공처
        지연이 있을 수 있습니다. 수량·원금·계좌 정보는 시세 제공처에 보내지
        않습니다.
      </p>
    </details>
  );
}
