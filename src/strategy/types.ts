import type { MarketModes } from "../services/liveQuotes";
export type Repayment = "equal-principal" | "annuity" | "bullet";
export interface Loan {
  id: string;
  name: string;
  principal: number;
  rate: number;
  months: number;
  method: Repayment;
}
export interface StockHolding {
  symbol: string;
  name: string;
  currency: "USD" | "KRW";
  quantity: number;
  price: number; // 수동 입력값. 자동 조회값은 별도 캐시에 저장합니다.
  mode: "auto" | "manual";
}
export interface Holdings {
  cash: number;
  stocks: StockHolding[];
  cntnQuantity: number;
  cntnPrice: number;
  ccQuantity: number;
  ccPrice: number;
  exchangeRate: number;
}
export interface SaleStep {
  id: string;
  rise: number;
  percent: number;
}
export interface HousingInputs {
  price: number;
  equity: number;
  ltv: number;
  mortgageRate: number;
  mortgageYears: number;
  houseReturn: number;
  stockReturn: number;
  annualSaving: number;
  years: number;
}
export interface StrategyState {
  version: 1;
  market: MarketModes;
  holdings: Holdings;
  loans: Loan[];
  scenario: { cntnPrice: number; ccPrice: number };
  sales: { cntn: SaleStep[]; cc: SaleStep[] };
  leverage: { principal: number; rate: number };
  housing: HousingInputs;
}
