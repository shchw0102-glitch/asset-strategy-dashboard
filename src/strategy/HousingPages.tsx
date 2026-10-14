import { useMemo } from "react";
import type { PageProps } from "./AssetPages";
import type { HousingInputs } from "./types";
import { HOUSE_RETURNS, INTEREST_RATES, STOCK_RETURNS } from "./defaults";
import { projectHousing } from "./finance";
import {
  Amount,
  BarChart,
  LineChart,
  money,
  NumberField,
  Panel,
  percent,
  Table,
  won,
} from "./components";

const colors = [
  "#244f45",
  "#6d8db6",
  "#bea266",
  "#8976ad",
  "#c87f6c",
  "#80a8a0",
];
const priceName = (price: number) =>
  price === 0 ? "투자 유지" : `${money(price)} 매수`;
export function HousingFields({ state, update }: PageProps) {
  const h = state.housing;
  const set = (key: keyof HousingInputs, value: number) =>
    update({ ...state, housing: { ...h, [key]: value } });
  return (
    <Panel
      title="주택·투자 비교 조건"
      subtitle="공통 조건을 바꾸면 매수 비교와 순자산 전망에 함께 반영됩니다."
    >
      <div className="form-grid three">
        <NumberField
          label="사용자 지정 주택가격"
          unit="원"
          step={1}
          value={h.price}
          onChange={(v) => set("price", v)}
        />
        <NumberField
          label="최소 자기자본 투입금"
          unit="원"
          step={1}
          value={h.equity}
          onChange={(v) => set("equity", v)}
          help="LTV 충족에 더 필요하면 자동 증액합니다."
        />
        <NumberField
          label="LTV 상한"
          unit="%"
          max={100}
          value={h.ltv}
          onChange={(v) => set("ltv", v)}
          help="예시 80% · 실제 대출 승인 한도가 아닙니다."
        />
        <NumberField
          label="주택담보대출 연 금리"
          unit="%"
          max={100}
          value={h.mortgageRate}
          onChange={(v) => set("mortgageRate", v)}
        />
        <NumberField
          label="주택담보대출 기간"
          unit="년"
          min={1}
          max={50}
          step={1}
          value={h.mortgageYears}
          onChange={(v) => set("mortgageYears", v)}
        />
        <NumberField
          label="연간 집값 상승률"
          unit="%"
          min={-100}
          max={100}
          value={h.houseReturn}
          onChange={(v) => set("houseReturn", v)}
        />
        <NumberField
          label="연간 주식 기대수익률"
          unit="%"
          min={-100}
          max={100}
          value={h.stockReturn}
          onChange={(v) => set("stockReturn", v)}
        />
        <NumberField
          label="연간 저축액 (대출 납부 전)"
          unit="원"
          step={1}
          value={h.annualSaving}
          onChange={(v) => set("annualSaving", v)}
          help="생활비 차감 후, 모든 대출 원리금 차감 전"
        />
        <NumberField
          label="비교기간"
          unit="년"
          min={1}
          max={30}
          step={1}
          value={h.years}
          onChange={(v) => set("years", v)}
        />
      </div>
    </Panel>
  );
}
export function Assumptions() {
  return (
    <details className="assumptions">
      <summary>계산 가정 및 자금 부족 처리</summary>
      <ul>
        <li>
          예적금·CNTN·CC·추가 주식 평가액을 처분 가능한 투자자금으로 합산합니다. 매수 시
          자기자본을 빼고 남은 자금 전체에 주식 기대수익률을 적용합니다.
        </li>
        <li>
          모든 시나리오는 현재 자산·부채와 같은 출발점입니다.
        </li>
        <li>
          자기자본 = 주택가격 이내에서 max(입력 자기자본, 주택가격 × (1 − LTV)).
          주담대는 나머지 금액을 원리금균등으로 상환합니다.
        </li>
        <li>
          매월 투자수익 반영 후 저축액의 1/12을 추가하고 기존 대출 및 주담대
          원리금을 차감합니다. 대출 B는 설정된 만기에 원금 전액을 차감합니다.
        </li>
        <li>
          초기 자기자본 또는 중간 상환 재원이 부족하면 실행 불가로 표시하고 비교
          그래프에서 제외합니다. 부족액을 외부에서 조달했다고 가정하지 않습니다.
        </li>
        <li>
          취득·매도세, 보유세, 중개·대출 수수료, 유지비, 임차보증금·월세 차이,
          투자 세금은 제외합니다. 두 경우의 주거 생활비는 같은 것으로
          가정합니다. DSR 및 실제 대출 가능 여부는 계산하지 않습니다.
        </li>
      </ul>
    </details>
  );
}
export function HousingPage(props: PageProps) {
  const { state } = props,
    h = state.housing;
  const results = useMemo(
    () =>
      [
        ...new Set([
          0,
          300_000_000,
          400_000_000,
          450_000_000,
          500_000_000,
          h.price,
        ]),
      ].map((price) => projectHousing(state.holdings, state.loans, h, price)),
    [state.holdings, state.loans, h],
  );
  return (
    <>
      <HousingFields {...props} />
      <Assumptions />
      <Panel
        title={`${h.years}년 뒤 예상 순자산 비교`}
        subtitle="현재 가격을 출발점으로 계산합니다. 금액이 가장 큰 시나리오가 실제 수익을 보장하지는 않습니다."
      >
        <BarChart
          label={`${h.years}년 뒤 주택 시나리오별 순자산`}
          items={results
            .filter((r) => r.feasible)
            .map((r, i) => ({
              label: priceName(r.price),
              value: r.final.net,
              color: colors[i % colors.length],
            }))}
        />
      </Panel>
      <Panel title="매수 자금과 미래 자산 상세">
        <Table label="아파트 매수 시나리오 비교">
          <thead>
            <tr>
              <th>시나리오</th>
              <th>실제 자기자본</th>
              <th>초기 주담대</th>
              <th>{h.years}년 뒤 집값</th>
              <th>남은 주담대</th>
              <th>남은 기존 대출</th>
              <th>투자자산</th>
              <th>예상 순자산 / 상태</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.price}>
                <th>{priceName(r.price)}</th>
                <td>
                  <Amount value={r.equity} />
                </td>
                <td>
                  <Amount value={r.mortgage} />
                </td>
                <td>{r.feasible ? <Amount value={r.final.house} /> : "—"}</td>
                <td>
                  {r.feasible ? <Amount value={r.final.mortgage} /> : "—"}
                </td>
                <td>
                  {r.feasible ? <Amount value={r.final.existingDebt} /> : "—"}
                </td>
                <td>
                  {r.feasible ? <Amount value={r.final.investments} /> : "—"}
                </td>
                <td className={r.feasible ? "positive" : "negative"}>
                  {r.feasible ? (
                    <Amount value={r.final.net} />
                  ) : (
                    <span>
                      자금 부족
                      <br />
                      <small>
                        {r.initialGap > 0 ? "초기" : "상환 중"}{" "}
                        {money(r.initialGap || r.cashShortfall)}
                      </small>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </>
  );
}
export function ForecastPage(props: PageProps) {
  const { state } = props,
    h = state.housing;
  const baseline = useMemo(
    () => projectHousing(state.holdings, state.loans, h, 0),
    [state.holdings, state.loans, h],
  );
  const house = useMemo(
    () => projectHousing(state.holdings, state.loans, h, h.price),
    [state.holdings, state.loans, h],
  );
  const matrix = useMemo(
    () =>
      STOCK_RETURNS.map((stock) =>
        HOUSE_RETURNS.map((property) =>
          projectHousing(
            state.holdings,
            state.loans,
            { ...h, stockReturn: stock, houseReturn: property },
            h.price,
          ),
        ),
      ),
    [state.holdings, state.loans, h],
  );
  const rateResults = useMemo(
    () =>
      INTEREST_RATES.map((rate) => ({
        rate,
        result: projectHousing(
          state.holdings,
          state.loans,
          { ...h, mortgageRate: rate },
          h.price,
        ),
      })),
    [state.holdings, state.loans, h],
  );
  return (
    <>
      <HousingFields {...props} />
      <Assumptions />
      <Panel
        title={`${h.years}년 순자산 전망`}
        subtitle={`선택 주택 ${money(h.price)} · 주식 ${percent(h.stockReturn)} · 집값 ${percent(h.houseReturn)} · 주담대 ${h.mortgageRate}%`}
      >
        <LineChart
          series={[
            { name: "투자 유지", result: baseline, color: colors[0] },
            { name: priceName(h.price), result: house, color: colors[1] },
          ]
            .filter((s) => s.result.feasible)
            .map((s) => ({
              name: s.name,
              color: s.color,
              values: s.result.points.map((p) => p.net),
            }))}
        />
        {(!baseline.feasible || !house.feasible) && (
          <p className="notice warning">
            자금 부족 시나리오는 그래프에서 제외했습니다. 아파트 매수 비교에서
            필요 자금을 확인하세요.
          </p>
        )}
        <Table label="연도별 예상 순자산">
          <thead>
            <tr>
              <th>시점</th>
              <th>투자 유지 순자산</th>
              <th>주택 매수 순자산</th>
              <th>매수 시 연 원리금</th>
              <th>매수 시 남은 주담대</th>
            </tr>
          </thead>
          <tbody>
            {house.points.map((p, i) => (
              <tr key={p.year}>
                <th>{p.year === 0 ? "현재" : `${p.year}년 뒤`}</th>
                <td>
                  {baseline.feasible
                    ? won(baseline.points[i].net)
                    : "자금 부족"}
                </td>
                <td>{house.feasible ? won(p.net) : "자금 부족"}</td>
                <td>{house.feasible ? won(p.payment) : "—"}</td>
                <td>{house.feasible ? won(p.mortgage) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <Panel
        title="주식 수익률 × 주택 상승률 민감도"
        subtitle={`${h.years}년 뒤 주택 매수 순자산 · 주담대 금리 ${h.mortgageRate}% 고정 · 초록색 ✓는 1억원 이상`}
      >
        <Table label="주식과 주택 수익률 민감도">
          <thead>
            <tr>
              <th>주식 ↓ / 집값 →</th>
              {HOUSE_RETURNS.map((r) => (
                <th key={r}>{percent(r)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <th>{percent(STOCK_RETURNS[i])}</th>
                {row.map((r, j) => (
                  <td
                    key={j}
                    title={
                      r.feasible
                        ? won(r.final.net)
                        : `최대 자금 부족 ${won(r.cashShortfall)}`
                    }
                    className={
                      r.feasible && r.final.net >= 1e8 ? "achieved" : ""
                    }
                  >
                    {r.feasible
                      ? `${r.final.net >= 1e8 ? "✓ " : ""}${money(r.final.net)}`
                      : "자금 부족"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <Panel
        title="대출금리 민감도"
        subtitle={`주식 ${percent(h.stockReturn)}, 주택 ${percent(h.houseReturn)} 고정 · 기존 대출 금리는 유지합니다.`}
      >
        <BarChart
          label="주담대 금리별 예상 순자산"
          items={rateResults
            .filter((r) => r.result.feasible)
            .map((r) => ({
              label: `연 ${r.rate}%`,
              value: r.result.final.net,
            }))}
        />
        <Table label="대출금리별 순자산">
          <thead>
            <tr>
              <th>주담대 금리</th>
              <th>{h.years}년 뒤 순자산</th>
              <th>남은 주담대</th>
            </tr>
          </thead>
          <tbody>
            {rateResults.map((r) => (
              <tr key={r.rate}>
                <th>{r.rate}%</th>
                <td>
                  {r.result.feasible ? won(r.result.final.net) : "자금 부족"}
                </td>
                <td>
                  {r.result.feasible ? won(r.result.final.mortgage) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </>
  );
}
