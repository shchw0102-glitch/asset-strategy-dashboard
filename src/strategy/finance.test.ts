import { describe, expect, it } from "vitest";
import { newDefaultState } from "./defaults";
import {
  bulletMonthlyInterest,
  cntnValue,
  compoundInvestment,
  leverageOutcome,
  loanSchedule,
  netWorth,
  portfolio,
  projectHousing,
  salePlan,
  targetPrice,
} from "./finance";
import type { Holdings, HousingInputs, Loan } from "./types";

const holdings: Holdings = {
  cash: 300_000_000,
  stocks: [],
  cntnQuantity: 0,
  ccQuantity: 0,
  cntnPrice: 0,
  ccPrice: 0,
  exchangeRate: 1400,
};
const house: HousingInputs = {
  price: 200_000_000,
  equity: 100_000_000,
  ltv: 80,
  mortgageRate: 0,
  mortgageYears: 10,
  houseReturn: 0,
  stockReturn: 0,
  annualSaving: 20_000_000,
  years: 5,
};
const loan: Loan = {
  id: "test",
  name: "test",
  principal: 40_000_000,
  rate: 4.1,
  months: 120,
  method: "equal-principal",
};
describe("현재 자산 및 목표", () => {
  it("순자산은 총자산에서 부채를 차감하며 음수를 유지한다", () => {
    expect(netWorth(30_000_000, 71_900_000)).toBe(-41_900_000);
  });
  it("CNTN USD 가격을 원화로 환산한다", () => {
    expect(cntnValue(13_752, 3, 1400)).toBe(57_758_400);
  });
  it("사용자 기본 보유량 및 총대출 7,190만원을 반영한다", () => {
    const s = newDefaultState(),
      result = portfolio(s.holdings, s.loans);
    expect(result).toMatchObject({
      cc: 28_756_350,
      assets: 106_514_750,
      debt: 71_900_000,
      net: 34_614_750,
    });
  });
  it("CNTN 역산값 대입 시 정확히 목표 순자산이다", () => {
    const s = newDefaultState(),
      h = s.holdings;
    const other = h.cash + h.ccQuantity * h.ccPrice;
    const price = targetPrice(
      100_000_000,
      other,
      71_900_000,
      h.cntnQuantity,
      h.exchangeRate,
    )!;
    expect(
      other + cntnValue(h.cntnQuantity, price, h.exchangeRate) - 71_900_000,
    ).toBeCloseTo(100_000_000, 5);
  });
  it("CC 역산값 대입 시 목표에 도달한다", () => {
    const other = 87_758_400;
    const price = targetPrice(100_000_000, other, 71_900_000, 169_155)!;
    expect(other + price * 169_155 - 71_900_000).toBeCloseTo(100_000_000, 5);
  });
  it("보유량이 없거나 이미 목표 달성한 경우를 구분한다", () => {
    expect(targetPrice(100, 0, 0, 0)).toBeNull();
    expect(targetPrice(100, 200, 0, 0)).toBe(0);
    expect(targetPrice(100, 0, 0, 10, 0)).toBeNull();
  });
});
describe("대출 상환", () => {
  it("원금균등 첫 달과 마지막 달, 원금 합계를 검증한다", () => {
    const rows = loanSchedule(loan);
    expect(rows).toHaveLength(120);
    expect(rows[0]).toEqual({
      month: 1,
      principal: 333_333,
      interest: 136_667,
      payment: 470_000,
      balance: 39_666_667,
    });
    expect(rows.at(-1)?.balance).toBe(0);
    expect(rows.reduce((sum, r) => sum + r.principal, 0)).toBe(40_000_000);
    expect(rows.at(-1)!.interest).toBeLessThan(rows[0].interest);
  });
  it("만기일시는 매월 이자와 마지막 달 원금을 낸다", () => {
    const b = newDefaultState().loans[1],
      rows = loanSchedule(b);
    expect(bulletMonthlyInterest(31_900_000, 4)).toBe(106_333);
    expect(rows[0].principal).toBe(0);
    expect(rows[58].balance).toBe(31_900_000);
    expect(rows[59].payment).toBe(32_006_333);
    expect(rows[59].balance).toBe(0);
  });
  it("원리금균등 납입액 및 원금합계를 확인한다", () => {
    const rows = loanSchedule({
      ...loan,
      method: "annuity",
      principal: 100_000_000,
      rate: 6,
      months: 12,
    });
    const expected = Math.round((100_000_000 * 0.005) / (1 - 1.005 ** -12));
    expect(rows[0].payment).toBe(expected);
    expect(new Set(rows.slice(0, -1).map((r) => r.payment)).size).toBe(1);
    expect(rows.reduce((sum, r) => sum + r.principal, 0)).toBe(100_000_000);
    expect(rows.at(-1)?.balance).toBe(0);
  });
  it.each(["annuity", "equal-principal", "bullet"] as const)(
    "0% 금리에서도 %s 원금이 일치한다",
    (method) => {
      const rows = loanSchedule({
        ...loan,
        principal: 10,
        rate: 0,
        months: 3,
        method,
      });
      expect(rows.reduce((sum, r) => sum + r.principal, 0)).toBe(10);
      expect(rows.reduce((sum, r) => sum + r.interest, 0)).toBe(0);
    },
  );
  it("0개월, 소수 개월, 음수 금리, 비정상 금액을 거부한다", () => {
    for (const overrides of [
      { months: 0 },
      { months: 1.5 },
      { rate: -1 },
      { principal: Infinity },
      { principal: -1 },
    ])
      expect(() => loanSchedule({ ...loan, ...overrides })).toThrow();
  });
});
describe("복리 및 주택 매수", () => {
  it("5년 복리를 계산한다", () => {
    expect(compoundInvestment(100_000_000, 10, 5)).toBeCloseTo(161_051_000, 4);
  });
  it("연말 추가 저축 및 0%와 -100% 수익률을 처리한다", () => {
    expect(compoundInvestment(100, 10, 2, 10)).toBeCloseTo(142);
    expect(compoundInvestment(100, 0, 5, 20)).toBe(200);
    expect(compoundInvestment(100, -100, 5, 20)).toBe(20);
  });
  it("초기 자기자본은 순자산을 감소시키지 않고 투자에서 주택으로 이동한다", () => {
    const r = projectHousing(holdings, [], house, house.price);
    expect(r.points[0]).toMatchObject({
      investments: 200_000_000,
      house: 200_000_000,
      mortgage: 100_000_000,
      net: 300_000_000,
    });
    expect(r.final.net).toBeCloseTo(400_000_000, 3);
    expect(r.final.mortgage).toBe(50_000_020);
    expect(r.feasible).toBe(true);
  });
  it("수익률·이자 모두 0이면 매수 여부와 무관하게 초기 순자산+저축이다", () => {
    expect(projectHousing(holdings, [], house, 0).final.net).toBeCloseTo(
      projectHousing(holdings, [], house, house.price).final.net,
      3,
    );
  });
  it("집값은 5년 복리로 오르고 투자금에서 이자만큼 순자산이 감소한다", () => {
    const r = projectHousing(
      holdings,
      [],
      { ...house, houseReturn: 10, mortgageRate: 4 },
      house.price,
    );
    const interest = loanSchedule({
      ...loan,
      principal: 100_000_000,
      rate: 4,
      method: "annuity",
    })
      .slice(0, 60)
      .reduce((s, p) => s + p.interest, 0);
    expect(r.final.house).toBeCloseTo(322_102_000, 3);
    expect(r.final.net).toBeCloseTo(400_000_000 + 122_102_000 - interest, 3);
  });
  it("기존 대출의 원금은 자산과 부채에서 함께 빠지고 이자만 순자산을 줄인다", () => {
    const existing = {
      ...loan,
      principal: 12_000_000,
      rate: 12,
      months: 12,
      method: "bullet" as const,
    };
    const result = projectHousing(
      holdings,
      [existing],
      { ...house, annualSaving: 0 },
      0,
    );
    expect(result.final.net).toBeCloseTo(
      300_000_000 - 12_000_000 - 1_440_000,
      3,
    );
    expect(result.final.existingDebt).toBe(0);
  });
  it("추가저축이 없으면 월 환산 수익률이 연 복리와 일치한다", () => {
    const r = projectHousing(
      holdings,
      [],
      { ...house, annualSaving: 0, stockReturn: 5 },
      0,
    );
    expect(r.final.net).toBeCloseTo(300_000_000 * 1.05 ** 5, 3);
  });
  it("LTV에 필요한 자기자본을 늘리고 부족한 자금은 외부자산으로 만들지 않는다", () => {
    const r = projectHousing(
      holdings,
      [],
      { ...house, equity: 0, ltv: 20 },
      500_000_000,
    );
    expect(r.equity).toBe(400_000_000);
    expect(r.initialGap).toBe(100_000_000);
    expect(r.feasible).toBe(false);
  });
  it("연말에 회복해도 연중 만기 상환 자금 부족을 검출한다", () => {
    const empty = { ...holdings, cash: 0 };
    const early = {
      ...loan,
      principal: 10_000_000,
      rate: 0,
      months: 1,
      method: "bullet" as const,
    };
    const r = projectHousing(
      empty,
      [early],
      { ...house, annualSaving: 24_000_000 },
      0,
    );
    expect(r.final.cashShortfall).toBe(0);
    expect(r.cashShortfall).toBe(8_000_000);
    expect(r.feasible).toBe(false);
  });
});
describe("매도 및 레버리지", () => {
  it("최초 수량 비율로 매도하고 현금·잔여 평가액·부채를 한 번씩 반영한다", () => {
    const h = {
      ...holdings,
      cash: 0,
      cntnQuantity: 100,
      cntnPrice: 10,
      exchangeRate: 1000,
    };
    const rows = salePlan(h, 500_000, "cntn", [
      { id: "1", rise: 30, percent: 10 },
      { id: "2", rise: 50, percent: 15 },
    ]);
    expect(rows[0]).toMatchObject({
      sellQuantity: 10,
      proceeds: 130_000,
      remaining: 90,
      net: 800_000,
      debtAfterRepayment: 370_000,
    });
    expect(rows[1]).toMatchObject({
      sellQuantity: 15,
      remaining: 75,
      cash: 355_000,
      net: 980_000,
      debtAfterRepayment: 145_000,
    });
  });
  it("전체 매도 후 수량 및 부채 잔액이 음수가 되지 않는다", () => {
    const s = newDefaultState();
    const rows = salePlan({ ...s.holdings, cntnQuantity: 7 }, 0, "cntn", [
      { id: "1", rise: 30, percent: 50 },
      { id: "2", rise: 50, percent: 50 },
    ]);
    expect(rows.map((r) => r.sellQuantity)).toEqual([3, 4]);
    expect(rows[1].remaining).toBe(0);
    expect(rows[1].debtAfterRepayment).toBe(0);
  });
  it("100% 초과 매도 및 역순 상승률을 거부한다", () => {
    expect(() =>
      salePlan(holdings, 0, "cc", [
        { id: "1", rise: 30, percent: 80 },
        { id: "2", rise: 50, percent: 30 },
      ]),
    ).toThrow();
    expect(() =>
      salePlan(holdings, 0, "cc", [
        { id: "1", rise: 50, percent: 10 },
        { id: "2", rise: 30, percent: 10 },
      ]),
    ).toThrow();
  });
  it("연간 대출 이자 및 이자 차감 손익을 반영한다", () => {
    expect(leverageOutcome(12_000_000, 5.5, -50)).toMatchObject({
      value: 6_000_000,
      profit: -6_000_000,
      interest: 660_000,
      afterInterest: -6_660_000,
      netChange: -6_660_000,
    });
    expect(leverageOutcome(12_000_000, 5.5, 5.5).netChange).toBeCloseTo(0);
  });
});
