export function createStockService(options?: { fetcher?: typeof fetch; clock?: () => number }): { read(symbol: string): Promise<{quote: unknown; error: string | null}> };
