import { newId } from "../services/id";
import { useState } from "react";
import type { FormEvent } from "react";
import type { Loan, Repayment } from "./types";
import type { PageProps } from "./AssetPages";
import { leverageOutcome, loanSchedule, portfolio } from "./finance";
import {
  Amount,
  BarChart,
  money,
  NumberField,
  Panel,
  percent,
  Stat,
  Table,
  won,
} from "./components";

const methods: Record<Repayment, string> = {
  "equal-principal": "원금균등",
  annuity: "원리금균등",
  bullet: "만기일시",
};
const blankLoan = (): Loan => ({
  id: "",
  name: "",
  principal: 12_000_000,
  rate: 5.5,
  months: 60,
  method: "bullet",
});
export function LoansPage({ state, update }: PageProps) {
  const [selected, setSelected] = useState(state.loans[0]?.id ?? "");
  const [draft, setDraft] = useState<Loan>(blankLoan);
  const [editing, setEditing] = useState(false);
  const [deleteId, setDeleteId] = useState("");
  const loan = state.loans.find((l) => l.id === selected) ?? state.loans[0];
  const rows = loan ? loanSchedule(loan) : [];
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || (!draft.id && state.loans.length >= 30)) return;
    const next = {
      ...draft,
      id: draft.id || newId(),
      name: draft.name.trim(),
    };
    update({
      ...state,
      loans: draft.id
        ? state.loans.map((l) => (l.id === draft.id ? next : l))
        : [...state.loans, next],
    });
    setSelected(next.id);
    setDraft(blankLoan());
    setEditing(false);
  };
  return (
    <>
      <div className="stats three">
        <Stat
          label="총 대출 잔액"
          value={portfolio(state.holdings, state.loans).debt}
        />
        <Stat
          label="모든 대출 첫 달 납입액"
          value={state.loans.reduce(
            (sum, l) => sum + loanSchedule(l)[0].payment,
            0,
          )}
        />
        <Stat
          label="모든 대출 잔여 총이자"
          value={state.loans.reduce(
            (sum, l) =>
              sum + loanSchedule(l).reduce((s, r) => s + r.interest, 0),
            0,
          )}
        />
      </div>
      <Panel
        title="대출 목록"
        subtitle="금액은 현재 남은 원금, 기간은 앞으로 남은 개월 수입니다. 대출 B의 초기 만기 60개월은 수정 가능한 예시입니다."
        action={
          <button
            onClick={() => {
              setDraft(blankLoan());
              setEditing(true);
            }}
            disabled={state.loans.length >= 30}
          >
            + 대출 추가
          </button>
        }
      >
        <div className="loan-cards">
          {state.loans.map((l) => (
            <div
              className={`loan-card ${l.id === loan?.id ? "selected" : ""}`}
              key={l.id}
            >
              <button className="loan-select" onClick={() => setSelected(l.id)}>
                <span>
                  {l.name} <small>{methods[l.method]}</small>
                </span>
                <strong>{money(l.principal)}</strong>
                <p>
                  연 {l.rate}% · {l.months}개월
                </p>
              </button>
              <div className="loan-actions">
                <button
                  className="text-button"
                  onClick={() => {
                    setDraft({ ...l });
                    setEditing(true);
                  }}
                >
                  수정
                </button>
                <button
                  className="text-button danger"
                  onClick={() => setDeleteId(l.id)}
                >
                  삭제
                </button>
              </div>
              {deleteId === l.id && (
                <div className="delete-confirm">
                  <span>이 대출을 삭제할까요?</span>
                  <button
                    onClick={() => {
                      update({
                        ...state,
                        loans: state.loans.filter((x) => x.id !== l.id),
                      });
                      setDeleteId("");
                    }}
                  >
                    삭제 확인
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setDeleteId("")}
                  >
                    취소
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {!state.loans.length && (
          <p>대출이 없습니다. ‘대출 추가’로 등록하세요.</p>
        )}
      </Panel>
      {editing && (
        <Panel title={draft.id ? "대출 수정" : "새 대출 입력"}>
          <form onSubmit={save}>
            <div className="form-grid three">
              <label className="field">
                <span>대출 이름</span>
                <input
                  value={draft.name}
                  required
                  maxLength={60}
                  placeholder="예: 생활자금 대출"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <NumberField
                label="대출금액"
                unit="원"
                value={draft.principal}
                step={1}
                onChange={(v) => setDraft({ ...draft, principal: v })}
              />
              <NumberField
                label="연 금리"
                unit="%"
                max={100}
                value={draft.rate}
                onChange={(v) => setDraft({ ...draft, rate: v })}
              />
              <NumberField
                label="남은 기간"
                unit="개월"
                min={1}
                max={600}
                step={1}
                value={draft.months}
                onChange={(v) => setDraft({ ...draft, months: v })}
              />
              <label className="field">
                <span>상환방식</span>
                <select
                  aria-label="상환방식"
                  value={draft.method}
                  onChange={(e) =>
                    setDraft({ ...draft, method: e.target.value as Repayment })
                  }
                >
                  {Object.entries(methods).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="button-row">
              <button type="submit" className="primary">
                대출 저장
              </button>
              <button type="button" onClick={() => setEditing(false)}>
                취소
              </button>
            </div>
          </form>
        </Panel>
      )}
      {loan && (
        <Panel
          title={`${loan.name} · 월별 상환표`}
          subtitle={`${methods[loan.method]} · 원금 ${won(loan.principal)} · 연 ${loan.rate}% · ${loan.months}개월`}
        >
          {loan.method === "bullet" && (
            <p className="notice">
              매월 이자 {won(rows[0].interest)} · 만기 상환 원금{" "}
              {won(loan.principal)} · 마지막 달 납입액{" "}
              {won(rows.at(-1)!.payment)}
            </p>
          )}
          <div className="schedule">
            <Table label={`${loan.name} 월별 상환표`}>
              <thead>
                <tr>
                  <th>회차</th>
                  <th>월 원금</th>
                  <th>월 이자</th>
                  <th>월 납입액</th>
                  <th>남은 원금</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.month}>
                    <th>{row.month}개월</th>
                    <td>{won(row.principal)}</td>
                    <td>{won(row.interest)}</td>
                    <td>{won(row.payment)}</td>
                    <td>{won(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>합계</th>
                  <td>{won(loan.principal)}</td>
                  <td>{won(rows.reduce((s, r) => s + r.interest, 0))}</td>
                  <td>{won(rows.reduce((s, r) => s + r.payment, 0))}</td>
                  <td>0원</td>
                </tr>
              </tfoot>
            </Table>
          </div>
          <p className="note">
            월 이율 = 연 금리 ÷ 12. 이자는 원 단위 반올림, 원금균등은 원 단위
            내림 후 마지막 달에 잔액을 정산합니다. 실제 은행의 일수
            계산·납부일에 따라 차이가 날 수 있습니다.
          </p>
        </Panel>
      )}
    </>
  );
}
export function LeveragePage({ state, update }: PageProps) {
  const l = state.leverage;
  const rows = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 50].map((rate) =>
    leverageOutcome(l.principal, l.rate, rate),
  );
  return (
    <>
      <Panel
        title="추가 대출 투자 가정"
        subtitle="1년 보유 · 만기일시상환 · 투자금 전액을 대출로 조달 · 현재 대출 기록에는 추가하지 않습니다."
      >
        <div className="form-grid">
          <NumberField
            label="추가 대출 투자금"
            unit="원"
            step={1}
            value={l.principal}
            onChange={(v) =>
              update({ ...state, leverage: { ...l, principal: v } })
            }
          />
          <NumberField
            label="추가 대출 연 금리"
            unit="%"
            max={100}
            value={l.rate}
            onChange={(v) => update({ ...state, leverage: { ...l, rate: v } })}
          />
        </div>
        <p className="notice">
          연간 이자 {won((l.principal * l.rate) / 100)} · 손익분기 투자수익률{" "}
          {l.principal === 0 ? "해당 없음 (투자금 0원)" : `${l.rate}%`} · 세금
          및 수수료 제외
        </p>
      </Panel>
      <Panel
        title="수익률별 순자산 변화"
        subtitle="대출로 투자하는 순간 자산과 부채가 함께 늘어 순자산 변화는 0원입니다. 이후 투자손익과 이자가 순자산을 바꿉니다."
      >
        <BarChart
          label="레버리지 투자 이자 차감 후 손익"
          items={rows.map((r) => ({
            label: percent(r.returnPercent),
            value: r.netChange,
          }))}
        />
      </Panel>
      <Panel title="1년 뒤 손익 상세">
        <Table label="레버리지 투자 수익률별 결과">
          <thead>
            <tr>
              <th>수익률</th>
              <th>투자 평가금액</th>
              <th>투자 손익</th>
              <th>연간 대출 이자</th>
              <th>이자 차감 후 손익</th>
              <th>순자산 변화</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.returnPercent}>
                <th>{percent(r.returnPercent)}</th>
                <td>
                  <Amount value={r.value} />
                </td>
                <td>
                  <Amount value={r.profit} />
                </td>
                <td>
                  <Amount value={r.interest} />
                </td>
                <td className={r.afterInterest < 0 ? "negative" : "positive"}>
                  <Amount value={r.afterInterest} />
                </td>
                <td className={r.netChange < 0 ? "negative" : "positive"}>
                  <Amount value={r.netChange} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </>
  );
}
