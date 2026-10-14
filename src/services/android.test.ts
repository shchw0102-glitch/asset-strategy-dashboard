import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAndroidApp, nativeRequest } from './android';
import { marketSnapshot, stockSnapshot } from './quoteTransport';
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('Android native transport', () => {
  it('web builds retain the existing HTTP API', async () => {
    vi.stubGlobal('window', {});
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({version:1,quotes:{}})));
    vi.stubGlobal('fetch', fetcher);
    expect(isAndroidApp()).toBe(false);
    expect((await marketSnapshot()).version).toBe(1);
    expect(fetcher.mock.calls[0][0]).toBe('./api/market');
  });
  it('APK resolves all core quotes through native HTTPS without a local server', async () => {
    const now = Math.floor(Date.now()/1000);
    const urls: string[] = [];
    const host = {AssetAndroid:{request:(id:string,method:string,raw:string)=>{
      expect(method).toBe('fetch');
      const url = JSON.parse(raw).url; urls.push(url);
      const symbol = decodeURIComponent(new URL(url).pathname.split('/').at(-1)!);
      const body = url.includes('upbit') ? [{market:'KRW-CC',trade_price:170,trade_timestamp:now*1000}]
        : {chart:{result:[{meta:{symbol,currency:symbol==='KRW=X'?'KRW':'USD',instrumentType:symbol==='KRW=X'?'CURRENCY':'EQUITY',regularMarketPrice:symbol==='KRW=X'?1400:3,regularMarketTime:now}}]}};
      queueMicrotask(()=>window.assetAndroidResult!(id,{value:{status:200,body:JSON.stringify(body)}}));
    }}};
    vi.stubGlobal('window',host);
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    const result=await marketSnapshot();
    expect(result.quotes.cntn.quote.price).toBe(3);
    expect(result.quotes.fx.quote.price).toBe(1400);
    expect(result.quotes.cc.quote.price).toBe(170);
    expect(urls).toHaveLength(3);expect(urls.every(url=>url.startsWith('https://'))).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('APK stock adapter preserves the provider currency and metadata',async()=>{
    vi.stubGlobal('window',{AssetAndroid:{request:(id:string,_method:string,raw:string)=>{
      const symbol=decodeURIComponent(new URL(JSON.parse(raw).url).pathname.split('/').at(-1)!);
      queueMicrotask(()=>window.assetAndroidResult!(id,{value:{status:200,body:JSON.stringify({chart:{result:[{meta:{symbol,currency:'KRW',instrumentType:'ETF',regularMarketPrice:10000,regularMarketTime:Math.floor(Date.now()/1000)}}]}})}}));
    }}});
    expect((await stockSnapshot('069500.KS')).quote.currency).toBe('KRW');
  });
  it('backup save uses a native picker and reports cancellation/errors',async()=>{
    vi.stubGlobal('window',{AssetAndroid:{request:(id:string,method:string)=>{
      expect(method).toBe('save');queueMicrotask(()=>window.assetAndroidResult!(id,{value:false}));
    }}});
    expect(await nativeRequest('save',{name:'backup.json',content:'{}'})).toBe(false);
    window.AssetAndroid!.request=(id)=>queueMicrotask(()=>window.assetAndroidResult!(id,{error:'저장 실패'}));
    await expect(nativeRequest('save',{})).rejects.toThrow('저장 실패');
  });
});
