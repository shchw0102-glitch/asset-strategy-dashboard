import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
  type ChangeEvent,
} from "react";
import {
  allocation,
  assetError,
  categories,
  compactMoney,
  defaultTargets,
  demoPortfolio,
  maxAmount,
  money,
  parsePortfolio,
  percentage,
  storageKey,
  totals,
  validTargets,
  type Asset,
  type Category,
  type Portfolio,
  type Targets,
} from "./portfolio";
import { useUpbitQuotes } from "./useUpbitQuotes";
import {
  canApplyQuote,
  marketName,
  quoteIsFresh,
  quotePrice,
  upbitMarkets,
  valuateAssets,
  type Quotes,
} from "./upbit";
import MarketPanel from "./MarketPanel";

type Page = "overview" | "assets" | "strategy" | "data" | "connections";
const pages: {
  id: Page;
  label: string;
  icon: string;
  title: string;
  description: string;
}[] = [
  {
    id: "overview",
    label: "대시보드",
    icon: "grid",
    title: "한눈에 보는 내 자산",
    description: "자산의 오늘을 살펴보고, 더 나은 내일을 계획하세요.",
  },
  {
    id: "assets",
    label: "보유 자산",
    icon: "wallet",
    title: "차곡차곡 모은 내 자산",
    description: "보유 자산의 원금과 현재 평가금액을 직접 관리하세요.",
  },
  {
    id: "strategy",
    label: "자산 배분",
    icon: "pie",
    title: "나에게 맞는 자산 균형",
    description: "목표 비중을 정하고 현재 자산과의 차이를 확인하세요.",
  },
  {
    id: "connections",
    label: "시세·계좌",
    icon: "chart",
    title: "실시간 시세와 계좌 관리",
    description:
      "업비트 시세를 연결하고 금융계좌의 연동 지원 범위를 확인하세요.",
  },
  {
    id: "data",
    label: "데이터 관리",
    icon: "database",
    title: "소중한 기록, 안전하게",
    description: "자산 기록을 백업하거나 나만의 포트폴리오로 시작하세요.",
  },
];

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    wallet: (
      <>
        <path d="M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6" />
        <path d="M20 12h-5v5h5" />
        <path d="M17 14.5h.01" />
      </>
    ),
    chart: (
      <>
        <path d="m3 16 6-6 4 4 8-9m-6 0h6v6M3 21h18" />
      </>
    ),
    home: (
      <>
        <path d="m3 10 9-7 9 7v10H3V10Z" />
        <path d="M9 20v-8h6v8" />
      </>
    ),
    gem: (
      <>
        <path d="m3 8 4-5h10l4 5-9 13L3 8Zm0 0h18M7 3l5 18 5-18" />
      </>
    ),
    coin: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 7h5a3 3 0 0 1 0 6H9m0-6v10h5a2 2 0 0 0 0-4M11 5v2m0 10v2" />
      </>
    ),
    pie: (
      <>
        <path d="M10 3a9 9 0 1 0 11 11H10V3Z" />
        <path d="M14 2v8h8a9 9 0 0 0-8-8Z" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="m5 12 14 0m-5-5 5 5-5 5" />,
    up: <path d="m5 16 11-11M5 5h11v11" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    edit: (
      <>
        <path d="m14 4 6 6M3 21l6-1L21 8a2 2 0 0 0-5-5L4 15l-1 6Z" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    leaf: (
      <>
        <path d="M20 3C8 2 3 7 5 15s15 6 15-12Z" />
        <path d="m4 21 11-11" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7h.01" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.wallet}
    </svg>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeRef.current();
      }}
    >
      <div className="modal-panel">
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="닫기"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function AssetEditor({
  asset,
  onClose,
  onSave,
  onDelete,
  defaultCategory = "cash",
  initialMarket = "KRW-BTC",
  quotes,
  live,
  now,
  onMarket,
}: {
  asset: Asset | null;
  onClose: () => void;
  onSave: (asset: Asset) => void;
  onDelete: (id: string) => void;
  defaultCategory?: Category;
  initialMarket?: string;
  quotes: Quotes;
  live: boolean;
  now: number;
  onMarket: (market: string) => void;
}) {
  const [name, setName] = useState(
    asset?.name ??
      (defaultCategory === "crypto" ? marketName(initialMarket) : ""),
  );
  const [category, setCategory] = useState<Category>(
    asset?.category ?? defaultCategory,
  );
  const [cost, setCost] = useState(asset ? String(asset.cost) : "");
  const [value, setValue] = useState(asset ? String(asset.value) : "");
  const [note, setNote] = useState(asset?.note ?? "");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [market, setMarket] = useState(asset?.pricing?.market ?? initialMarket);
  const [quantity, setQuantity] = useState(
    asset?.pricing ? String(asset.pricing.quantity) : "",
  );
  const [marketPricing, setMarketPricing] = useState(
    !!asset?.pricing || (!asset && defaultCategory === "crypto"),
  );
  const linked = category === "crypto" && marketPricing;
  const quote = quotes[market];
  const fresh = live && quoteIsFresh(quote, now);
  const calculated =
    quote && quantity.trim()
      ? Math.round(Number(quantity) * quote.price)
      : null;
  useEffect(() => {
    if (linked) onMarket(market);
    else onMarket("");
    return () => onMarket("");
  }, [linked, market, onMarket]);
  function submit(e: FormEvent) {
    e.preventDefault();
    const next = {
      id: asset?.id ?? crypto.randomUUID(),
      name: name.trim(),
      category,
      cost: Number(cost),
      value: linked ? (calculated ?? 0) : Number(value),
      note: note.trim(),
      ...(linked
        ? {
            pricing: {
              kind: "upbit" as const,
              market,
              quantity: Number(quantity),
            },
          }
        : {}),
    };
    if (linked && (!fresh || !quantity.trim())) {
      setError(
        !fresh
          ? "최신 업비트 시세를 받은 뒤 저장해 주세요. 연결이 안 되면 평가 방식을 직접 입력으로 바꿀 수 있습니다."
          : "보유 수량을 입력해 주세요.",
      );
      return;
    }
    const issue = assetError(next);
    if (issue || !cost.trim() || (!linked && !value.trim())) {
      setError(issue || "원금과 현재 평가금액을 입력해 주세요.");
      return;
    }
    onSave(next);
  }
  return (
    <Modal title={asset ? "자산 수정" : "새 자산 추가"} onClose={onClose}>
      {deleting ? (
        <div className="delete-confirm">
          <p>
            <strong>{asset!.name}</strong> 자산을 삭제할까요?
          </p>
          <p className="muted">삭제하면 총자산과 수익률에 바로 반영됩니다.</p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setDeleting(false)}
            >
              돌아가기
            </button>
            <button
              className="button danger"
              onClick={() => onDelete(asset!.id)}
            >
              삭제하기
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <p className="form-intro">금액은 원화 기준으로 입력해 주세요.</p>
          <label className="field">
            자산 이름
            <input
              data-autofocus
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 생활비 통장, 비트코인"
            />
          </label>
          <label className="field">
            자산 유형
            <select
              value={category}
              onChange={(e) => {
                const next = e.target.value as Category;
                setCategory(next);
                if (next === "crypto") {
                  setMarketPricing(true);
                  if (!name.trim()) setName(marketName(market));
                }
              }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {category === "crypto" && (
            <>
              <label className="field">
                평가 방식
                <select
                  value={marketPricing ? "upbit" : "manual"}
                  onChange={(e) => setMarketPricing(e.target.value === "upbit")}
                >
                  <option value="upbit">업비트 실시간 시세</option>
                  <option value="manual">평가금액 직접 입력</option>
                </select>
              </label>
              {linked && (
                <div className="coin-fields">
                  <label className="field">
                    업비트 코인
                    <select
                      value={market}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (!name || name === marketName(market))
                          setName(marketName(next));
                        setMarket(next);
                      }}
                    >
                      {!upbitMarkets.some((m) => m.market === market) && (
                        <option value={market}>{market} · 지원 중단</option>
                      )}
                      {upbitMarkets.map((m) => (
                        <option key={m.market} value={m.market}>
                          {m.name} ({m.market.replace("KRW-", "")})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    보유 수량
                    <input
                      required
                      type="number"
                      min="0"
                      max="1000000000"
                      step="any"
                      inputMode="decimal"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="예: 0.01"
                    />
                  </label>
                  <p className="coin-help">
                    업비트 보유 계좌는 연결하지 않습니다. 실제 보유 수량을 직접
                    입력해 주세요.
                  </p>
                </div>
              )}
            </>
          )}
          <div className="form-grid">
            <label className="field">
              매입 원금 (원)
              <input
                required
                type="number"
                min="0"
                max={maxAmount}
                step="1"
                inputMode="numeric"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="field">
              현재 평가금액 (원)
              {linked ? (
                <div className="live-value">
                  <strong>
                    {calculated !== null && Number.isFinite(calculated)
                      ? money(calculated)
                      : "시세 수신 대기 중"}
                  </strong>
                  <span>
                    {quote
                      ? `1 ${market.replace("KRW-", "")} = ${quotePrice(quote.price)} · ${fresh ? "실시간" : "이전 시세"}`
                      : "시세를 연결하고 있습니다."}
                  </span>
                </div>
              ) : (
                <input
                  required
                  type="number"
                  min="0"
                  max={maxAmount}
                  step="1"
                  inputMode="numeric"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0"
                />
              )}
            </label>
          </div>
          <label className="field">
            메모 <span className="optional">선택</span>
            <textarea
              rows={2}
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="이 자산에 대해 기억하고 싶은 내용"
            />
          </label>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            {asset && (
              <button
                type="button"
                className="text-button danger-text"
                onClick={() => setDeleting(true)}
              >
                자산 삭제
              </button>
            )}
            <span className="spacer" />
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              취소
            </button>
            <button type="submit" className="button primary">
              {asset ? "변경 저장" : "자산 추가"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function TargetEditor({
  targets,
  onSave,
}: {
  targets: Targets;
  onSave: (targets: Targets) => void;
}) {
  const [draft, setDraft] = useState<Record<Category, string>>(
    () =>
      Object.fromEntries(
        categories.map((c) => [c.id, String(targets[c.id])]),
      ) as Record<Category, string>,
  );
  const [saved, setSaved] = useState(false);
  const next = Object.fromEntries(
    categories.map((c) => [c.id, Number(draft[c.id])]),
  ) as Targets;
  const sum = categories.reduce((n, c) => n + next[c.id], 0);
  const valid =
    categories.every((c) => draft[c.id].trim()) && validTargets(next);
  return (
    <section className="panel target-editor">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">MY PLAN</span>
          <h2>목표 자산 배분</h2>
        </div>
        <Icon name="pie" />
      </div>
      <p className="muted">합계가 100%가 되도록 원하는 비중을 정해 주세요.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) {
            onSave(next);
            setSaved(true);
          }
        }}
      >
        <div className="target-inputs">
          {categories.map((c) => (
            <label className="target-input" key={c.id}>
              <span>
                <i className="dot" style={{ background: c.color }} />
                {c.label}
              </span>
              <span className="percent-input">
                <input
                  aria-label={`${c.label} 목표 비중`}
                  type="number"
                  required
                  min="0"
                  max="100"
                  step="0.1"
                  value={draft[c.id]}
                  onChange={(e) => {
                    setDraft({ ...draft, [c.id]: e.target.value });
                    setSaved(false);
                  }}
                />
                %
              </span>
            </label>
          ))}
        </div>
        <div className="target-total">
          <span>목표 비중 합계</span>
          <strong className={valid ? "positive" : "negative"}>
            {Number.isFinite(sum) ? sum.toFixed(1) : "—"}%
          </strong>
        </div>
        {!valid && (
          <p className="error-text" role="status">
            각 비중은 0~100%, 합계는 100%여야 합니다.
          </p>
        )}
        <button
          className="button primary full-width"
          type="submit"
          disabled={!valid}
        >
          {saved ? (
            <>
              <Icon name="check" size={17} />
              목표 저장 완료
            </>
          ) : (
            "목표 비중 저장"
          )}
        </button>
      </form>
    </section>
  );
}

function loadInitial() {
  try {
    const stored = localStorage.getItem(storageKey);
    return {
      portfolio: stored ? parsePortfolio(stored) : demoPortfolio(),
      warning: "",
    };
  } catch {
    return {
      portfolio: demoPortfolio(),
      warning:
        "저장된 기록을 읽을 수 없어 샘플을 표시합니다. 기존 기록은 덮어쓰지 않았습니다. 백업을 가져오거나 데이터 관리에서 새로 시작해 주세요.",
    };
  }
}

export default function App() {
  const [initial] = useState(loadInitial);
  const [portfolio, setPortfolio] = useState(initial.portfolio);
  const [warning, setWarning] = useState(initial.warning);
  const [page, setPage] = useState<Page>("overview");
  const [editor, setEditor] = useState<{
    asset: Asset | null;
    defaultCategory?: Category;
    initialMarket?: string;
  } | null>(null);
  const [editorMarket, setEditorMarket] = useState("");
  const {
    quotes,
    status: quoteStatus,
    now,
  } = useUpbitQuotes([
    ...portfolio.assets.flatMap((a) => (a.pricing ? [a.pricing.market] : [])),
    editorMarket,
  ]);
  const evaluatedAssets = valuateAssets(portfolio.assets, quotes);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState("");
  const [replacement, setReplacement] = useState<{
    title: string;
    text: string;
    portfolio: Portfolio;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stats = totals(evaluatedAssets);
  const shares = allocation(evaluatedAssets, portfolio.targets);
  const currentPage = pages.find((p) => p.id === page)!;
  const filtered = evaluatedAssets.filter(
    (a) =>
      (filter === "all" || a.category === filter) &&
      `${a.name} ${a.note}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const date = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  function commit(next: Portfolio, message: string) {
    setPortfolio(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setWarning("");
    } catch {
      setWarning(
        "브라우저에 저장하지 못했습니다. 변경사항은 이 탭에서만 유지됩니다. 데이터 관리에서 백업을 다운로드해 주세요.",
      );
    }
    setToast(message);
  }
  function navigate(next: Page) {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function saveAsset(asset: Asset) {
    const exists = portfolio.assets.some((a) => a.id === asset.id);
    if (!exists && portfolio.assets.length >= 1000) {
      setToast("자산은 최대 1,000개까지 등록할 수 있습니다.");
      return;
    }
    commit(
      {
        ...portfolio,
        assets: exists
          ? portfolio.assets.map((a) => (a.id === asset.id ? asset : a))
          : [...portfolio.assets, asset],
      },
      exists ? "자산을 수정했습니다." : "새 자산을 추가했습니다.",
    );
    setEditor(null);
  }
  function exportData() {
    const blob = new Blob(
      [JSON.stringify({ ...portfolio, assets: evaluatedAssets }, null, 2)],
      {
        type: "application/json",
      },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `moa-assets-${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date())}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast("자산 백업을 다운로드했습니다.");
  }
  async function importData(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2_000_000) {
      setToast("2MB 이하의 백업 파일을 선택해 주세요.");
      return;
    }
    try {
      const next = parsePortfolio(await file.text());
      setReplacement({
        title: "백업 가져오기",
        text: `${next.assets.length}개의 자산과 목표 비중으로 현재 기록을 교체합니다. 기존 기록은 먼저 백업해 주세요.`,
        portfolio: next,
      });
    } catch {
      setToast("올바른 모아 JSON 백업 파일을 선택해 주세요.");
    }
  }
  let running = 0;
  const gradient = shares
    .map((c) => {
      const start = running;
      running += c.share;
      return `${c.color} ${start}% ${running}%`;
    })
    .join(", ");
  const drift =
    stats.value > 0
      ? shares.reduce((sum, c) => sum + Math.abs(c.gap), 0) / 2
      : 0;

  const holdings = (
    <section className="panel holdings">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">MY ASSETS</span>
          <h2>
            보유 자산 <span className="count">{portfolio.assets.length}</span>
          </h2>
        </div>
        {page === "overview" ? (
          <button className="text-button" onClick={() => navigate("assets")}>
            전체 보기 <Icon name="arrow" size={16} />
          </button>
        ) : (
          <span className="small muted">단위: 원</span>
        )}
      </div>
      <div className="table-tools">
        <label className="search-input">
          <Icon name="search" size={18} />
          <input
            aria-label="자산 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="자산 이름이나 메모 검색"
          />
        </label>
        <select
          className="category-filter"
          aria-label="자산 유형 필터"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">모든 자산 유형</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>자산 이름</th>
              <th>자산 유형</th>
              <th className="numeric">매입 원금</th>
              <th className="numeric">평가금액</th>
              <th className="numeric">평가 수익률</th>
              <th>
                <span className="sr-only">수정</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const c = categories.find((c) => c.id === a.category)!;
              const rate =
                a.cost > 0 ? ((a.value - a.cost) / a.cost) * 100 : null;
              return (
                <tr key={a.id}>
                  <td>
                    <div className="asset-cell">
                      <span className={`asset-icon ${a.category}`}>
                        <Icon name={c.icon} size={19} />
                      </span>
                      <div>
                        <strong>{a.name}</strong>
                        <span className="asset-note">
                          {a.pricing
                            ? `${a.pricing.market.replace("KRW-", "")} · ${a.pricing.quantity}개 · ${quoteStatus === "live" && quoteIsFresh(quotes[a.pricing.market], now) && canApplyQuote(a, quotes[a.pricing.market]) ? "업비트 실시간" : "마지막 확인 금액"}`
                            : a.note || "메모 없음"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`category-tag ${a.category}`}>
                      {c.label}
                    </span>
                  </td>
                  <td className="numeric muted">{money(a.cost)}</td>
                  <td className="numeric">
                    <strong>{money(a.value)}</strong>
                  </td>
                  <td
                    className={`numeric ${rate === null || rate === 0 ? "muted" : rate > 0 ? "positive" : "negative"}`}
                  >
                    {percentage(rate, true)}
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`${a.name} 수정`}
                      onClick={() => setEditor({ asset: a })}
                    >
                      <Icon name="edit" size={17} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">
            <Icon name="wallet" size={28} />
          </span>
          <h3>
            {portfolio.assets.length
              ? "검색 결과가 없습니다"
              : "첫 번째 자산을 기록해 보세요"}
          </h3>
          <p>
            {portfolio.assets.length
              ? "다른 검색어나 자산 유형으로 찾아보세요."
              : "통장 잔액부터 시작해도 좋아요. 작은 기록이 큰 계획이 됩니다."}
          </p>
          {!portfolio.assets.length && (
            <button
              className="button primary"
              onClick={() => setEditor({ asset: null })}
            >
              <Icon name="plus" size={17} />
              자산 추가
            </button>
          )}
        </div>
      )}
      <div className="table-footer">
        <span>
          {filtered.length}개 자산
          {filter !== "all" || query ? " · 필터 적용 중" : ""}
        </span>
        <span>
          연동 코인은 업비트 시세, 그 외 자산은 직접 입력한 금액입니다.
        </span>
      </div>
    </section>
  );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        본문으로 바로가기
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
          aria-label="모아 대시보드"
        >
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <span>
            모아<span className="brand-caption">나의 자산, 나의 방향</span>
          </span>
        </a>
        <div className="nav-caption">MY WORKSPACE</div>
        <nav aria-label="주 메뉴">
          {pages.map((p) => (
            <button
              key={p.id}
              className={`nav-item ${page === p.id ? "active" : ""}`}
              aria-current={page === p.id ? "page" : undefined}
              onClick={() => navigate(p.id)}
            >
              <Icon name={p.icon} />
              <span>{p.label}</span>
              {page === p.id && <i className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Icon name="leaf" size={26} />
            <h3>
              작은 기록이
              <br />더 나은 내일로.
            </h3>
            <p>
              나만의 속도로
              <br />
              자산을 쌓아 가세요.
            </p>
          </div>
          <div className="storage-status">
            <span className="status-dot" />
            브라우저에 저장 · KRW
          </div>
          <div className="profile">
            <span className="avatar">나</span>
            <div>
              <strong>나의 포트폴리오</strong>
              <span>개인 자산 관리</span>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="breadcrumb">
            나의 포트폴리오 <span>/</span> <strong>{currentPage.label}</strong>
          </span>
          <span className="date">{date}</span>
        </header>
        <main id="main-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">BUILD YOUR TOMORROW</span>
              <h1>
                {currentPage.title}
                <span className="title-dot">.</span>
              </h1>
              <p>{currentPage.description}</p>
            </div>
            <button
              className="button primary"
              onClick={() => setEditor({ asset: null })}
            >
              <Icon name="plus" size={18} />
              자산 추가
            </button>
          </div>
          {warning && (
            <div className="warning-banner" role="alert">
              <Icon name="info" />
              <span>{warning}</span>
            </div>
          )}
          {portfolio.assets.some(
            (a) =>
              a.pricing &&
              (quoteStatus !== "live" ||
                !quoteIsFresh(quotes[a.pricing.market], now) ||
                !canApplyQuote(a, quotes[a.pricing.market])),
          ) && (
            <div className="warning-banner" role="status">
              <Icon name="info" />
              <span>
                일부 코인에 최신 시세를 적용하지 못했습니다. 코인 평가에는
                마지막 확인 시세·금액을 사용합니다.
              </span>
            </div>
          )}
          {portfolio.isDemo && (
            <div className="demo-banner">
              <div>
                <span className="demo-pill">샘플</span>
                <span>지금 보고 있는 자산은 예시 데이터입니다.</span>
              </div>
              <button
                className="text-button"
                onClick={() =>
                  setReplacement({
                    title: "내 자산으로 시작하기",
                    text: "현재 자산 목록을 비우고 나의 기록을 시작합니다. 보관할 데이터가 있다면 먼저 백업해 주세요.",
                    portfolio: {
                      version: 1,
                      isDemo: false,
                      assets: [],
                      targets: { ...defaultTargets },
                    },
                  })
                }
              >
                내 자산으로 시작 <Icon name="arrow" size={16} />
              </button>
            </div>
          )}
          {(page === "overview" || page === "assets") && (
            <div className="summary-grid">
              <section className="summary-card total-card">
                <div className="summary-label">
                  <span>총자산 평가금액</span>
                  <Icon name="wallet" />
                </div>
                <p className="big-number" data-testid="total-value">
                  {stats.value.toLocaleString("ko-KR")}
                  <span>원</span>
                </p>
                <div className="summary-bottom">
                  <span className="light-pill">
                    {portfolio.assets.length}개 자산
                  </span>
                  <span>나의 자산을 차곡차곡</span>
                </div>
                <div className="total-decoration" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </section>
              <section className="summary-card">
                <div className="summary-label">
                  <span>평가 손익</span>
                  <span className="summary-icon">
                    <Icon name="chart" />
                  </span>
                </div>
                <p
                  className={`medium-number ${stats.profit >= 0 ? "positive" : "negative"}`}
                >
                  {stats.profit > 0 ? "+" : ""}
                  {stats.profit.toLocaleString("ko-KR")}
                  <span>원</span>
                </p>
                <div className="summary-bottom">
                  <span
                    className={`return-pill ${stats.profit < 0 ? "loss" : ""}`}
                  >
                    {percentage(stats.rate, true)}
                  </span>
                  <span>원금 대비 수익률</span>
                </div>
              </section>
              <section className="summary-card">
                <div className="summary-label">
                  <span>총 매입 원금</span>
                  <span className="summary-icon">
                    <Icon name="gem" />
                  </span>
                </div>
                <p className="medium-number">
                  {stats.cost.toLocaleString("ko-KR")}
                  <span>원</span>
                </p>
                <div className="summary-bottom">
                  <span className="muted">직접 입력한 투자 원금 합계</span>
                </div>
              </section>
            </div>
          )}
          {page === "overview" && (
            <>
              <MarketPanel
                quotes={quotes}
                status={quoteStatus}
                now={now}
                onAdd={(market) =>
                  setEditor({
                    asset: null,
                    defaultCategory: "crypto",
                    initialMarket: market,
                  })
                }
              />
              <div className="overview-grid">
                <section className="panel allocation-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">PORTFOLIO MIX</span>
                      <h2>나의 자산 구성</h2>
                    </div>
                    <span className="subtle-tag">현재 평가금액 기준</span>
                  </div>
                  <div className="allocation-content">
                    <div
                      className="donut"
                      role="img"
                      aria-label={
                        stats.value
                          ? shares
                              .map((c) => `${c.label} ${percentage(c.share)}`)
                              .join(", ")
                          : "등록된 평가금액이 없습니다"
                      }
                      style={{
                        background: stats.value
                          ? `conic-gradient(${gradient})`
                          : "#e7e9e2",
                      }}
                    >
                      <div className="donut-center">
                        <span>전체 자산</span>
                        <strong>{compactMoney(stats.value)}</strong>
                        <small>KRW</small>
                      </div>
                    </div>
                    <div className="allocation-legend">
                      {shares.map((c) => (
                        <div className="legend-row" key={c.id}>
                          <div>
                            <span>
                              <i
                                className="dot"
                                style={{ background: c.color }}
                              />
                              {c.label}
                            </span>
                            <strong>{percentage(c.share)}</strong>
                          </div>
                          <p>{money(c.value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
                <section className="panel balance-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">FIND YOUR BALANCE</span>
                      <h2>목표와 현재의 거리</h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("strategy")}
                    >
                      목표 설정 <Icon name="arrow" size={16} />
                    </button>
                  </div>
                  <div className="balance-legend">
                    <span>
                      <i className="dot" style={{ background: "#344d3c" }} />
                      현재 비중
                    </span>
                    <span>
                      <i className="target-tick" />
                      목표 비중
                    </span>
                  </div>
                  <div className="balance-bars">
                    {shares.map((c) => (
                      <div className="balance-row" key={c.id}>
                        <div>
                          <span>{c.label}</span>
                          <span>
                            <strong>{percentage(c.share)}</strong>
                            <small> / 목표 {c.target}%</small>
                          </span>
                        </div>
                        <div className="balance-track">
                          <div
                            style={{
                              width: `${c.share}%`,
                              background: c.color,
                            }}
                          />
                          <i style={{ left: `${Math.min(c.target, 99.5)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="balance-tip">
                    <Icon name="info" size={17} />
                    <span>
                      {stats.value
                        ? `총자산의 ${drift.toFixed(1)}%를 조정하면 목표 배분에 가까워져요.`
                        : "자산을 등록하면 목표와의 차이를 확인할 수 있어요."}
                    </span>
                  </div>
                </section>
              </div>
              {holdings}
            </>
          )}
          {page === "assets" && holdings}
          {page === "connections" && (
            <>
              <MarketPanel
                quotes={quotes}
                status={quoteStatus}
                now={now}
                onAdd={(market) =>
                  setEditor({
                    asset: null,
                    defaultCategory: "crypto",
                    initialMarket: market,
                  })
                }
              />
              <section className="panel bank-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">FINANCIAL ACCOUNTS</span>
                    <h2>네이버페이 금융계좌 가져오기</h2>
                  </div>
                  <span className="bank-unavailable">자동 연동 미지원</span>
                </div>
                <p className="bank-description">
                  네이버페이 공개 개발자 문서에서 개인 계좌·잔액을 가져오는
                  API는 확인되지 않았습니다. 현재 이 앱에서는 네이버페이
                  로그인으로 계좌를 자동으로 불러올 수 없습니다.
                </p>
                <div className="bank-alternative">
                  <strong>지금은 이렇게 기록해 주세요</strong>
                  <p>
                    네이버페이에서 계좌 잔액을 확인한 뒤, 계좌별명과 잔액을 직접
                    등록할 수 있습니다.
                  </p>
                  <div className="data-actions">
                    <a
                      className="button secondary"
                      href="https://pay.naver.com"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      네이버페이 열기 ↗
                    </a>
                    <button
                      className="button primary"
                      onClick={() => setEditor({ asset: null })}
                    >
                      계좌 잔액 직접 추가
                    </button>
                  </div>
                </div>
                <p className="bank-source">
                  자동 연동은 승인된 금융정보 제공 서비스와 별도 연결 절차가
                  필요합니다.{" "}
                  <a
                    href="https://developers.pay.naver.com/docs/v2/api"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    네이버페이 공식 API 안내 ↗
                  </a>
                </p>
              </section>
            </>
          )}
          {page === "strategy" && (
            <div className="strategy-grid">
              <TargetEditor
                key={JSON.stringify(portfolio.targets)}
                targets={portfolio.targets}
                onSave={(targets) =>
                  commit(
                    { ...portfolio, targets },
                    "목표 자산 배분을 저장했습니다.",
                  )
                }
              />
              <section className="panel rebalance-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">NEXT STEP</span>
                    <h2>목표까지의 조정 금액</h2>
                  </div>
                  <span className="subtle-tag">총자산 유지 기준</span>
                </div>
                <p className="muted">
                  현재 총자산 {money(stats.value)}을 목표 비중으로 배분했을 때의
                  차이입니다.
                </p>
                <div className="rebalance-list">
                  {shares.map((c) => (
                    <div className="rebalance-row" key={c.id}>
                      <span className={`asset-icon ${c.id}`}>
                        <Icon name={c.icon} />
                      </span>
                      <div className="rebalance-name">
                        <strong>{c.label}</strong>
                        <span>
                          현재 {percentage(c.share)} → 목표 {c.target}%
                        </span>
                      </div>
                      <div className="rebalance-amount">
                        <strong>
                          {stats.value === 0
                            ? "—"
                            : money(Math.abs(c.adjustment))}
                        </strong>
                        <span
                          className={c.adjustment > 0 ? "positive" : "muted"}
                        >
                          {stats.value === 0
                            ? "자산 등록 후 확인"
                            : c.adjustment > 0
                              ? "비중 늘리기"
                              : c.adjustment < 0
                                ? "비중 줄이기"
                                : "목표에 맞아요"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="strategy-note">
                  <Icon name="info" />
                  <p>
                    수수료·세금·부채를 포함하지 않은 단순 배분 계산입니다.
                    부동산처럼 쉽게 나누기 어려운 자산은 실제 조정 가능성을 함께
                    고려해 주세요.
                  </p>
                </div>
              </section>
            </div>
          )}
          {page === "data" && (
            <>
              <div className="data-grid">
                <section className="panel data-card">
                  <span className="data-icon">
                    <Icon name="download" size={25} />
                  </span>
                  <h2>내 자산 백업</h2>
                  <p>
                    자산 목록과 목표 비중을 JSON 파일로 다운로드합니다. 브라우저
                    기록을 지우기 전에 백업해 두세요.
                  </p>
                  <button className="button primary" onClick={exportData}>
                    <Icon name="download" size={17} />
                    백업 다운로드
                  </button>
                </section>
                <section className="panel data-card">
                  <span className="data-icon">
                    <Icon name="upload" size={25} />
                  </span>
                  <h2>기록 이어서 보기</h2>
                  <p>
                    모아에서 다운로드한 JSON 백업 파일을 가져옵니다. 내용을
                    확인한 뒤 현재 기록을 교체합니다.
                  </p>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".json,application/json"
                    className="sr-only"
                    aria-label="백업 파일 선택"
                    onChange={importData}
                  />
                  <button
                    className="button secondary"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Icon name="upload" size={17} />
                    백업 가져오기
                  </button>
                </section>
              </div>
              <section className="panel data-info">
                <h2>나만의 기록을 시작하세요</h2>
                <p>
                  자산 데이터는 이 기기의 현재 브라우저에 저장됩니다. 가상자산은
                  보유 수량을 입력하면 업비트 원화 시세로 자동 평가됩니다.
                  금융계좌는 아직 자동 연결되지 않아 잔액을 직접 입력해야
                  합니다. 다른 기기로 옮길 때는 백업 파일을 사용하세요.
                </p>
                <div className="data-actions">
                  <button
                    className="button secondary"
                    onClick={() =>
                      setReplacement({
                        title: "빈 포트폴리오로 시작",
                        text: "현재 자산과 목표 비중을 초기화합니다. 보관할 기록은 먼저 백업해 주세요.",
                        portfolio: {
                          version: 1,
                          assets: [],
                          isDemo: false,
                          targets: { ...defaultTargets },
                        },
                      })
                    }
                  >
                    빈 포트폴리오로 시작
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      setReplacement({
                        title: "샘플 데이터로 돌아가기",
                        text: "현재 기록을 예시 자산으로 교체합니다. 보관할 기록은 먼저 백업해 주세요.",
                        portfolio: demoPortfolio(),
                      })
                    }
                  >
                    샘플 데이터 불러오기
                  </button>
                </div>
              </section>
            </>
          )}
          <footer className="page-footer">
            <span>
              모아 <i>·</i> 나의 자산, 나의 방향
            </span>
            <span>금액 기준 KRW · 수익률은 원금 대비 단순 계산</span>
          </footer>
        </main>
      </div>
      {editor && (
        <AssetEditor
          asset={editor.asset}
          defaultCategory={editor.defaultCategory}
          initialMarket={editor.initialMarket}
          quotes={quotes}
          live={quoteStatus === "live"}
          now={now}
          onMarket={setEditorMarket}
          onClose={() => setEditor(null)}
          onSave={saveAsset}
          onDelete={(id) => {
            commit(
              {
                ...portfolio,
                assets: portfolio.assets.filter((a) => a.id !== id),
              },
              "자산을 삭제했습니다.",
            );
            setEditor(null);
          }}
        />
      )}
      {replacement && (
        <Modal title={replacement.title} onClose={() => setReplacement(null)}>
          <p className="confirm-text">{replacement.text}</p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setReplacement(null)}
            >
              취소
            </button>
            <button
              className="button primary"
              onClick={() => {
                commit(replacement.portfolio, "포트폴리오를 변경했습니다.");
                setReplacement(null);
                setQuery("");
                setFilter("all");
              }}
            >
              확인하고 시작
            </button>
          </div>
        </Modal>
      )}
      <div
        className={`toast ${toast ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast && (
          <>
            <Icon name="info" size={18} />
            {toast}
          </>
        )}
      </div>
    </div>
  );
}
