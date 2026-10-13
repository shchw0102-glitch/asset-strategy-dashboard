import { describe, expect, it } from "vitest";
import {
  assetError,
  defaultTargets,
  demoPortfolio,
  parsePortfolio,
  type Asset,
} from "./portfolio";
import {
  canApplyQuote,
  parseUpbitTicker,
  quoteIsFresh,
  quotePrice,
  valuateAssets,
} from "./upbit";

const now = 1_800_000_000_000;
const ticker = {
  type: "ticker",
  code: "KRW-BTC",
  trade_price: 112_000_000,
  signed_change_rate: -0.025,
  timestamp: now,
};
const coin: Asset = {
  id: "bitcoin",
  name: "내 비트코인",
  category: "crypto",
  cost: 10_000_000,
  value: 11_000_000,
  note: "",
  pricing: { kind: "upbit", market: "KRW-BTC", quantity: 0.1 },
};

describe("업비트 시세와 코인 평가", () => {
  it("평가 금액의 유효 범위를 넘는 시세는 적용하지 않아 백업을 손상시키지 않는다", () => {
    const quote = {
      market: "KRW-BTC",
      price: 1e15,
      changeRate: 1,
      timestamp: now,
    };
    expect(canApplyQuote(coin, quote)).toBe(false);
    expect(valuateAssets([coin], { "KRW-BTC": quote })[0]).toEqual(coin);
  });
  it("실제 ticker 형식을 읽고 수익률을 퍼센트로 변환한다", () => {
    expect(parseUpbitTicker(JSON.stringify(ticker), now)).toEqual({
      market: "KRW-BTC",
      price: 112_000_000,
      changeRate: -2.5,
      timestamp: now,
    });
  });
  it("지원하지 않는 마켓, 오류 응답, 비정상 금액과 미래 시각은 가격으로 사용하지 않는다", () => {
    for (const bad of [
      { error: { name: "INVALID_PARAM" } },
      { ...ticker, code: "KRW-FAKE" },
      { ...ticker, trade_price: -1 },
      { ...ticker, timestamp: now + 60_000 },
      { ...ticker, signed_change_rate: "2" },
    ]) {
      expect(parseUpbitTicker(JSON.stringify(bad), now)).toBeNull();
    }
  });
  it("보유 수량 × 현재가로 평가하고 원금과 수량을 보존한다", () => {
    const quote = parseUpbitTicker(JSON.stringify(ticker), now)!;
    expect(valuateAssets([coin], { "KRW-BTC": quote })[0]).toEqual({
      ...coin,
      value: 11_200_000,
    });
    expect(coin.value).toBe(11_000_000);
  });
  it("시세가 없으면 마지막 확인 금액을 유지하고 수동 자산은 바꾸지 않는다", () => {
    expect(valuateAssets([coin], {})[0]).toEqual(coin);
    const manual = { ...coin, pricing: undefined };
    expect(
      valuateAssets([manual], {
        "KRW-BTC": parseUpbitTicker(JSON.stringify(ticker), now)!,
      })[0],
    ).toEqual(manual);
  });
  it("60초 이상 지난 가격은 실시간 표시하지 않는다", () => {
    const quote = parseUpbitTicker(JSON.stringify(ticker), now)!;
    expect(quoteIsFresh(quote, now + 59_000)).toBe(true);
    expect(quoteIsFresh(quote, now + 60_000)).toBe(false);
    expect(quoteIsFresh(undefined, now)).toBe(false);
  });
  it("1원 미만 코인 시세의 소수점을 보존한다", () => {
    expect(quotePrice(0.01234)).toBe("0.01234원");
  });
});

describe("기존 기록과 업비트 보유 수량 백업", () => {
  it("기존 4개 자산 유형의 목표 배분을 유지하면서 코인 목표를 0%로 추가한다", () => {
    const legacy = demoPortfolio();
    const { crypto: _, ...targets } = defaultTargets;
    const restored = parsePortfolio(JSON.stringify({ ...legacy, targets }));
    expect(restored.assets).toEqual(legacy.assets);
    expect(restored.targets).toEqual(defaultTargets);
  });
  it("업비트 마켓과 보유 수량을 백업과 복원에서 보존한다", () => {
    const p = {
      version: 1,
      isDemo: false,
      targets: defaultTargets,
      assets: [coin],
    };
    expect(parsePortfolio(JSON.stringify(p))).toEqual(p);
  });
  it("음수 수량, 잘못된 연동 유형과 가상자산 외 연동을 거부한다", () => {
    expect(
      assetError({
        ...coin,
        pricing: { kind: "upbit", market: "KRW-BTC", quantity: -1 },
      }),
    ).not.toBeNull();
    expect(assetError({ ...coin, category: "cash" })).not.toBeNull();
    const p = {
      version: 1,
      isDemo: false,
      targets: defaultTargets,
      assets: [
        { ...coin, pricing: { kind: "fake", market: "KRW-BTC", quantity: 1 } },
      ],
    };
    expect(() => parsePortfolio(JSON.stringify(p))).toThrow();
  });
  it("명시적으로 잘못된 코인 목표를 기존 기록으로 간주하지 않는다", () => {
    const p = {
      ...demoPortfolio(),
      targets: { ...defaultTargets, crypto: null },
    };
    expect(() => parsePortfolio(JSON.stringify(p))).toThrow();
  });
});
