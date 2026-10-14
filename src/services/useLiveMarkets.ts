import { newId } from "./id";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  marketKeys,
  mergeQuote,
  parseSocketQuote,
  QUOTE_CACHE_KEY,
  readQuoteCache,
  validQuote,
  type LiveQuotes,
  type MarketKey,
  type MarketModes,
} from "./liveQuotes";
export function useLiveMarkets(modes: MarketModes) {
  const [quotes, setQuotes] = useState<LiveQuotes>(readQuoteCache);
  const [errors, setErrors] = useState<Partial<Record<MarketKey, string>>>({});
  const [now, setNow] = useState(Date.now());
  const [refreshId, setRefreshId] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const current = useRef(quotes);
  const lastRequest = useRef(0);
  const automatic = Object.values(modes).some((mode) => mode === "auto");
  const autoCC = modes.cc === "auto";
  const commit = useCallback((q: unknown, key: MarketKey) => {
    current.current = mergeQuote(current.current, q, key);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      setQuotes(current.current);
    }, 1000);
    const save = setInterval(() => {
      try {
        localStorage.setItem(QUOTE_CACHE_KEY, JSON.stringify(current.current));
      } catch {
        /* 캐시는 선택 사항 */
      }
    }, 15_000);
    const flush = () => {
      try {
        localStorage.setItem(QUOTE_CACHE_KEY, JSON.stringify(current.current));
      } catch {
        /* 입력 데이터는 App에서 별도 저장 */
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      clearInterval(timer);
      clearInterval(save);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);
  useEffect(() => {
    if (!automatic) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | null = null;
    let failures = 0;
    const poll = async () => {
      if (stopped) return;
      if (location.protocol === "file:") {
        setErrors((old) => ({
          ...old,
          cntn: "주가·환율 자동 조회는 전체 프로젝트의 실행하기.cmd 또는 npm start로 실행하세요.",
          fx: "주가·환율 자동 조회는 로컬 시세 서버가 필요합니다.",
        }));
        return;
      }
      if (!navigator.onLine) {
        setErrors((old) => ({
          ...old,
          cntn: "인터넷 연결을 확인하세요.",
          fx: "인터넷 연결을 확인하세요.",
          cc: "인터넷 연결을 확인하세요.",
        }));
        timer = setTimeout(poll, 15_000);
        return;
      }
      const elapsed = Date.now() - lastRequest.current;
      if (elapsed < 15_000) {
        timer = setTimeout(poll, 15_000 - elapsed);
        return;
      }
      lastRequest.current = Date.now();
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 20_000);
      try {
        const response = await fetch("./api/market", {
          signal: controller.signal,
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error(`시세 서버 응답 ${response.status}`);
        const data = await response.json();
        if (data.version !== 1 || !data.quotes)
          throw new Error(
            "시세 서버가 없는 실행 방식입니다. 실행하기.cmd 또는 npm start를 이용하세요.",
          );
        if (stopped) return;
        const next: Partial<Record<MarketKey, string>> = {};
        for (const key of marketKeys) {
          const item = data.quotes[key];
          if (validQuote(item?.quote, key)) commit(item.quote, key);
          if (item?.error) next[key] = String(item.error).slice(0, 250);
          else if (!validQuote(item?.quote, key))
            next[key] = "제공처에서 올바른 시세를 받지 못했습니다.";
        }
        setErrors(next);
        failures = 0;
      } catch (error) {
        if (stopped) return;
        failures++;
        const detail =
          error instanceof SyntaxError
            ? "시세 서버가 없습니다. 전체 프로젝트를 실행하기.cmd 또는 npm start로 실행하세요."
            : "시세 서버 연결 실패 · 인터넷과 실행창을 확인하세요.";
        setErrors({ cntn: detail, fx: detail, cc: detail });
      } finally {
        clearTimeout(timeout);
        controller = null;
        if (!stopped)
          timer = setTimeout(
            poll,
            Math.min(60_000, 15_000 * 2 ** Math.min(failures, 2)),
          );
      }
    };
    // StrictMode의 첫 setup/cleanup에서는 네트워크 요청을 만들지 않습니다.
    timer = setTimeout(poll, 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [automatic, refreshId, commit]);
  useEffect(() => {
    if (!autoCC) return;
    let stopped = false;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout>;
    let retryDelay = 15_000;
    let lastFrame = Date.now();
    function connect() {
      if (stopped) return;
      if (!navigator.onLine) {
        retry = setTimeout(connect, 15_000);
        return;
      }
      try {
        socket = new WebSocket("wss://api.upbit.com/websocket/v1");
      } catch {
        retry = setTimeout(connect, retryDelay);
        return;
      }
      socket.binaryType = "arraybuffer";
      lastFrame = Date.now();
      socket.onopen = () => {
        setWsConnected(true);
        socket?.send(
          JSON.stringify([
            { ticket: newId() },
            { type: "ticker", codes: ["KRW-CC", "KRW-BTC"] },
            { format: "DEFAULT" },
          ]),
        );
      };
      socket.onmessage = (event) => {
        if (stopped) return;
        const raw =
          typeof event.data === "string"
            ? event.data
            : new TextDecoder().decode(event.data);
        try {
          const frame = JSON.parse(raw);
          if (
            frame.type === "ticker" &&
            ["KRW-CC", "KRW-BTC"].includes(frame.code)
          ) {
            lastFrame = Date.now();
            retryDelay = 15_000;
          }
        } catch {
          return;
        }
        const quote = parseSocketQuote(raw);
        if (quote) {
          commit(quote, "cc");
          setErrors((old) => ({ ...old, cc: undefined }));
        }
      };
      socket.onerror = () => {
        /* REST 조회가 독립적으로 계속됩니다. */
      };
      socket.onclose = () => {
        setWsConnected(false);
        socket = null;
        if (!stopped) {
          retry = setTimeout(connect, retryDelay);
          retryDelay = Math.min(60_000, retryDelay * 2);
        }
      };
    }
    const watchdog = setInterval(() => {
      if (socket && Date.now() - lastFrame > 45_000) socket.close();
    }, 5_000);
    retry = setTimeout(connect, 0);
    return () => {
      stopped = true;
      clearTimeout(retry);
      clearInterval(watchdog);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [autoCC, commit]);
  const refresh = () => {
    if (Date.now() - lastRequest.current >= 15_000)
      setRefreshId((value) => value + 1);
  };
  // 주식 조회 장애가 있어도 새 업비트 스트림을 잘못 오류로 표시하지 않습니다.
  const displayedErrors = { ...errors };
  if (quotes.cc?.transport === "websocket") {
    if (wsConnected && now - quotes.cc.receivedAt < 15_000)
      delete displayedErrors.cc;
    else if (!wsConnected)
      displayedErrors.cc = "실시간 연결 끊김 · 업비트 15초 조회로 재시도 중";
  }
  return {
    quotes,
    errors: displayedErrors,
    now,
    refresh,
    canRefresh: now - lastRequest.current >= 15_000,
  };
}
