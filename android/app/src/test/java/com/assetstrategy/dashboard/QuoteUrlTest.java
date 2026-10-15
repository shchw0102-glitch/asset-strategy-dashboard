package com.assetstrategy.dashboard;
import org.junit.Test;
import static org.junit.Assert.*;
public class QuoteUrlTest {
    @Test public void supportsEveryProvider() {
        for (String symbol : new String[]{"CNTN", "AAPL", "BRK-B", "005930.KS", "069500.KS", "035900.KQ", "KRW%3DX"})
            assertTrue(MainActivity.allowedQuoteUrl("https://query1.finance.yahoo.com/v8/finance/chart/" + symbol + "?interval=1m&range=1d"));
        assertTrue(MainActivity.allowedQuoteUrl("https://query2.finance.yahoo.com/v8/finance/chart/AAPL?interval=1m&range=1d"));
        assertTrue(MainActivity.allowedQuoteUrl("https://api.upbit.com/v1/ticker?markets=KRW-CC"));
    }
    @Test public void rejectsArbitraryNetworkAndLocalAccess() {
        for (String url : new String[]{"http://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1m&range=1d", "https://evil.test/", "https://localhost/", "file:///data/data/", "https://query1.finance.yahoo.com.evil.test/v8/finance/chart/AAPL?interval=1m&range=1d", "https://user@query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1m&range=1d", "https://query1.finance.yahoo.com:443/v8/finance/chart/AAPL?interval=1m&range=1d", "https://query1.finance.yahoo.com/v8/finance/chart/../../x?interval=1m&range=1d", "https://api.upbit.com/v1/accounts"})
            assertFalse(url,MainActivity.allowedQuoteUrl(url));
    }
    @Test public void supportsAlphanumericKoreanSymbols() {
        for (String base : new String[]{"005930", "0052D0", "0138Y0", "0184N0", "0210A0", "0167A0"})
            for (String suffix : new String[]{"KS", "KQ"})
                for (String host : new String[]{"query1", "query2"})
                    assertTrue(MainActivity.allowedQuoteUrl("https://" + host + ".finance.yahoo.com/v8/finance/chart/" + base + "." + suffix + "?interval=1m&range=1d"));
    }
    @Test public void rejectsMalformedKoreanSymbolsAndInjection() {
        for (String symbol : new String[]{"12345.KS", "1234567.KS", "ABC.KS", "ABC.KQ", "0052D0.US", "0052 D0.KS", "0052D0.KS ", "0052D0.KS\n", "0052\tD0.KS", "0052D0.KS/../../x", "0052D0.KS%3Furl=https://evil.test", "0052D0.KS?url=https://evil.test"})
            assertFalse(symbol, MainActivity.allowedQuoteUrl("https://query1.finance.yahoo.com/v8/finance/chart/" + symbol + "?interval=1m&range=1d"));
    }
}
