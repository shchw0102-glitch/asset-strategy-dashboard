import { describe, it, expect } from "vitest";
import { validStockSymbol, stockCurrency, validStockQuote, effectiveStocks, mergeStockQuote, type StockQuote } from "./stocks";
import { newDefaultState } from "../strategy/defaults";
import { parseState } from "../strategy/storage";
import { portfolio, salePlan, targetPrice, projectHousing } from "../strategy/finance";
import type { StockHolding } from "../strategy/types";
const now = Date.now();
const quote: StockQuote = { symbol: "AAPL", name: "Apple Inc.", currency: "USD", price: 200, asOf: now, receivedAt: now, source: "Yahoo Finance", sourceUrl: "https://finance.yahoo.com/quote/AAPL/", marketSession: "regular" };
const stocks: StockHolding[] = [
  { symbol: "AAPL", name: "Apple", currency: "USD", quantity: 2.5, price: 100, mode: "auto" },
  { symbol: "005930.KS", name: "삼성전자", currency: "KRW", quantity: 10, price: 70000, mode: "manual" },
];
describe("추가 주식 및 연금 제거", () => {
  it("미국·국내 주식 코드만 받고 URL·외환·가상자산 코드는 거부한다", () => {
    for (const symbol of ["AAPL", "BRK-B", "005930.KS", "035900.KQ"]) expect(validStockSymbol(symbol)).toBe(true);
    for (const symbol of ["https://example.com", "../AAPL", "KRW=X", "BTC-USD", "005930", "aapl"]) expect(validStockSymbol(symbol)).toBe(false);
    expect(stockCurrency("AAPL")).toBe("USD");
    expect(stockCurrency("005930.KS")).toBe("KRW");
  });
  it("종목·통화·출처·가격·시각을 검증하고 과거 시세를 적용하지 않는다", () => {
    expect(validStockQuote(quote, "AAPL", now)).toBe(true);
    for (const patch of [{currency:"KRW"}, {symbol:"TSLA"}, {price:0}, {price:Infinity}, {asOf:now+60000}, {sourceUrl:"javascript:alert(1)"}])
      expect(validStockQuote({...quote, ...patch}, "AAPL", now)).toBe(false);
    expect(mergeStockQuote({AAPL:quote}, {...quote, asOf:now-1000, price:50}).AAPL.price).toBe(200);
  });
  it("자동 시세·환율을 평가에 반영하고 원본 수동 가격은 보존한다", () => {
    const h = newDefaultState().holdings;
    const result = portfolio({...h, stocks: effectiveStocks(stocks, {AAPL:quote})}, []);
    expect(result.stocks).toBe(2.5 * 200 * 1400 + 10 * 70000);
    expect(result.assets - portfolio(h, []).assets).toBe(result.stocks);
    expect(stocks[0].price).toBe(100);
    expect(effectiveStocks(stocks, {})[0].price).toBe(100);
    expect(effectiveStocks([{...stocks[0], mode:"manual"}], {AAPL:quote})[0].price).toBe(100);
  });
  it("이전 백업에서 연금만 제거하고 현금·대출·기존 입력값을 보존한다", () => {
    const old = JSON.parse(JSON.stringify(newDefaultState()));
    delete old.holdings.stocks;
    old.holdings.pension = 10000000;
    old.holdings.cash = 123456;
    const migrated = parseState(JSON.stringify(old));
    expect(migrated.holdings).not.toHaveProperty("pension");
    expect(migrated.holdings.stocks).toEqual([]);
    expect(migrated.holdings.cash).toBe(123456);
    expect(migrated.loans).toEqual(old.loans);
  });
  it("주식 백업 왕복과 삭제를 보존하며 중복·잘못된 통화·수량을 거부한다", () => {
    const state = newDefaultState(); state.holdings.stocks = structuredClone(stocks);
    expect(parseState(JSON.stringify(state))).toEqual(state);
    for (const invalid of [[stocks[0], stocks[0]], [{...stocks[0],currency:"KRW"}], [{...stocks[0],quantity:-1}], [{...stocks[0],symbol:"CNTN"}], Array.from({length:21},()=>stocks[0])]) {
      expect(() => parseState(JSON.stringify({...state,holdings:{...state.holdings,stocks:invalid}}))).toThrow();
    }
    state.holdings.stocks = [];
    expect(parseState(JSON.stringify(state)).holdings.stocks).toEqual([]);
  });
  it("추가 주식을 목표 역산·매도 순자산·주택 복리에 한번씩 반영한다", () => {
    const state = newDefaultState(), base = state.holdings;
    const h = {...base, stocks};
    const p = portfolio(h, state.loans), added = 1050000;
    expect(p.stocks).toBe(added);
    const price = targetPrice(1e8, h.cash + p.stocks + p.cc, p.debt, h.cntnQuantity, h.exchangeRate)!;
    expect(portfolio({...h, cntnPrice:price},state.loans).net).toBeCloseTo(1e8, 4);
    const step = [{id:"1",rise:30,percent:10}];
    expect(salePlan(h,p.debt,"cntn",step)[0].net - salePlan(base,p.debt,"cntn",step)[0].net).toBeCloseTo(added);
    const assumptions = {...state.housing, annualSaving:0, stockReturn:5, years:5, equity:10000000};
    for (const price of [0,20000000]) {
      const result = projectHousing(h,[],assumptions,price), original=projectHousing(base,[],assumptions,price);
      expect(result.final.net-original.final.net).toBeCloseTo(added*1.05**5,3);
    }
    expect(portfolio({...h,stocks:[]},state.loans)).toEqual(portfolio(base,state.loans));
  });
});
