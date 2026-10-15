import { useState } from "react";
import type { FormEvent } from "react";
import type { StockHolding } from "../strategy/types";
import { NumberField, Panel, money, num, usd, won } from "../strategy/components";
import { stockValue } from "../strategy/finance";
import { effectiveStocks, fetchStock, stockSymbolFromInput, stockCurrency, validStockSymbol, type StockQuote, type StockQuotes } from "./stocks";
const stamp = (time: number) => new Date(time).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
export function StockPanel({ stocks, exchangeRate, quotes, errors, now, onChange, accept }: {
  stocks: StockHolding[]; exchangeRate: number; quotes: StockQuotes;
  errors: Record<string, string>; now: number;
  onChange: (updater: (stocks: StockHolding[]) => StockHolding[]) => void; accept: (quote: StockQuote) => void;
}) {
  const [code, setCode] = useState("");
  const [exchange, setExchange] = useState("US");
  const [quantity, setQuantity] = useState(1);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [price, setPrice] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState("");
  const symbol = stockSymbolFromInput(code, exchange);
  const currency = stockCurrency(symbol);
  const effective = effectiveStocks(stocks, quotes);
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setMessage("");
    if (!validStockSymbol(symbol)) { setMessage("미국은 AAPL 같은 티커, 국내는 005930, 0052D0 같은 6자리 영문·숫자 코드를 입력하세요."); return; }
    if (symbol === "CNTN") { setMessage("CNTN은 이미 기본 자산에 있습니다. 아래 CNTN 보유 수량을 수정하세요."); return; }
    if (stocks.some((s) => s.symbol === symbol)) { setMessage("이미 등록된 종목입니다. 기존 카드의 수량을 수정하세요."); return; }
    if (stocks.length >= 20) { setMessage("추가 주식은 최대 20종목까지 등록할 수 있습니다."); return; }
    setBusy(true);
    try {
      let quote: StockQuote | null = null;
      if (mode === "auto") {
        const result = await fetchStock(symbol, AbortSignal.timeout(20_000));
        if (!result.quote || result.error) throw new Error(result.error || "가격을 찾을 수 없습니다. 종목코드를 확인하세요.");
        quote = result.quote;
        accept(quote);
      }
      onChange((current) => current.some((s) => s.symbol === symbol) || current.length >= 20 ? current : [...current, { symbol, name: quote?.name || symbol, currency, quantity, price: mode === "manual" ? price : 0, mode }]);
      setCode("");
      setMessage(`${symbol} ${num(quantity, 8)}주를 자산에 반영했습니다.`);
    } catch (error) {
      setMessage(`${error instanceof Error ? error.message : "조회 실패"} · 수동 입력으로도 등록할 수 있습니다.`);
    } finally { setBusy(false); }
  }
  const edit = (symbol: string, patch: Partial<StockHolding>) => onChange((current) => current.map((s) => s.symbol === symbol ? { ...s, ...patch } : s));
  return (
    <Panel title="내 주식 추가·관리" subtitle="미국·국내 주식과 ETF를 최대 20종목 추가할 수 있습니다. CNTN은 기본 자산에서 관리합니다.">
      <form className="stock-add" onSubmit={add}>
        <fieldset disabled={busy || stocks.length >= 20}>
          <legend>새 종목 추가</legend>
          <div className="form-grid">
            <label className="field"><span>거래소</span><select aria-label="거래소" value={exchange} onChange={(e) => setExchange(e.target.value)}>
              <option value="US">미국 (USD)</option><option value="KS">국내 코스피 (KRW)</option><option value="KQ">국내 코스닥 (KRW)</option>
            </select></label>
            <label className="field"><span>종목코드</span><input value={code} onChange={(e) => setCode(e.target.value)} required maxLength={16} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder={exchange === "US" ? "예: AAPL, TSLA, NVDA" : "예: 005930, 0052D0"} /></label>
            <NumberField label="추가할 보유 수량" value={quantity} onChange={setQuantity} min={0.00000001} max={1e8} unit="주" />
            <label className="field"><span>새 종목 시세 방식</span><select aria-label="새 종목 시세 방식" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="auto">자동 조회</option><option value="manual">수동 입력 (오프라인 가능)</option></select></label>
            {mode === "manual" && <NumberField label="추가할 주식 가격" value={price} onChange={setPrice} unit={currency} max={currency === "USD" ? 1e6 : 1e8} />}
          </div>
          <button type="submit" className="primary">{busy ? "종목 시세 확인 중…" : mode === "auto" ? "시세 조회 후 추가" : "수동 주식 추가"}</button>
        </fieldset>
      </form>
      <p className="note">예: 애플 → 미국 / AAPL, 삼성전자 → 코스피 / 005930. 자동 시세는 약 60초마다 Yahoo Finance의 최근 정규장 가격을 조회하며 제공처 지연이 있을 수 있습니다. 계좌 잔고는 연결하지 않으며 보유 수량은 직접 입력합니다.</p>
      {message && <p className="notice" role="status">{message}</p>}
      <div className="stock-list">
        {stocks.map((stock, index) => {
          const active = effective[index], quote = quotes[stock.symbol];
          const stale = stock.mode === "auto" && (!quote || !!errors[stock.symbol] || now - quote.receivedAt > 150_000);
          const status = stock.mode === "manual" ? "수동 입력 적용" : !quote ? "시세 미확인 · 수동값 적용" : stale ? "연결 지연 · 마지막 조회값" : quote.marketSession === "outside" ? "장외·휴장 · 최근 정규 시세" : now - quote.asOf > 120_000 ? "제공처 시세 지연" : "자동 조회 · 제공처 지연 가능";
          return <article className="stock-card" key={stock.symbol} aria-label={`${stock.symbol} 보유 주식`}>
            <div className="stock-title"><div><h3>{stock.symbol}</h3><p>{active.name}</p></div><strong title={won(stockValue(active, exchangeRate))}>{money(stockValue(active, exchangeRate))}</strong></div>
            <p className="stock-price">{stock.currency === "USD" ? `${usd(active.price)} USD` : won(active.price)} <small>× {num(stock.quantity, 8)}주{stock.currency === "USD" ? ` · 환율 ${num(exchangeRate)}원` : ""}</small></p>
            <p className={stale ? "negative" : "note"}>{status}</p>
            {stock.mode === "auto" && quote && <p className="note">시세 기준 {stamp(quote.asOf)}<br />마지막 조회 {stamp(quote.receivedAt)} (한국 시간)<br /><a href={quote.sourceUrl} target="_blank" rel="noreferrer">Yahoo Finance에서 보기 ↗</a></p>}
            {stock.mode === "auto" && errors[stock.symbol] && <p className="note negative">{errors[stock.symbol]}</p>}
            <div className="form-grid">
              <NumberField label={`${stock.symbol} 보유 수량`} value={stock.quantity} onChange={(quantity) => edit(stock.symbol, { quantity })} max={1e8} unit="주" />
              <label className="field"><span>{stock.symbol} 시세 방식</span><select aria-label={`${stock.symbol} 시세 방식`} value={stock.mode} onChange={(e) => edit(stock.symbol, { mode: e.target.value as StockHolding["mode"] })}><option value="auto">자동 조회</option><option value="manual">수동 입력</option></select></label>
              {stock.mode === "manual" && <NumberField label={`${stock.symbol} 수동 가격`} value={stock.price} onChange={(price) => edit(stock.symbol, { price })} unit={stock.currency} max={stock.currency === "USD" ? 1e6 : 1e8} />}
            </div>
            {deleting === stock.symbol ? <div className="notice"><p>이 종목을 자산에서 제외할까요? 실제 주식을 매도하지는 않습니다.</p><div className="button-row"><button type="button" onClick={() => setDeleting("")}>취소</button><button type="button" className="danger" onClick={() => { onChange((current) => current.filter((s) => s.symbol !== stock.symbol)); setDeleting(""); }}>자산에서 제외</button></div></div> : <button type="button" className="text-button danger" aria-label={`${stock.symbol} 삭제`} onClick={() => setDeleting(stock.symbol)}>종목 삭제</button>}
          </article>;
        })}
      </div>
      {!stocks.length && <p className="note">아직 추가한 주식이 없습니다. 위에서 첫 종목을 등록하세요.</p>}
    </Panel>
  );
}
