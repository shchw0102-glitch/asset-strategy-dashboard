import { isAndroidApp, nativeRequest } from "./services/android";
import { useStockMarkets } from "./services/useStockMarkets";
import { effectiveStocks } from "./services/stocks";
import { StockPanel } from "./services/StockPanel";
import { useLiveMarkets } from "./services/useLiveMarkets";
import { effectiveHoldings } from "./services/liveQuotes";
import { LiveMarketPanel } from "./services/LiveMarketPanel";
import { useEffect, useMemo, useRef, useState } from "react";
import { AssetsPage, SalesPage, TargetsPage } from "./strategy/AssetPages";
import { LoansPage, LeveragePage } from "./strategy/DebtPages";
import { HousingPage, ForecastPage } from "./strategy/HousingPages";
import { newDefaultState } from "./strategy/defaults";
import { loadState, parseState, STORAGE_KEY } from "./strategy/storage";
import type { StrategyState } from "./strategy/types";

const pages = [
  {
    title: "자산 현황",
    icon: "◫",
    eyebrow: "MY PORTFOLIO",
    description: "오늘의 자산을 정리하고, 다음 목표를 준비하세요.",
  },
  {
    title: "CNTN·CC 시뮬레이터",
    icon: "↗",
    eyebrow: "PRICE SCENARIOS",
    description: "두 자산의 가격 변화가 만드는 새로운 가능성.",
  },
  {
    title: "분할매도 전략",
    icon: "≋",
    eyebrow: "EXIT STRATEGY",
    description: "목표 가격부터 현금 확보까지, 단계별로 계획하세요.",
  },
  {
    title: "대출 관리",
    icon: "▤",
    eyebrow: "DEBT MANAGEMENT",
    description: "매월 나가는 금액과 남은 원금을 투명하게.",
  },
  {
    title: "레버리지 분석",
    icon: "⇄",
    eyebrow: "LEVERAGE ANALYSIS",
    description: "기대 수익과 이자 부담을 같은 기준에서 비교하세요.",
  },
  {
    title: "아파트 매수 비교",
    icon: "⌂",
    eyebrow: "HOME OR INVESTMENT",
    description: "집을 사는 선택, 투자를 이어가는 선택.",
  },
  {
    title: "5년 순자산 전망",
    icon: "⌁",
    eyebrow: "FUTURE OUTLOOK",
    description: "수익률과 금리가 바뀌면 미래의 자산은 어떻게 달라질까요?",
  },
];
function download(content: string, name: string) {
  if (isAndroidApp()) {
    void nativeRequest("save", { content, name }, 600_000).catch((error) => window.alert(error.message));
    return;
  }
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
export default function App() {
  const [initial] = useState(loadState);
  const [state, setState] = useState<StrategyState>(initial.state);
  const market = useLiveMarkets(state.market);
  const stockMarket = useStockMarkets(state.holdings.stocks);
  const activeHoldings = useMemo(
    () => ({ ...effectiveHoldings(state.holdings, state.market, market.quotes), stocks: effectiveStocks(state.holdings.stocks, stockMarket.quotes) }),
    [state.holdings, state.market, market.quotes, stockMarket.quotes],
  );
  const activeState = useMemo(
    () => ({ ...state, holdings: activeHoldings }),
    [state, activeHoldings],
  );
  const [page, setPage] = useState(0);
  const [storageBlocked, setStorageBlocked] = useState(!!initial.error);
  const [message, setMessage] = useState(initial.error);
  const [saveError, setSaveError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const menuDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (storageBlocked) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSaveError("");
    } catch {
      setSaveError(
        "브라우저에 저장하지 못했습니다. 창을 닫기 전에 JSON 백업을 내려받으세요.",
      );
    }
  }, [state, storageBlocked]);
  const update = (next: StrategyState) => {
    setState((previous) => ({
      ...next,
      holdings: {
        ...next.holdings,
        stocks: previous.holdings.stocks,
        cntnPrice:
          previous.market.cntn === "auto"
            ? previous.holdings.cntnPrice
            : next.holdings.cntnPrice,
        ccPrice:
          previous.market.cc === "auto"
            ? previous.holdings.ccPrice
            : next.holdings.ccPrice,
        exchangeRate:
          previous.market.fx === "auto"
            ? previous.holdings.exchangeRate
            : next.holdings.exchangeRate,
      },
    }));
  };
  const navigate = (index: number) => {
    menuDialog.current?.close();
    setPage(index);
    setTimeout(() => heading.current?.focus(), 0);
    window.scrollTo({ top: 0 });
  };
  const content = [
    AssetsPage,
    TargetsPage,
    SalesPage,
    LoansPage,
    LeveragePage,
    HousingPage,
    ForecastPage,
  ][page];
  const Page = content;
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        본문으로 이동
      </a>
      <header className="mobile-header">
        <span className="mobile-logo">A↗</span>
        <div>
          <strong>Asset Strategy</strong>
          <small>
            {page === 6
              ? `${state.housing.years}년 순자산 전망`
              : pages[page].title}
          </small>
        </div>
        <button
          onClick={() => menuDialog.current?.showModal()}
          aria-label="전체 메뉴 열기"
        >
          ☰ 메뉴
        </button>
      </header>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            A<span>↗</span>
          </div>
          <div>
            Asset Strategy<small>DASHBOARD</small>
          </div>
        </div>
        <div className="sidebar-label">나의 자산 전략</div>
        <nav aria-label="주 메뉴">
          {pages.map((item, index) => (
            <button
              key={item.title}
              className={`nav-item ${page === index ? "active" : ""}`}
              aria-current={page === index ? "page" : undefined}
              onClick={() => navigate(index)}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.title}
              {page === index && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-dot" />
          <strong>나만의 로컬 공간</strong>
          <p>
            입력값은 이 브라우저에 저장됩니다.
            <br />
            로그인 없이 내 기기에서 실행됩니다.
          </p>
          <span className="version">CONNECTED DATA · V2.0</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            PERSONAL FINANCE <span className="topbar-divider">/</span> Asset
            Strategy Dashboard
          </span>
          <span
            className={`save-status ${saveError || storageBlocked ? "negative" : ""}`}
            role="status"
          >
            ●{" "}
            {saveError || storageBlocked
              ? "자동 저장 확인 필요"
              : "이 브라우저에 자동 저장"}
          </span>
        </header>
        <main id="main">
          <div className="page-header">
            <div>
              <span className="eyebrow">{pages[page].eyebrow}</span>
              <h1 tabIndex={-1} ref={heading}>
                {page === 6
                  ? `${state.housing.years}년 순자산 전망`
                  : pages[page].title}
              </h1>
              <p>{pages[page].description}</p>
            </div>
            <span className="badge">자동 시세 + 내 자산 기록</span>
          </div>
          {message && (
            <div className="notice" role="status">
              {message}
              <button className="text-button" onClick={() => setMessage("")}>
                닫기
              </button>
            </div>
          )}
          {saveError && (
            <p className="notice warning" role="alert">
              {saveError}
            </p>
          )}
          {storageBlocked && (
            <div className="notice warning">
              <p>
                기존 저장값을 덮어쓰지 않도록 자동 저장을 멈췄습니다. 백업을
                복원하거나 새 저장을 시작하세요.
              </p>
              <button
                onClick={() => {
                  try {
                    download(
                      localStorage.getItem(STORAGE_KEY) ?? "",
                      "asset-strategy-recovery.json",
                    );
                  } catch {
                    setMessage("브라우저 저장소 접근이 차단되었습니다.");
                  }
                }}
              >
                기존 원본 내려받기
              </button>
              <button
                onClick={() => {
                  setStorageBlocked(false);
                  setMessage("현재 입력값으로 저장을 시작했습니다.");
                }}
              >
                현재 값으로 새 저장 시작
              </button>
            </div>
          )}
          <LiveMarketPanel
            modes={state.market}
            quotes={market.quotes}
            errors={market.errors}
            holdings={activeHoldings}
            now={market.now}
            onMode={(key, mode) =>
              setState((previous) => ({
                ...previous,
                market: { ...previous.market, [key]: mode },
              }))
            }
            refresh={market.refresh}
            canRefresh={market.canRefresh}
          />
          <Page state={activeState} update={update} stockPanel={
            <StockPanel stocks={state.holdings.stocks} exchangeRate={activeHoldings.exchangeRate}
              quotes={stockMarket.quotes} errors={stockMarket.errors} now={market.now} accept={stockMarket.accept}
              onChange={(change) => setState((previous) => ({ ...previous, holdings: { ...previous.holdings, stocks: change(previous.holdings.stocks) } }))} />
          } />
          <section className="data-toolbar" aria-label="데이터 관리">
            <div>
              <strong>내 데이터 관리</strong>
              <p>
                브라우저 데이터 삭제 전 백업하세요. PC·휴대폰 간에는 자동
                동기화되지 않습니다.
              </p>
            </div>
            <div className="button-row">
              <button
                onClick={() =>
                  download(
                    JSON.stringify(state, null, 2),
                    `asset-strategy-${new Date().toISOString().slice(0, 10)}.json`,
                  )
                }
              >
                JSON 백업
              </button>
              <button onClick={() => fileInput.current?.click()}>
                백업 복원
              </button>
              <button
                className="text-button"
                onClick={() => {
                  try {
                    const old = localStorage.getItem("moa-portfolio-v1");
                    if (old) download(old, "moa-legacy-backup.json");
                    else
                      setMessage(
                        "이 브라우저에 이전 모아 기록이 없습니다. 새 앱과 이전 기록은 별도로 보관됩니다.",
                      );
                  } catch {
                    setMessage("이전 기록을 읽지 못했습니다.");
                  }
                }}
              >
                이전 모아 기록 백업
              </button>
              <button
                className="text-button danger"
                onClick={() => setResetOpen(true)}
              >
                초기화
              </button>
            </div>
            <input
              ref={fileInput}
              type="file"
              hidden
              accept=".json,application/json"
              aria-label="백업 JSON 파일"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                try {
                  if (file.size > 1_000_000)
                    throw new Error("1MB 이하의 JSON 백업을 선택하세요.");
                  const next = parseState(await file.text());
                  setState(next);
                  setStorageBlocked(false);
                  setMessage("백업을 복원했습니다. 모든 계산에 반영했습니다.");
                } catch (error) {
                  setMessage((error as Error).message);
                }
              }}
            />
          </section>
          <footer>
            Asset Strategy Dashboard · 계산 결과는 입력 가정에 따른
            시뮬레이션입니다.
          </footer>
        </main>
      </div>
      <nav className="mobile-bottom" aria-label="휴대폰 빠른 메뉴">
        {[
          { index: 0, label: "내 자산" },
          { index: 1, label: "시뮬레이션" },
          { index: 5, label: "아파트" },
        ].map((item) => (
          <button
            key={item.index}
            className={page === item.index ? "active" : ""}
            aria-current={page === item.index ? "page" : undefined}
            onClick={() => navigate(item.index)}
          >
            <span aria-hidden="true">{pages[item.index].icon}</span>
            {item.label}
          </button>
        ))}
        <button onClick={() => menuDialog.current?.showModal()}>
          <span aria-hidden="true">☰</span>전체 메뉴
        </button>
      </nav>
      <dialog
        className="mobile-menu-dialog"
        ref={menuDialog}
        aria-labelledby="mobile-menu-title"
      >
        <div className="menu-title">
          <h2 id="mobile-menu-title">전체 메뉴</h2>
          <button
            onClick={() => menuDialog.current?.close()}
            aria-label="전체 메뉴 닫기"
          >
            닫기 ✕
          </button>
        </div>
        <nav aria-label="모바일 전체 메뉴">
          {pages.map((item, index) => (
            <button
              key={item.title}
              className={page === index ? "active" : ""}
              aria-current={page === index ? "page" : undefined}
              onClick={() => navigate(index)}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.title}
            </button>
          ))}
        </nav>
        <p>입력값은 현재 기기의 브라우저에 저장됩니다.</p>
      </dialog>
      {resetOpen && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
          >
            <h2 id="reset-title">입력값을 초기화할까요?</h2>
            <p>
              새 앱의 자산·대출·시뮬레이션 설정을 예시 기본값으로 되돌립니다.
              이전 모아 기록은 유지됩니다.
            </p>
            <div className="button-row">
              <button autoFocus onClick={() => setResetOpen(false)}>
                취소
              </button>
              <button
                className="primary"
                onClick={() => {
                  setState(newDefaultState());
                  setStorageBlocked(false);
                  setResetOpen(false);
                  setMessage("기본 예시값으로 초기화했습니다.");
                }}
              >
                기본값으로 초기화
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
