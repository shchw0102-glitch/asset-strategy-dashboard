import { validStockSymbol, stockCurrency } from "../services/stocks";
import { newDefaultState } from "./defaults";
import type { StrategyState } from "./types";

export const STORAGE_KEY = "asset-strategy-dashboard-v1";
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const number = (
  v: unknown,
  min: number,
  max: number,
  integer = false,
): v is number =>
  typeof v === "number" &&
  Number.isFinite(v) &&
  v >= min &&
  v <= max &&
  (!integer || Number.isSafeInteger(v));
const amount = (v: unknown) => number(v, 0, 1e12, true);
export function parseState(raw: string): StrategyState {
  const s: unknown = JSON.parse(raw);
  const fail = () => {
    throw new Error(
      "지원하는 백업 형식이 아니거나 입력값이 허용 범위를 벗어났습니다. 기존 데이터는 변경하지 않았습니다.",
    );
  };
  if (
    !object(s) ||
    s.version !== 1 ||
    !object(s.holdings) ||
    !object(s.housing) ||
    !object(s.leverage) ||
    !object(s.scenario) ||
    !object(s.sales)
  )
    return fail();
  if (s.market === undefined)
    s.market = { cntn: "auto", cc: "auto", fx: "auto" };
  if (
    !object(s.market) ||
    ["cntn", "cc", "fx"].some(
      (key) =>
        !["auto", "manual"].includes(
          String((s.market as Record<string, unknown>)[key]),
        ),
    )
  )
    return fail();
  const h = s.holdings;
  // v1 백업을 그대로 복원하되 삭제된 연금 금액은 자산에 포함하지 않습니다.
  delete h.pension;
  if (h.stocks === undefined) h.stocks = [];
  if (!Array.isArray(h.stocks) || h.stocks.length > 20 || h.stocks.some((stock) =>
    !object(stock) || !validStockSymbol(stock.symbol) || stock.symbol === "CNTN" ||
    typeof stock.name !== "string" || !stock.name.trim() || stock.name.length > 100 ||
    stock.currency !== stockCurrency(stock.symbol) || !number(stock.quantity, 0, 1e8) ||
    !number(stock.price, 0, stock.currency === "USD" ? 1e6 : 1e8) ||
    !["auto", "manual"].includes(String(stock.mode))
  ) || new Set(h.stocks.map((stock) => stock.symbol)).size !== h.stocks.length) return fail();

  if (
    !amount(h.cash) ||
    !number(h.cntnQuantity, 0, 1e8, true) ||
    !number(h.ccQuantity, 0, 1e9) ||
    !number(h.cntnPrice, 0, 1e6) ||
    !number(h.ccPrice, 0, 1e8) ||
    !number(h.exchangeRate, 1, 1e5)
  )
    return fail();
  if (
    !number(s.scenario.cntnPrice, 0, 1e6) ||
    !number(s.scenario.ccPrice, 0, 1e8) ||
    !amount(s.leverage.principal) ||
    !number(s.leverage.rate, 0, 100)
  )
    return fail();
  if (
    !Array.isArray(s.loans) ||
    s.loans.length > 30 ||
    s.loans.some(
      (l) =>
        !object(l) ||
        typeof l.id !== "string" ||
        typeof l.name !== "string" ||
        l.name.length > 60 ||
        !l.name.trim() ||
        !amount(l.principal) ||
        !number(l.rate, 0, 100) ||
        !number(l.months, 1, 600, true) ||
        !["equal-principal", "annuity", "bullet"].includes(String(l.method)),
    ) ||
    new Set(s.loans.map((l) => l.id)).size !== s.loans.length
  )
    return fail();
  for (const key of ["cntn", "cc"]) {
    const steps = s.sales[key];
    if (
      !Array.isArray(steps) ||
      steps.length > 12 ||
      steps.some(
        (step) =>
          !object(step) ||
          typeof step.id !== "string" ||
          !number(step.rise, 0, 10000) ||
          !number(step.percent, 0, 100),
      ) ||
      new Set(steps.map((step) => step.id)).size !== steps.length
    )
      return fail();
  }
  const p = s.housing;
  if (
    !amount(p.price) ||
    !amount(p.equity) ||
    !number(p.ltv, 0, 100) ||
    !number(p.mortgageRate, 0, 100) ||
    !number(p.mortgageYears, 1, 50, true) ||
    !number(p.houseReturn, -100, 100) ||
    !number(p.stockReturn, -100, 100) ||
    !amount(p.annualSaving) ||
    !number(p.years, 1, 30, true)
  )
    return fail();
  return s as unknown as StrategyState;
}
export function loadState(): { state: StrategyState; error: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { state: raw ? parseState(raw) : newDefaultState(), error: "" };
  } catch {
    return {
      state: newDefaultState(),
      error:
        "저장 데이터를 읽지 못했습니다. 예시값으로 열었습니다. 기존 저장값을 보존하려면 백업을 확인한 뒤 새 저장을 시작하세요.",
    };
  }
}
