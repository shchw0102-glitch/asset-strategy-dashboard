import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { createMarketService } from "./market.mjs";
import { createStockService, validStockSymbol } from "./stocks.mjs";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
export function startServer({
  port = 8787,
  host = "127.0.0.1",
  staticRoot,
  service = createMarketService(),
  stockService = createStockService(),
} = {}) {
  const root = staticRoot ? resolve(staticRoot) : null;
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    // 임의의 교차 출처 사이트가 로컬 시세 서버를 사용하지 않도록 제한합니다.
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host) {
          res.writeHead(403);
          res.end("다른 출처의 요청은 허용하지 않습니다.");
          return;
        }
      } catch {
        res.writeHead(403);
        res.end();
        return;
      }
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      res.end();
      return;
    }
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/api/stocks") {
        const symbol = url.searchParams.get("symbol");
        if ([...url.searchParams].length !== 1 || !validStockSymbol(symbol)) {
          res.writeHead(400);
          res.end("미국 티커 또는 국내 종목코드.KS/.KQ 하나를 입력하세요.");
          return;
        }
        const data = await stockService.read(symbol);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        res.end(req.method === "HEAD" ? undefined : JSON.stringify(data));
        return;
      }
      if (url.pathname === "/api/market") {
        if (url.search) {
          res.writeHead(400);
          res.end("시세 조회에는 매개변수가 필요하지 않습니다.");
          return;
        }
        const data = await service.snapshot();
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(req.method === "HEAD" ? undefined : JSON.stringify(data));
        return;
      }
      if (url.pathname === "/api/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ status: "ok", app: "asset-strategy-dashboard" }),
        );
        return;
      }
      if (!root) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const path = resolve(
        root,
        `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`,
      );
      if (!path.startsWith(root + sep) || !mime[extname(path)]) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const body = await readFile(path);
      res.writeHead(200, {
        "Content-Type": mime[extname(path)],
        "Cache-Control":
          extname(path) === ".html" ? "no-cache" : "public, max-age=3600",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch (error) {
      res.writeHead(error?.code === "ENOENT" ? 404 : 502, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      res.end(
        error?.code === "ENOENT"
          ? "빌드 파일이 없습니다. npm run build를 실행하세요."
          : "시세를 가져오지 못했습니다. 잠시 후 재시도하세요.",
      );
    }
  });
  return new Promise((resolveStart, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      resolveStart(server);
    });
  });
}
