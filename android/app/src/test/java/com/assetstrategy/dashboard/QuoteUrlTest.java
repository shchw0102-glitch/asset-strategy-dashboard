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
}
