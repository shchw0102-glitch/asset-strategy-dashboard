import {it,expect} from 'vitest';
import {validStockSymbol,stockCurrency,parseStock,createStockService} from './stocks.mjs';
const bases=['005930','0052D0','0138Y0','0184N0','0210A0','0167A0'];
it.each(bases)('server accepts %s as a KRW stock or ETF in KS/KQ',async(base)=>{
 for(const exchange of ['KS','KQ']) {
  const symbol=`${base}.${exchange}`,now=Date.now();
  expect(validStockSymbol(symbol)).toBe(true);expect(stockCurrency(symbol)).toBe('KRW');
  const data={chart:{result:[{meta:{symbol,currency:'KRW',instrumentType:'ETF',regularMarketPrice:10000,regularMarketTime:Math.floor(now/1000)}}]}};
  expect(parseStock(data,symbol,now).currency).toBe('KRW');
  const service=createStockService({fetcher:async(url)=>{expect(url).toContain(`/chart/${symbol}?`);return {ok:true,json:async()=>data};}});
  expect((await service.read(symbol)).quote.symbol).toBe(symbol);
  data.chart.result[0].meta.currency='USD';expect(()=>parseStock(data,symbol,now)).toThrow();
 }
});
it('server rejects malformed Korean symbols without falling through to US tickers',async()=>{
 const service=createStockService({fetcher:async()=>{throw new Error('must not fetch');}});
 for(const symbol of ['12345.KS','1234567.KS','ABC.KS','ABC.KQ','0052D0.US','0052 D0.KS','0052D0.KS ','0052D0.KS\n','0052\tD0.KS','https://evil.test/0052D0.KS','../0052D0.KS']) {
  expect(validStockSymbol(symbol)).toBe(false);await expect(service.read(symbol)).rejects.toThrow('허용되지');
 }
 for(const symbol of ['AAPL','TSLA','BRK-B']){expect(validStockSymbol(symbol)).toBe(true);expect(stockCurrency(symbol)).toBe('USD');}
});
