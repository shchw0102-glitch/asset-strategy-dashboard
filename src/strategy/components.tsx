import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

export const num = (value: number, digits = 0) =>
  new Intl.NumberFormat("ko-KR", { maximumFractionDigits: digits }).format(
    value,
  );
export const won = (value: number) => `${num(value)}원`;
export function money(value: number) {
  const abs = Math.abs(value),
    sign = value < 0 ? "−" : "";
  return abs >= 1e8
    ? `${sign}${num(abs / 1e8, 2)}억원`
    : abs >= 1e4
      ? `${sign}${num(abs / 1e4, 1)}만원`
      : `${sign}${num(abs)}원`;
}
export const usd = (value: number) => `$${num(value, 4)}`;
export const percent = (value: number) =>
  `${value > 0 ? "+" : ""}${num(value, 2)}%`;
export function Amount({ value }: { value: number }) {
  return <span title={won(value)}>{money(value)}</span>;
}
export function NumberField({
  label,
  value,
  onChange,
  unit,
  min = 0,
  max = 1e12,
  step = "any",
  help,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number | "any";
  help?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const parsed = Number(draft);
  const valid =
    draft.trim() !== "" &&
    Number.isFinite(parsed) &&
    parsed >= min &&
    parsed <= max &&
    (step !== 1 || Number.isInteger(parsed));
  return (
    <label className="field" htmlFor={id}>
      <span id={`${id}-label`}>{label}</span>
      <div className={`input-wrap ${valid ? "" : "invalid"}`}>
        <input
          id={id}
          aria-labelledby={`${id}-label`}
          type="number"
          inputMode="decimal"
          value={draft}
          min={min}
          max={max}
          step={step}
          required
          disabled={disabled}
          aria-invalid={!valid}
          aria-describedby={help || !valid ? `${id}-help` : undefined}
          onChange={(event) => {
            const text = event.target.value;
            setDraft(text);
            const n = Number(text);
            if (
              text.trim() &&
              Number.isFinite(n) &&
              n >= min &&
              n <= max &&
              (step !== 1 || Number.isInteger(n))
            )
              onChange(n);
          }}
        />
        <span>{unit}</span>
      </div>
      {(!valid || help) && (
        <small id={`${id}-help`} className={!valid ? "negative" : ""}>
          {!valid
            ? `${num(min)}~${num(max)}${step === 1 ? " 정수" : ""} 입력 · 계산은 마지막 유효값 사용`
            : help}
        </small>
      )}
    </label>
  );
}
export function Panel({
  title,
  subtitle,
  children,
  action,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Stat({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: number;
  detail?: string;
  accent?: boolean;
}) {
  return (
    <div className={`stat ${accent ? "accent" : ""}`}>
      <span>{label}</span>
      <strong title={won(value)}>{money(value)}</strong>
      <small>{detail ?? won(value)}</small>
    </div>
  );
}
export function Table({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const check = () =>
      setOverflow(element.scrollWidth > element.clientWidth + 1);
    const observer = new ResizeObserver(check);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    check();
    return () => observer.disconnect();
  }, []);
  return (
    <div className="table-container">
      {overflow && (
        <p className="table-hint">↔ 좌우로 밀어 나머지 항목을 확인하세요</p>
      )}
      <div
        ref={scroll}
        className="table-scroll"
        role="region"
        aria-label={label}
        tabIndex={0}
      >
        <table>{children}</table>
      </div>
    </div>
  );
}
export function BarChart({
  items,
  label,
}: {
  items: { label: string; value: number; color?: string }[];
  label: string;
}) {
  const min = Math.min(0, ...items.map((x) => x.value));
  const max = Math.max(1, ...items.map((x) => x.value));
  const range = max - min;
  const zero = (-min / range) * 100;
  return (
    <div
      className="bar-chart"
      role="img"
      aria-label={`${label}. ${items.map((x) => `${x.label}: ${won(x.value)}`).join(", ")}`}
    >
      {items.map((item, i) => (
        <div className="bar-row" key={`${item.label}-${i}`}>
          <span>{item.label}</span>
          <div className="bar-track">
            <span className="zero-line" style={{ left: `${zero}%` }} />
            <div
              className={`bar ${item.value < 0 ? "loss" : ""}`}
              style={{
                left: `${item.value < 0 ? zero + (item.value / range) * 100 : zero}%`,
                width: `${(Math.abs(item.value) / range) * 100}%`,
                background: item.color,
              }}
            />
          </div>
          <strong>{money(item.value)}</strong>
        </div>
      ))}
      {items.length === 0 && <p>자금 조건을 충족하는 시나리오가 없습니다.</p>}
    </div>
  );
}
export function LineChart({
  series,
}: {
  series: { name: string; values: number[]; color: string }[];
}) {
  if (!series.length)
    return <p>실행 가능한 시나리오가 없습니다. 자금 조건을 확인하세요.</p>;
  const values = series.flatMap((s) => s.values);
  const min = Math.min(0, ...values),
    max = Math.max(1, ...values),
    range = max - min;
  const x = (i: number) =>
    90 + (i / Math.max(1, series[0].values.length - 1)) * 680;
  const y = (v: number) => 220 - ((v - min) / range) * 190;
  return (
    <>
      <svg
        className="line-chart"
        viewBox="0 0 800 265"
        role="img"
        aria-label="연도별 예상 순자산 추이. 정확한 수치는 아래 연도별 표를 확인하세요."
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1="90"
              x2="770"
              y1={y(min + range * f)}
              y2={y(min + range * f)}
              stroke="#e0e5e3"
            />
            <text x="78" y={y(min + range * f) + 4} textAnchor="end">
              {money(min + range * f)}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <polyline
            key={s.name}
            fill="none"
            stroke={s.color}
            strokeWidth="3"
            points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
          />
        ))}
        {series[0].values.map((_, i) => (
          <text key={i} x={x(i)} y="250" textAnchor="middle">
            {i}년
          </text>
        ))}
      </svg>
      <div className="legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </>
  );
}
