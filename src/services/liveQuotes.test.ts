import { describe, it, expect } from "vitest";
import {
  DEFAULT_MODES,
  effectiveHoldings,
  mergeQuote,
  parseSocketQuote,
  quoteStatus,
  validQuote,
  quoteLinks,
  type LiveQuote,
} from "./liveQuotes";
import { newDefaultState } from "../strategy/defaults";
import { parseState } from "../strategy/storage";
const now = 1_791_910_000_000;
const quote: LiveQuote = {
  key: "cc",
  symbol: "KRW-CC",
  name: "캔톤",
  currency: "KRW",
  price: 180,
  asOf: now,
  receivedAt: now,
  source: "Upbit",
  transport: "websocket",
  marketSession: "continuous",
  sourceUrl: quoteLinks.cc,
};
describe("시세 반영 및 저장 호환성", () => {
  it("업비트 CC 체결 프레임만 적용한다", () => {
    expect(
      parseSocketQuote(
        JSON.stringify({
          type: "ticker",
          code: "KRW-CC",
          trade_price: 180,
          trade_timestamp: now,
        }),
        now,
      )?.price,
    ).toBe(180);
    expect(
      parseSocketQuote(
        JSON.stringify({
          type: "ticker",
          code: "KRW-BTC",
          trade_price: 180,
          trade_timestamp: now,
        }),
        now,
      ),
    ).toBeNull();
    expect(parseSocketQuote("broken", now)).toBeNull();
  });
  it("API 가격 상한·통화·출처 URL·미래 시각을 검증한다", () => {
    expect(validQuote(quote, "cc", now)).toBe(true);
    for (const change of [
      { price: Infinity },
      { price: 0 },
      { price: 1e9 },
      { symbol: "BTC" },
      { currency: "USD" },
      { sourceUrl: "javascript:alert(1)" },
      { asOf: now + 60_000 },
    ])
      expect(validQuote({ ...quote, ...change }, "cc", now)).toBe(false);
  });
  it("오래된 체결 및 역순 수신은 최신 가격을 덮어쓰지 않는다", () => {
    expect(
      mergeQuote(
        { cc: quote },
        { ...quote, price: 100, asOf: now - 1000 },
        "cc",
        now,
      ).cc?.price,
    ).toBe(180);
    expect(
      mergeQuote(
        { cc: quote },
        { ...quote, price: 100, receivedAt: now - 1000 },
        "cc",
        now,
      ).cc?.price,
    ).toBe(180);
  });
  it("자동 반영은 수량·원금·수동 가격 원본을 변경하지 않는다", () => {
    const h = newDefaultState().holdings;
    expect(effectiveHoldings(h, DEFAULT_MODES, { cc: quote })).toMatchObject({
      ccPrice: 180,
      ccQuantity: 169155,
      cash: 20000000,
    });
    expect(h.ccPrice).toBe(170);
    expect(
      effectiveHoldings(h, { ...DEFAULT_MODES, cc: "manual" }, { cc: quote })
        .ccPrice,
    ).toBe(170);
    expect(effectiveHoldings(h, DEFAULT_MODES, {})).toEqual(h);
  });
  it("미조회·장애·실시간·수동·오래된 체결을 구별한다", () => {
    expect(quoteStatus(undefined, "cc", "auto", now).label).toContain("수동값");
    expect(quoteStatus(quote, "cc", "auto", now).label).toContain("실시간");
    expect(quoteStatus(quote, "cc", "auto", now, "network").healthy).toBe(
      false,
    );
    expect(quoteStatus(quote, "cc", "auto", now + 60_000).label).toContain(
      "마지막 조회값",
    );
    expect(
      quoteStatus({ ...quote, asOf: now - 90_000 }, "cc", "auto", now).label,
    ).toContain("체결 대기");
    expect(quoteStatus(quote, "cc", "manual", now).label).toContain(
      "수동 입력",
    );
  });
  it("기존 백업은 자동 모드로 이관하고 수동 모드는 복원한다", () => {
    const old = JSON.parse(JSON.stringify(newDefaultState()));
    delete old.market;
    expect(parseState(JSON.stringify(old)).market).toEqual(DEFAULT_MODES);
    old.market = { cntn: "manual", cc: "manual", fx: "manual" };
    expect(parseState(JSON.stringify(old)).market.cc).toBe("manual");
    old.market.cc = "broken";
    expect(() => parseState(JSON.stringify(old))).toThrow();
  });
});
