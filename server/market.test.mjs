import { describe, it, expect } from "vitest";
import { createMarketService, parseYahoo, parseUpbit } from "./market.mjs";
import { startServer } from "./http.mjs";
const now = 1_791_910_000_000;
const yahoo = (symbol = "CNTN", price = 2) => ({
  chart: {
    result: [
      {
        meta: {
          symbol,
          currency: symbol === "CNTN" ? "USD" : "KRW",
          instrumentType: symbol === "CNTN" ? "EQUITY" : "CURRENCY",
          regularMarketPrice: price,
          regularMarketTime: now / 1000,
          currentTradingPeriod: {
            regular: { start: now / 1000 - 3600, end: now / 1000 + 3600 },
          },
        },
      },
    ],
    error: null,
  },
});
const upbit = () => [
  { market: "KRW-CC", trade_price: 180.5, trade_timestamp: now },
];
const response = (data) => ({ ok: true, status: 200, json: async () => data });
describe("실제 시세 제공처 어댑터", () => {
  it("CNTN 정규장 가격·기준시각·출처를 보존한다", () => {
    expect(parseYahoo(yahoo(), "cntn", now)).toMatchObject({
      symbol: "CNTN",
      currency: "USD",
      price: 2,
      asOf: now,
      receivedAt: now,
      marketSession: "regular",
      source: "Yahoo Finance",
    });
    expect(parseYahoo(yahoo(), "cntn", now + 4_000_000).marketSession).toBe(
      "outside",
    );
  });
  it("USD/KRW 환율과 CC 업비트 원화 시세를 구분한다", () => {
    expect(parseYahoo(yahoo("KRW=X", 1400), "fx", now)).toMatchObject({
      symbol: "KRW=X",
      currency: "KRW",
      price: 1400,
    });
    expect(parseUpbit(upbit(), now)).toMatchObject({
      symbol: "KRW-CC",
      price: 180.5,
      asOf: now,
      source: "Upbit",
    });
  });
  it("다른 종목·통화·0 가격·미래 시각을 거부한다", () => {
    expect(() => parseYahoo(yahoo("AAPL"), "cntn", now)).toThrow();
    const data = yahoo();
    data.chart.result[0].meta.currency = "KRW";
    expect(() => parseYahoo(data, "cntn", now)).toThrow();
    expect(() => parseYahoo(yahoo("CNTN", 0), "cntn", now)).toThrow();
    expect(() =>
      parseUpbit([{ ...upbit()[0], market: "USDT-CC" }], now),
    ).toThrow();
    expect(() =>
      parseUpbit([{ ...upbit()[0], trade_timestamp: now + 60_000 }], now),
    ).toThrow();
  });
  it("동시 요청을 합치고 CC 15초·주가/환율 60초 캐시를 사용한다", async () => {
    let clock = now,
      calls = 0;
    const service = createMarketService({
      clock: () => clock,
      fetcher: async (url) => {
        calls++;
        await new Promise((r) => setTimeout(r, 5));
        return response(
          url.includes("upbit")
            ? upbit()
            : yahoo(
                url.includes("CNTN") ? "CNTN" : "KRW=X",
                url.includes("CNTN") ? 2 : 1400,
              ),
        );
      },
    });
    await Promise.all([service.snapshot(), service.snapshot()]);
    expect(calls).toBe(3);
    clock += 14_000;
    await service.snapshot();
    expect(calls).toBe(3);
    clock += 2_000;
    await service.snapshot();
    expect(calls).toBe(4);
    clock += 45_000;
    await service.snapshot();
    expect(calls).toBe(7);
  });
  it("Yahoo 기본 호스트 장애 시 보조 호스트로 조회한다", async () => {
    const hosts = [];
    const service = createMarketService({
      clock: () => now,
      fetcher: async (url) => {
        hosts.push(new URL(url).hostname);
        if (url.includes("query1")) throw new Error("network");
        return response(
          url.includes("upbit")
            ? upbit()
            : yahoo(
                url.includes("CNTN") ? "CNTN" : "KRW=X",
                url.includes("CNTN") ? 2 : 1400,
              ),
        );
      },
    });
    const data = await service.snapshot();
    expect(data.quotes.cntn.error).toBeNull();
    expect(hosts.filter((h) => h === "query2.finance.yahoo.com")).toHaveLength(
      2,
    );
  });
  it("장애·역순 응답은 이전 가격과 원래 조회시각을 유지한다", async () => {
    let clock = now,
      fail = false,
      stale = false;
    const service = createMarketService({
      clock: () => clock,
      fetcher: async (url) => {
        if (fail) throw new Error("network");
        const d = url.includes("upbit")
          ? upbit()
          : yahoo(
              url.includes("CNTN") ? "CNTN" : "KRW=X",
              url.includes("CNTN") ? 2 : 1400,
            );
        if (stale && !url.includes("upbit"))
          d.chart.result[0].meta.regularMarketTime -= 600;
        return response(d);
      },
    });
    await service.snapshot();
    clock += 61_000;
    fail = true;
    let data = await service.snapshot();
    expect(data.quotes.cntn.quote.receivedAt).toBe(now);
    expect(data.quotes.cntn.error).toContain("조회 실패");
    clock += 61_000;
    fail = false;
    stale = true;
    data = await service.snapshot();
    expect(data.quotes.cntn.quote.asOf).toBe(now);
    expect(data.quotes.cntn.error).toContain("이전 시각");
  });
  it("시세가 전혀 없을 때 예시 가격을 API 응답으로 만들지 않는다", async () => {
    const service = createMarketService({
      clock: () => now,
      fetcher: async () => ({ ok: false, status: 429 }),
    });
    const data = await service.snapshot();
    expect(data.quotes.cntn.quote).toBeNull();
    expect(data.quotes.cntn.error).toContain("429");
  });
});
describe("로컬 HTTP 경계", () => {
  it("헬스·시세 JSON을 제공하고 임의 URL·POST·외부 출처는 거부한다", async () => {
    const server = await startServer({
      port: 0,
      service: { snapshot: async () => ({ version: 1, quotes: {} }) },
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      expect((await (await fetch(base + "/api/health")).json()).status).toBe(
        "ok",
      );
      expect((await (await fetch(base + "/api/market")).json()).version).toBe(
        1,
      );
      expect(
        (await fetch(base + "/api/market?url=https://example.com")).status,
      ).toBe(400);
      expect(
        (await fetch(base + "/api/market", { method: "POST" })).status,
      ).toBe(405);
      expect(
        (
          await fetch(base + "/api/market", {
            headers: { Origin: "https://example.com" },
          })
        ).status,
      ).toBe(403);
      expect(
        (await fetch(base + "/api/market", { headers: { Origin: base } }))
          .status,
      ).toBe(200);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
