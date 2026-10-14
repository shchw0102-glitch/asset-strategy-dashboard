import { describe, it, expect } from "vitest";
import { createStockService, parseStock } from "./stocks.mjs";
import { startServer } from "./http.mjs";
const now=Date.now();
const data=(symbol="AAPL", currency="USD", instrumentType="EQUITY")=>({chart:{result:[{meta:{symbol,currency,instrumentType,longName:"Test Stock",regularMarketPrice:100,regularMarketTime:Math.floor(now/1000),currentTradingPeriod:{regular:{start:now/1000-60,end:now/1000+60}}}}]}});
const response=(json)=>({ok:true,json:async()=>json});
describe("추가 주식 API",()=>{
  it("미국 주식과 국내 ETF를 검증하고 통화 불일치·비주식을 거부한다",()=>{
    expect(parseStock(data(),"AAPL",now).price).toBe(100);
    expect(parseStock(data("005930.KS","KRW","ETF"),"005930.KS",now).currency).toBe("KRW");
    for(const bad of [data("TSLA"),data("AAPL","KRW"),data("AAPL","USD","CURRENCY")]) expect(()=>parseStock(bad,"AAPL",now)).toThrow();
    expect(parseStock(data(),"AAPL",now+120000).marketSession).toBe("outside");
  });
  it("요청 합치기·60초 캐시·장애 시 마지막 가격 보존",async()=>{
    let clock=now,calls=0,fail=false;
    const service=createStockService({clock:()=>clock,fetcher:async()=>{calls++; if(fail)throw new Error("network"); return response(data());}});
    await Promise.all([service.read("AAPL"),service.read("AAPL")]); expect(calls).toBe(1);
    clock+=59000;await service.read("AAPL");expect(calls).toBe(1);
    clock+=2000;fail=true;
    const result=await service.read("AAPL"); expect(calls).toBe(3);
    expect(result.quote.receivedAt).toBe(now);expect(result.error).toContain("조회 실패");
  });
  it("여러 종목을 독립 조회하고 동시에 최대 4개만 제공처에 요청한다",async()=>{
    let active=0,max=0;
    const service=createStockService({fetcher:async(url)=>{
      active++; max=Math.max(max,active); await new Promise(r=>setTimeout(r,5));active--;
      return response(data(decodeURIComponent(new URL(url).pathname.split("/").at(-1))));
    }});
    const results=await Promise.all(["AAPL","TSLA","MSFT","NVDA","AMD","SPY"].map(symbol=>service.read(symbol)));
    expect(max).toBe(4);expect(results.every(r=>r.quote&&!r.error)).toBe(true);
  });
  it("임의 URL·중복 인자·여러 종목을 거부하고 검증된 단일 종목만 서비스에 전달한다",async()=>{
    const requested=[];
    const server=await startServer({port:0,stockService:{read:async(symbol)=>{requested.push(symbol);return {quote:parseStock(data(),symbol,now),error:null};}}});
    const base=`http://127.0.0.1:${server.address().port}`;
    try{
      for(const suffix of ["?url=https://example.com","?symbol=../../etc/passwd","?symbol=AAPL&symbol=TSLA","?symbol=AAPL,TSLA","?symbol=AAPL&url=x"]) expect((await fetch(base+"/api/stocks"+suffix)).status).toBe(400);
      expect((await(await fetch(base+"/api/stocks?symbol=AAPL")).json()).quote.symbol).toBe("AAPL");expect(requested).toEqual(["AAPL"]);
    }finally{await new Promise(resolve=>server.close(resolve));}
  });
});
