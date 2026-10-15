import { describe, it, expect } from 'vitest';
import { validStockSymbol, stockCurrency, stockSymbolFromInput, validStockQuote } from './stocks';
import { newDefaultState } from '../strategy/defaults';
import { parseState } from '../strategy/storage';
const bases = ['005930','0052D0','0138Y0','0184N0','0210A0','0167A0'];
describe('Korean alphanumeric symbols',()=>{
  it.each(bases)('%s supports both markets, KRW, lowercase input and backups',(base)=>{
    for(const exchange of ['KS','KQ']) {
      const symbol = stockSymbolFromInput(base.toLowerCase(),exchange);
      expect(symbol).toBe(`${base}.${exchange}`);
      expect(validStockSymbol(symbol)).toBe(true);
      expect(stockCurrency(symbol)).toBe('KRW');
      const state=newDefaultState();
      state.holdings.stocks=[{symbol,name:base,currency:'KRW',quantity:10,price:10000,mode:'auto'}];
      expect(parseState(JSON.stringify(state))).toEqual(state);
      const now=Date.now();
      expect(validStockQuote({symbol,name:base,currency:'KRW',price:10000,asOf:now,receivedAt:now,source:'Yahoo Finance',sourceUrl:`https://finance.yahoo.com/quote/${symbol}/`,marketSession:'regular'},symbol,now)).toBe(true);
    }
  });
  it.each(['12345.KS','1234567.KS','ABC.KS','ABC.KQ','0052D0.US','0052 D0.KS','0052D0.KS ','0052D0.KS\n','0052\tD0.KS','https://evil.test/0052D0.KS','../0052D0.KS','0052D0.KS?url=https://evil.test'])('rejects %s',symbol=>expect(validStockSymbol(symbol)).toBe(false));
  it('keeps US tickers separate from Korean market suffixes',()=>{
    for(const symbol of ['AAPL','TSLA','BRK-B','BRK.B']) {expect(validStockSymbol(symbol)).toBe(true);expect(stockCurrency(symbol)).toBe('USD');}
    expect(stockSymbolFromInput('aapl','US')).toBe('AAPL');
    expect(validStockSymbol('ABCDEF.KS')).toBe(true);expect(stockCurrency('ABCDEF.KS')).toBe('KRW');
  });
});
