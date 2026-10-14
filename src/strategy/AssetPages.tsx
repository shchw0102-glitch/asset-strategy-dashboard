import { newId } from "../services/id";
import type { ReactNode } from "react";
import { useState } from "react";
import type { Holdings, StrategyState } from "./types";
import { CC_SCENARIOS, CNTN_SCENARIOS, TARGET } from "./defaults";
import { portfolio, salePlan, targetPrice, stocksValue } from "./finance";
import {
  Amount,
  BarChart,
  money,
  num,
  NumberField,
  Panel,
  percent,
  Stat,
  Table,
  usd,
  won,
} from "./components";

export type PageProps = {
  stockPanel?: ReactNode;
  state: StrategyState;
  update: (next: StrategyState) => void;
};
export function AssetsPage({ state, update, stockPanel }: PageProps) {
  const h = state.holdings,
    p = portfolio(h, state.loans);
  const set = (key: keyof Holdings, value: number) =>
    update({ ...state, holdings: { ...h, [key]: value } });
  const ratio = (p.net / TARGET) * 100;
  return (
    <>
      <div className="stats five">
        <Stat label="총자산" value={p.assets} />
        <Stat label="총부채" value={p.debt} />
        <Stat label="현재 순자산" value={p.net} accent />
        <Stat
          label="1억원까지 남은 금액"
          value={Math.max(0, TARGET - p.net)}
          detail={
            p.net >= TARGET
              ? "목표를 달성했습니다"
              : "목표 순자산 100,000,000원"
          }
        />
        <div className="stat">
          <span>1억원 목표 달성률</span>
          <strong>
            {num(ratio, 1)}
            <em>%</em>
          </strong>
          <div className="progress">
            <i style={{ width: `${Math.max(0, Math.min(100, ratio))}%` }} />
          </div>
          <small>순자산 ÷ 1억원 · 음수도 표시</small>
        </div>
      </div>
      {stockPanel}
      <div className="two-columns">
        <Panel
          title="내 자산 입력"
          subtitle="값을 바꾸면 모든 계산에 즉시 반영됩니다."
        >
          <div className="form-grid">
            <NumberField
              label="예적금 및 현금성 자산"
              value={h.cash}
              onChange={(v) => set("cash", v)}
              unit="원"
              step={1}
            />
            <NumberField
              label="CNTN 보유 수량"
              value={h.cntnQuantity}
              onChange={(v) => set("cntnQuantity", v)}
              unit="주"
              step={1}
              max={1e8}
            />
            <NumberField
              label="CNTN 현재 가격 (USD)"
              value={h.cntnPrice}
              onChange={(v) => set("cntnPrice", v)}
              unit="USD"
              max={1e6}
              disabled={state.market.cntn === "auto"}
              help={
                state.market.cntn === "auto"
                  ? "위 시세 카드에서 수동 입력으로 바꾸면 수정할 수 있습니다."
                  : "사용자 입력값 · 자동 시세와 별도로 저장됩니다."
              }
            />
            <NumberField
              label="CC 보유 수량"
              value={h.ccQuantity}
              onChange={(v) => set("ccQuantity", v)}
              unit="개"
              max={1e9}
            />
            <NumberField
              label="CC 현재 가격 (KRW)"
              disabled={state.market.cc === "auto"}
              help={
                state.market.cc === "auto"
                  ? "업비트 자동 반영 · 수동 전환은 위 카드에서"
                  : "사용자 입력값"
              }
              value={h.ccPrice}
              onChange={(v) => set("ccPrice", v)}
              unit="원"
              max={1e8}
            />
            <NumberField
              label="USD/KRW 환율"
              value={h.exchangeRate}
              onChange={(v) => set("exchangeRate", v)}
              unit="원/USD"
              min={1}
              max={1e5}
              disabled={state.market.fx === "auto"}
              help={
                state.market.fx === "auto"
                  ? "환율 자동 반영 · 수동 전환은 위 카드에서"
                  : "사용자 입력값 · 자동 환율과 별도로 저장됩니다."
              }
            />
          </div>
        </Panel>
        <Panel title="자산 구성" subtitle="CNTN·CC를 포함한 현재 입력값 기준">
          <BarChart
            label="자산별 평가금액"
            items={[
              { label: "예적금·현금", value: h.cash },
              { label: "추가 주식", value: p.stocks, color: "#a6b7a7" },
              {
                label: `CNTN ${usd(h.cntnPrice)}`,
                value: p.cntn,
                color: "#638cdb",
              },
              { label: `CC ${won(h.ccPrice)}`, value: p.cc, color: "#cda865" },
            ]}
          />
          <dl className="summary-list">
            <div>
              <dt>CNTN 원화 평가</dt>
              <dd>{won(p.cntn)}</dd>
            </div>
            <div>
              <dt>CC 원화 평가</dt>
              <dd>{won(p.cc)}</dd>
            </div>
            <div>
              <dt>총자산 − 총부채</dt>
              <dd className={p.net < 0 ? "negative" : "positive"}>
                {won(p.net)}
              </dd>
            </div>
          </dl>
          <p className="note">
            현재 적용 중인 가격과 조회 상태는 위 시세 카드에서 확인하세요. 보유
            수량은 직접 입력하고 대출은 ‘대출 관리’에서 변경할 수 있습니다.
          </p>
        </Panel>
      </div>
      <Panel
        title="부채 한눈에 보기"
        subtitle="남은 원금 기준 · 자세한 월별 상환표는 대출 관리에서 확인하세요."
      >
        <Table label="현재 대출 목록">
          <thead>
            <tr>
              <th>대출</th>
              <th>남은 원금</th>
              <th>연 금리</th>
              <th>남은 기간</th>
              <th>상환방식</th>
            </tr>
          </thead>
          <tbody>
            {state.loans.map((l) => (
              <tr key={l.id}>
                <th>{l.name}</th>
                <td>
                  <Amount value={l.principal} />
                </td>
                <td>{l.rate}%</td>
                <td>{l.months}개월</td>
                <td>
                  {l.method === "equal-principal"
                    ? "원금균등"
                    : l.method === "annuity"
                      ? "원리금균등"
                      : "만기일시"}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {!state.loans.length && <p>등록한 대출이 없습니다.</p>}
      </Panel>
    </>
  );
}
export function TargetsPage({ state, update }: PageProps) {
  const h = state.holdings,
    s = state.scenario;
  const current = portfolio(h, state.loans);
  const projected = portfolio({ ...h, ...s }, state.loans);
  const cntn = targetPrice(
    TARGET,
    h.cash + stocksValue(h) + h.ccQuantity * s.ccPrice,
    current.debt,
    h.cntnQuantity,
    h.exchangeRate,
  );
  const cc = targetPrice(
    TARGET,
    h.cash + stocksValue(h) + h.cntnQuantity * s.cntnPrice * h.exchangeRate,
    current.debt,
    h.ccQuantity,
  );
  return (
    <>
      <div className="two-columns">
        <Panel
          title="가격을 바꿔 미래를 그려보세요"
          subtitle="시뮬레이션 가격은 현재 자산 가격과 별도로 저장됩니다."
          action={
            <button
              className="text-button"
              onClick={() =>
                update({
                  ...state,
                  scenario: { cntnPrice: h.cntnPrice, ccPrice: h.ccPrice },
                })
              }
            >
              현재 가격 가져오기
            </button>
          }
        >
          <div className="form-grid">
            <NumberField
              label="CNTN 시나리오 가격"
              value={s.cntnPrice}
              onChange={(v) =>
                update({ ...state, scenario: { ...s, cntnPrice: v } })
              }
              unit="USD"
              max={1e6}
            />
            <NumberField
              label="CC 시나리오 가격"
              value={s.ccPrice}
              onChange={(v) =>
                update({ ...state, scenario: { ...s, ccPrice: v } })
              }
              unit="원"
              max={1e8}
            />
          </div>
          <p className="note">
            환율 {num(h.exchangeRate)}원/USD · 보유 수량과 부채는 자산 현황 기준
          </p>
        </Panel>
        <div className="stats two">
          <Stat label="시나리오 예상 순자산" value={projected.net} accent />
          <Stat label="현재 대비 변화" value={projected.net - current.net} />
        </div>
      </div>
      <Panel
        title="1억원을 만드는 목표 가격"
        subtitle="다른 자산·부채·환율은 고정합니다. 실행 가격은 목표 미달을 피하도록 올림 표시합니다."
      >
        <div className="target-grid">
          <div>
            <span>CC {won(s.ccPrice)} 고정 시</span>
            <strong>
              {cntn === null ? "달성 불가" : usd(Math.ceil(cntn * 100) / 100)}
            </strong>
            <p>필요한 CNTN 가격 (USD)</p>
            <small>
              {cntn === null
                ? "CNTN 보유 수량이 0입니다."
                : cntn === 0
                  ? "다른 자산만으로 목표 달성"
                  : `계산값 ${usd(cntn)} · 환율 ${num(h.exchangeRate)}원`}
            </small>
          </div>
          <div>
            <span>CNTN {usd(s.cntnPrice)} 고정 시</span>
            <strong>{cc === null ? "달성 불가" : won(Math.ceil(cc))}</strong>
            <p>필요한 CC 가격 (KRW)</p>
            <small>
              {cc === null
                ? "CC 보유 수량이 0입니다."
                : cc === 0
                  ? "다른 자산만으로 목표 달성"
                  : `계산값 ${num(cc, 4)}원`}
            </small>
          </div>
        </div>
      </Panel>
      <Panel
        title="CNTN × CC 가격 조합"
        subtitle="셀 값은 예상 순자산입니다. 초록색 ✓ 표시는 1억원 이상 달성입니다."
      >
        <Table label="CNTN CC 가격별 순자산">
          <thead>
            <tr>
              <th>CNTN ↓ / CC →</th>
              {CC_SCENARIOS.map((price) => (
                <th key={price}>{won(price)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CNTN_SCENARIOS.map((price) => (
              <tr key={price}>
                <th>{usd(price)} USD</th>
                {CC_SCENARIOS.map((ccPrice) => {
                  const value = portfolio(
                    { ...h, cntnPrice: price, ccPrice },
                    state.loans,
                  ).net;
                  return (
                    <td
                      key={ccPrice}
                      className={
                        value >= TARGET
                          ? "achieved"
                          : value < 0
                            ? "negative"
                            : ""
                      }
                      title={won(value)}
                    >
                      {value >= TARGET && "✓ "}
                      {money(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </>
  );
}
export function SalesPage({ state, update }: PageProps) {
  const [asset, setAsset] = useState<"cntn" | "cc">("cntn");
  const steps = state.sales[asset];
  const total = steps.reduce((sum, step) => sum + step.percent, 0);
  let rows: ReturnType<typeof salePlan> = [],
    error = "";
  try {
    rows = salePlan(
      state.holdings,
      portfolio(state.holdings, state.loans).debt,
      asset,
      steps,
    );
  } catch (e) {
    error = (e as Error).message;
  }
  const setSteps = (next: typeof steps) =>
    update({ ...state, sales: { ...state.sales, [asset]: next } });
  return (
    <>
      <div className="tabs" aria-label="매도 자산 선택">
        {(["cntn", "cc"] as const).map((a) => (
          <button
            key={a}
            className={a === asset ? "active" : ""}
            onClick={() => setAsset(a)}
          >
            {a.toUpperCase()} 분할매도
          </button>
        ))}
      </div>
      <Panel
        title={`${asset.toUpperCase()} 매도 계획`}
        subtitle={`기준가격 ${asset === "cntn" ? `${usd(state.holdings.cntnPrice)} USD` : won(state.holdings.ccPrice)} · 최초 보유 수량의 비율로 매도합니다.`}
        action={
          <button
            onClick={() =>
              setSteps([
                ...steps,
                {
                  id: newId(),
                  rise: (steps.at(-1)?.rise ?? 0) + 50,
                  percent: 10,
                },
              ])
            }
            disabled={steps.length >= 12}
          >
            + 단계 추가
          </button>
        }
      >
        <div className="sale-steps">
          {steps.map((step, i) => (
            <div className="sale-step" key={step.id}>
              <span className="step-index">
                {String(i + 1).padStart(2, "0")}
              </span>
              <NumberField
                label={`${i + 1}단계 상승률`}
                unit="% 상승"
                value={step.rise}
                max={10000}
                onChange={(v) =>
                  setSteps(
                    steps.map((s) =>
                      s.id === step.id ? { ...s, rise: v } : s,
                    ),
                  )
                }
              />
              <NumberField
                label={`${i + 1}단계 매도 비율`}
                unit="% 매도"
                value={step.percent}
                max={100}
                onChange={(v) =>
                  setSteps(
                    steps.map((s) =>
                      s.id === step.id ? { ...s, percent: v } : s,
                    ),
                  )
                }
              />
              <button
                className="text-button danger"
                aria-label={`${i + 1}단계 삭제`}
                onClick={() => setSteps(steps.filter((s) => s.id !== step.id))}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
        <p
          className={error ? "notice warning" : "note"}
          role={error ? "alert" : undefined}
        >
          {error ||
            `누적 매도 ${num(total, 2)}% · CNTN은 정수 주식 단위로 내림, CC는 소수 8자리까지 계산합니다. 총 100% 매도 시 마지막 단계에서 잔여 수량을 모두 매도합니다.`}
        </p>
      </Panel>
      {!error && (
        <Panel
          title="단계별 예상 결과"
          subtitle="해당 자산의 가격만 상승하고 다른 자산은 현재 가격을 유지하는 독립 시뮬레이션입니다."
        >
          <Table label="분할매도 결과">
            <thead>
              <tr>
                <th>단계 / 상승률</th>
                <th>매도가격</th>
                <th>매도 수량</th>
                <th>매도 금액</th>
                <th>잔여 수량</th>
                <th>누적 확보 현금</th>
                <th>매도 후 순자산</th>
                <th>상환 시 남은 대출</th>
                <th>상환 후 확보 현금</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <th>
                    {i + 1}단계 · {percent(r.rise)}
                  </th>
                  <td>
                    {asset === "cntn" ? `${usd(r.price)} USD` : won(r.price)}
                  </td>
                  <td>{num(r.sellQuantity, 8)}</td>
                  <td>
                    <Amount value={r.proceeds} />
                  </td>
                  <td>{num(r.remaining, 8)}</td>
                  <td>
                    <Amount value={r.cash} />
                  </td>
                  <td>
                    <Amount value={r.net} />
                  </td>
                  <td>
                    <Amount value={r.debtAfterRepayment} />
                  </td>
                  <td>
                    <Amount value={r.cashAfterRepayment} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="note">
            ‘누적 확보 현금’은 매도대금만 합산합니다. 대출 상환 열은 이 현금을
            즉시 전액 상환에 쓰는 별도 경우입니다. 원금 상환 자체는 현금과
            부채를 같은 금액 줄여 순자산을 바꾸지 않습니다.
            세금·수수료·중도상환수수료는 제외합니다. 실제 보유 수량과 대출
            기록은 변경하지 않습니다.
          </p>
        </Panel>
      )}
    </>
  );
}
