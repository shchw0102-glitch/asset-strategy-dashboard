import type { Holdings, HousingInputs, Loan, SaleStep, StockHolding } from "./types";

export function cntnValue(
  quantity: number,
  usdPrice: number,
  exchangeRate: number,
) {
  return quantity * usdPrice * exchangeRate;
}
export function netWorth(assets: number, liabilities: number) {
  return assets - liabilities;
}
export function stockValue(stock: StockHolding, exchangeRate: number) {
  return stock.quantity * stock.price * (stock.currency === "USD" ? exchangeRate : 1);
}
export function stocksValue(holdings: Holdings) {
  return holdings.stocks.reduce((sum, stock) => sum + stockValue(stock, holdings.exchangeRate), 0);
}
export function portfolio(holdings: Holdings, loans: Loan[]) {
  const cntn = cntnValue(
    holdings.cntnQuantity,
    holdings.cntnPrice,
    holdings.exchangeRate,
  );
  const cc = holdings.ccQuantity * holdings.ccPrice;
  const stocks = stocksValue(holdings);
  const assets = holdings.cash + stocks + cntn + cc;
  const debt = loans.reduce((sum, loan) => sum + loan.principal, 0);
  return {
    cntn,
    cc,
    stocks,
    assets,
    debt,
    net: netWorth(assets, debt),
    liquid: assets,
  };
}
export function targetPrice(
  target: number,
  otherAssets: number,
  debt: number,
  quantity: number,
  exchangeRate = 1,
): number | null {
  const needed = target + debt - otherAssets;
  if (needed <= 0) return 0;
  if (quantity <= 0 || exchangeRate <= 0) return null;
  return needed / (quantity * exchangeRate);
}
export function compoundInvestment(
  initial: number,
  annualReturn: number,
  years: number,
  annualAddition = 0,
) {
  let balance = initial;
  for (let year = 0; year < years; year++)
    balance = balance * (1 + annualReturn / 100) + annualAddition;
  return balance;
}
export interface LoanPayment {
  month: number;
  principal: number;
  interest: number;
  payment: number;
  balance: number;
}
export function loanSchedule(loan: Loan): LoanPayment[] {
  if (
    !Number.isSafeInteger(loan.principal) ||
    loan.principal < 0 ||
    !Number.isInteger(loan.months) ||
    loan.months < 1 ||
    loan.months > 600 ||
    !Number.isFinite(loan.rate) ||
    loan.rate < 0 ||
    loan.rate > 100
  )
    throw new Error("대출 금액·금리·기간을 확인해 주세요.");
  const rate = loan.rate / 1_200;
  const fixedPrincipal = Math.floor(loan.principal / loan.months);
  const fixedPayment = Math.round(
    rate === 0
      ? loan.principal / loan.months
      : (loan.principal * rate) / (1 - Math.pow(1 + rate, -loan.months)),
  );
  let balance = loan.principal;
  return Array.from({ length: loan.months }, (_, index) => {
    const interest = Math.round(balance * rate);
    const last = index === loan.months - 1;
    let principal =
      loan.method === "equal-principal"
        ? fixedPrincipal
        : loan.method === "annuity"
          ? Math.max(0, fixedPayment - interest)
          : 0;
    principal = last ? balance : Math.min(balance, principal);
    balance -= principal;
    return {
      month: index + 1,
      principal,
      interest,
      payment: principal + interest,
      balance,
    };
  });
}
export function bulletMonthlyInterest(principal: number, rate: number) {
  return Math.round((principal * rate) / 1_200);
}
export function salePlan(
  holdings: Holdings,
  debt: number,
  asset: "cntn" | "cc",
  steps: SaleStep[],
) {
  const sum = steps.reduce((total, s) => total + s.percent, 0);
  if (
    sum > 100 + 1e-9 ||
    steps.some(
      (s, i) =>
        s.percent < 0 ||
        s.rise < 0 ||
        !Number.isFinite(s.percent + s.rise) ||
        (i > 0 && s.rise <= steps[i - 1].rise),
    )
  )
    throw new Error(
      "매도 비율 합계는 100% 이하, 상승률은 단계별로 증가해야 합니다.",
    );
  const quantity =
    asset === "cntn" ? holdings.cntnQuantity : holdings.ccQuantity;
  const basePrice = asset === "cntn" ? holdings.cntnPrice : holdings.ccPrice;
  const fx = asset === "cntn" ? holdings.exchangeRate : 1;
  const other =
    holdings.cash +
    stocksValue(holdings) +
    (asset === "cntn"
      ? holdings.ccQuantity * holdings.ccPrice
      : cntnValue(
          holdings.cntnQuantity,
          holdings.cntnPrice,
          holdings.exchangeRate,
        ));
  let sold = 0,
    cash = 0,
    cumulativePercent = 0;
  return steps.map((step) => {
    cumulativePercent += step.percent;
    const scale = asset === "cntn" ? 1 : 1e8;
    const sellQuantity =
      cumulativePercent >= 100 - 1e-9
        ? quantity - sold
        : Math.min(
            quantity - sold,
            Math.floor(((quantity * step.percent) / 100) * scale) / scale,
          );
    sold += sellQuantity;
    const price = basePrice * (1 + step.rise / 100);
    const proceeds = sellQuantity * price * fx;
    cash += proceeds;
    return {
      ...step,
      price,
      sellQuantity,
      proceeds,
      remaining: quantity - sold,
      cash,
      net: other + cash + (quantity - sold) * price * fx - debt,
      debtAfterRepayment: Math.max(0, debt - cash),
      cashAfterRepayment: Math.max(0, cash - debt),
    };
  });
}
export function leverageOutcome(
  principal: number,
  annualRate: number,
  returnPercent: number,
) {
  const value = principal * (1 + returnPercent / 100);
  const profit = value - principal;
  const interest = (principal * annualRate) / 100;
  return {
    returnPercent,
    value,
    profit,
    interest,
    afterInterest: profit - interest,
    netChange: profit - interest,
  };
}
export interface ProjectionPoint {
  year: number;
  house: number;
  investments: number;
  mortgage: number;
  existingDebt: number;
  net: number;
  payment: number;
  cashShortfall: number;
}
export interface HousingResult {
  price: number;
  equity: number;
  mortgage: number;
  initialGap: number;
  cashShortfall: number;
  feasible: boolean;
  points: ProjectionPoint[];
  final: ProjectionPoint;
}
// 연저축액은 생활비 차감 후, 모든 대출 원리금 납부 전 금액. 매월 동일하게 납입합니다.
export function projectHousing(
  holdings: Holdings,
  loans: Loan[],
  inputs: HousingInputs,
  price: number,
): HousingResult {
  const current = portfolio(holdings, loans);
  const equity =
    price === 0
      ? 0
      : Math.min(
          price,
          Math.ceil(Math.max(inputs.equity, price * (1 - inputs.ltv / 100))),
        );
  const mortgage = price - equity;
  const initialGap = Math.max(0, equity - current.liquid);
  const mortgageRows = loanSchedule({
    id: "mortgage",
    name: "주담대",
    principal: Math.round(mortgage),
    rate: inputs.mortgageRate,
    months: inputs.mortgageYears * 12,
    method: "annuity",
  });
  const schedules = loans.map(loanSchedule);
  let investments = Math.max(0, current.liquid - equity);
  let cashShortfall = initialGap;
  let maxGap = initialGap;
  let mortgageBalance = mortgage;
  let existingDebt = current.debt;
  const monthlyGrowth = Math.pow(1 + inputs.stockReturn / 100, 1 / 12);
  const points: ProjectionPoint[] = [
    {
      year: 0,
      house: price,
      investments,
      mortgage,
      existingDebt,
      net: current.net,
      payment: 0,
      cashShortfall,
    },
  ];
  let annualPayment = 0;
  for (let month = 0; month < inputs.years * 12; month++) {
    const mortgageRow = mortgageRows[month];
    mortgageBalance = mortgageRow?.balance ?? 0;
    existingDebt = schedules.reduce(
      (sum, rows) => sum + (rows[month]?.balance ?? 0),
      0,
    );
    const payment =
      (mortgageRow?.payment ?? 0) +
      schedules.reduce((sum, rows) => sum + (rows[month]?.payment ?? 0), 0);
    annualPayment += payment;
    // 미충당 부족액은 수익을 내는 투자금으로 간주하지 않습니다. 이후 현금 유입으로 우선 충당합니다.
    const available =
      investments * monthlyGrowth +
      inputs.annualSaving / 12 -
      payment -
      cashShortfall;
    cashShortfall = Math.max(0, -available);
    maxGap = Math.max(maxGap, cashShortfall);
    investments = Math.max(0, available);
    if ((month + 1) % 12 === 0) {
      const year = (month + 1) / 12;
      const house = price * Math.pow(1 + inputs.houseReturn / 100, year);
      points.push({
        year,
        house,
        investments,
        mortgage: mortgageBalance,
        existingDebt,
        net:
          house +
          investments -
          mortgageBalance -
          existingDebt -
          cashShortfall,
        payment: annualPayment,
        cashShortfall,
      });
      annualPayment = 0;
    }
  }
  return {
    price,
    equity,
    mortgage,
    initialGap,
    cashShortfall: maxGap,
    feasible: maxGap < 1,
    points,
    final: points[points.length - 1],
  };
}
