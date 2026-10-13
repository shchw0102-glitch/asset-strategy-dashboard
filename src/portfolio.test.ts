import { describe, expect, it } from "vitest";
import {
  allocation,
  assetError,
  defaultTargets,
  demoPortfolio,
  parsePortfolio,
  totals,
  validTargets,
  type Asset,
} from "./portfolio";

const asset = (cost: number, value: number): Asset => ({
  id: "test",
  name: "테스트 자산",
  category: "stock",
  cost,
  value,
  note: "",
});

describe("자산 합계와 수익률", () => {
  it("원금과 평가금액을 합산하고 원금 기준으로 수익률을 계산한다", () => {
    expect(
      totals([asset(100, 120), { ...asset(200, 170), id: "test-2" }]),
    ).toEqual({ cost: 300, value: 290, profit: -10, rate: (-10 / 300) * 100 });
  });
  it("빈 자산과 0원 원금에서 수익률을 계산하지 않는다", () => {
    expect(totals([])).toEqual({ cost: 0, value: 0, profit: 0, rate: null });
    expect(totals([asset(0, 100)])).toEqual({
      cost: 0,
      value: 100,
      profit: 100,
      rate: null,
    });
  });
  it("샘플 자산 합계가 예시 값과 일치한다", () => {
    expect(totals(demoPortfolio().assets)).toEqual({
      cost: 308_500_000,
      value: 348_500_000,
      profit: 40_000_000,
      rate: (40_000_000 / 308_500_000) * 100,
    });
  });
});

describe("목표 배분", () => {
  it("전체 평가금액에 따른 비중과 목표까지의 조정 금액을 계산한다", () => {
    const shares = allocation([asset(100, 100)], defaultTargets);
    expect(shares.find((c) => c.id === "stock")).toMatchObject({
      share: 100,
      target: 30,
      adjustment: -70,
    });
    expect(shares.find((c) => c.id === "cash")).toMatchObject({
      share: 0,
      target: 15,
      adjustment: 15,
    });
    expect(shares.reduce((sum, c) => sum + c.adjustment, 0)).toBe(0);
  });
  it("0원 자산에서 비중과 조정금액은 0이다", () => {
    expect(
      allocation([], defaultTargets).every(
        (c) => c.share === 0 && c.adjustment === 0,
      ),
    ).toBe(true);
  });
  it("합계 100%와 각 비중의 범위를 검증한다", () => {
    expect(validTargets(defaultTargets)).toBe(true);
    expect(
      validTargets({
        cash: 10.1,
        stock: 29.9,
        property: 50,
        other: 10,
        crypto: 0,
      }),
    ).toBe(true);
    expect(validTargets({ ...defaultTargets, cash: 0 })).toBe(false);
    expect(
      validTargets({ cash: -1, stock: 31, property: 65, other: 5, crypto: 0 }),
    ).toBe(false);
    expect(validTargets({ ...defaultTargets, stock: NaN })).toBe(false);
  });
});

describe("입력과 백업 검증", () => {
  it("음수, 소수, 무한대, 한도 초과 금액을 거부한다", () => {
    for (const value of [-1, 0.5, Infinity, 9_000_000_000_001])
      expect(assetError(asset(100, value))).not.toBeNull();
    expect(assetError(asset(0, 0))).toBeNull();
  });
  it("빈 이름과 너무 긴 메모를 거부한다", () => {
    expect(assetError({ ...asset(100, 100), name: "   " })).not.toBeNull();
    expect(
      assetError({ ...asset(100, 100), note: "a".repeat(201) }),
    ).not.toBeNull();
  });
  it("다운로드한 기록을 손실 없이 가져온다", () => {
    const portfolio = demoPortfolio();
    expect(parsePortfolio(JSON.stringify(portfolio))).toEqual(portfolio);
    expect(
      parsePortfolio(
        JSON.stringify({ ...portfolio, assets: [], isDemo: false }),
      ).assets,
    ).toEqual([]);
  });
  it("잘못된 형식, 자산 유형, 중복 ID, 손상된 금액을 거부한다", () => {
    const portfolio = demoPortfolio();
    const invalid = [
      null,
      {},
      { ...portfolio, version: 2 },
      { ...portfolio, targets: { ...defaultTargets, cash: "15" } },
      { ...portfolio, assets: [portfolio.assets[0], portfolio.assets[0]] },
      {
        ...portfolio,
        assets: [{ ...portfolio.assets[0], category: "unknown" }],
      },
      { ...portfolio, assets: [{ ...portfolio.assets[0], value: "100" }] },
    ];
    for (const data of invalid)
      expect(() => parsePortfolio(JSON.stringify(data))).toThrow();
    expect(() => parsePortfolio("broken JSON")).toThrow();
  });
});
