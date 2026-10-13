import { useEffect, useRef, useState } from "react";
import {
  defaultWatchMarkets,
  isSupportedMarket,
  parseUpbitTicker,
  quoteCacheKey,
  readQuoteCache,
  upbitSocketUrl,
  type Quotes,
} from "./upbit";

export type QuoteStatus = "connecting" | "live" | "reconnecting" | "offline";

export function useUpbitQuotes(markets: string[]) {
  const codesKey = [...new Set([...defaultWatchMarkets, ...markets])]
    .filter(isSupportedMarket)
    .sort()
    .join(",");
  const [quotes, setQuotes] = useState<Quotes>(readQuoteCache);
  const [status, setStatus] = useState<QuoteStatus>(
    navigator.onLine ? "connecting" : "offline",
  );
  const [now, setNow] = useState(Date.now());
  const lastConnect = useRef(0);
  const subscription = useRef<((codes: string[]) => void) | null>(null);
  const latestCodes = useRef(codesKey.split(","));
  latestCodes.current = codesKey.split(",");

  useEffect(() => {
    subscription.current?.(latestCodes.current);
  }, [codesKey]);
  useEffect(() => {
    let stopped = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let subscriptionTimer: ReturnType<typeof setTimeout> | undefined;
    let lastSubscribe = 0;
    let retryDelay = 15_000;
    let pending = readQuoteCache();
    let dirty = false;
    let lastSaved = 0;
    let lastMessage = Date.now();
    const ticket = crypto.randomUUID();
    function schedule() {
      if (stopped || retryTimer || !navigator.onLine) return;
      setStatus("reconnecting");
      retryTimer = setTimeout(
        () => {
          retryTimer = undefined;
          connect();
        },
        Math.max(retryDelay, 15_000 - (Date.now() - lastConnect.current)),
      );
      retryDelay = Math.min(retryDelay * 2, 60_000);
    }
    function subscribe(codes: string[]) {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      if (subscriptionTimer) clearTimeout(subscriptionTimer);
      const send = () => {
        subscriptionTimer = undefined;
        if (!socket || socket.readyState !== WebSocket.OPEN || stopped) return;
        socket.send(
          JSON.stringify([
            { ticket },
            { type: "ticker", codes },
            { format: "DEFAULT" },
          ]),
        );
        lastSubscribe = Date.now();
      };
      const delay = Math.max(0, 10_500 - (Date.now() - lastSubscribe));
      if (delay) subscriptionTimer = setTimeout(send, delay);
      else send();
    }
    function connect() {
      if (stopped || !navigator.onLine) {
        setStatus("offline");
        return;
      }
      const delay = 15_000 - (Date.now() - lastConnect.current);
      if (delay > 0) {
        retryTimer = setTimeout(() => {
          retryTimer = undefined;
          connect();
        }, delay);
        return;
      }
      lastConnect.current = Date.now();
      lastMessage = Date.now();
      setStatus("connecting");
      try {
        socket = new WebSocket(upbitSocketUrl);
      } catch {
        schedule();
        return;
      }
      socket.binaryType = "arraybuffer";
      socket.onopen = () => {
        lastSubscribe = 0;
        subscribe(latestCodes.current);
      };
      socket.onmessage = (event) => {
        if (stopped) return;
        try {
          const text =
            typeof event.data === "string"
              ? event.data
              : new TextDecoder().decode(event.data);
          const quote = parseUpbitTicker(text);
          if (!quote) return;
          lastMessage = Date.now();
          retryDelay = 15_000;
          const previous = pending[quote.market];
          if (!previous || quote.timestamp >= previous.timestamp) {
            pending = { ...pending, [quote.market]: quote };
            dirty = true;
            setStatus("live");
          }
        } catch {
          /* Ignore malformed frames without replacing verified prices. */
        }
      };
      socket.onerror = () => {
        if (!stopped) setStatus(navigator.onLine ? "reconnecting" : "offline");
      };
      socket.onclose = () => {
        socket = null;
        schedule();
      };
    }
    function offline() {
      setStatus("offline");
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = undefined;
      if (socket) {
        socket.onclose = null;
        socket.close();
        socket = null;
      }
    }
    function online() {
      schedule();
    }
    const clock = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (dirty) {
        setQuotes(pending);
        dirty = false;
      }
      if (time - lastSaved >= 15_000) {
        try {
          localStorage.setItem(quoteCacheKey, JSON.stringify(pending));
        } catch {
          /* Optional price cache; portfolio storage reports its own failures. */
        }
        lastSaved = time;
      }
      if (socket && time - lastMessage > 45_000) {
        socket.close();
        setStatus("reconnecting");
      }
    }, 1000);
    subscription.current = subscribe;
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    // Defer connection so React Strict Mode does not create then abort a socket.
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      connect();
    }, 0);
    return () => {
      stopped = true;
      subscription.current = null;
      clearInterval(clock);
      if (retryTimer) clearTimeout(retryTimer);
      if (subscriptionTimer) clearTimeout(subscriptionTimer);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, []);
  return { quotes, status, now };
}
