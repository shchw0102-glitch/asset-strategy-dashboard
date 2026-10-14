import type { StrategyState } from "./types";

// 모든 금액은 원, 금리는 연 %, 가격은 CNTN만 USD입니다. 현재 시세가 아닌 예시입니다.
export const DEFAULT_STATE: StrategyState = {
  version: 1,
  market: { cntn: "auto", cc: "auto", fx: "auto" },
  holdings: {
    cash: 20_000_000,
    stocks: [],
    cntnQuantity: 13_752,
    cntnPrice: 3,
    ccQuantity: 169_155,
    ccPrice: 170,
    exchangeRate: 1_400,
  },
  loans: [
    {
      id: "loan-a",
      name: "대출 A",
      principal: 40_000_000,
      rate: 4.1,
      months: 120,
      method: "equal-principal",
    },
    {
      id: "loan-b",
      name: "대출 B",
      principal: 31_900_000,
      rate: 4,
      months: 60,
      method: "bullet",
    },
  ],
  scenario: { cntnPrice: 3, ccPrice: 170 },
  sales: {
    cntn: [
      { id: "cntn-1", rise: 30, percent: 10 },
      { id: "cntn-2", rise: 50, percent: 15 },
      { id: "cntn-3", rise: 100, percent: 20 },
    ],
    cc: [
      { id: "cc-1", rise: 30, percent: 10 },
      { id: "cc-2", rise: 50, percent: 15 },
      { id: "cc-3", rise: 100, percent: 20 },
    ],
  },
  leverage: { principal: 12_000_000, rate: 5.5 },
  housing: {
    price: 400_000_000,
    equity: 60_000_000,
    ltv: 80,
    mortgageRate: 4,
    mortgageYears: 30,
    houseReturn: 2,
    stockReturn: 5,
    annualSaving: 27_000_000,
    years: 5,
  },
};
export const newDefaultState = (): StrategyState =>
  structuredClone(DEFAULT_STATE);
export const TARGET = 100_000_000;
export const CNTN_SCENARIOS = [2, 3, 4, 5, 7, 10];
export const CC_SCENARIOS = [150, 200, 300, 500, 700, 1_000];
export const STOCK_RETURNS = [-10, 0, 5, 10, 15, 20];
export const HOUSE_RETURNS = [-5, 0, 2, 4, 6, 8];
export const INTEREST_RATES = [3, 4, 5, 6];
