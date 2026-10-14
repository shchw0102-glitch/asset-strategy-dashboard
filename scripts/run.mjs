import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dev = process.argv.includes("--dev");
const lan = process.argv.includes("--lan");
// Node 24의 공식 프록시/시스템 CA 지원. TLS 검증을 끄지 않습니다.
if (!process.env.ASD_BOOTSTRAPPED) {
  const child = spawn(
    process.execPath,
    [
      "--use-env-proxy",
      "--use-system-ca",
      fileURLToPath(import.meta.url),
      ...process.argv.slice(2),
    ],
    {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, ASD_BOOTSTRAPPED: "1" },
    },
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => child.kill(signal));
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
  child.on("error", (e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
} else {
  const { startServer } = await import("../server/http.mjs");
  const port = Number(process.env.ASD_PORT || (dev ? 8787 : 5173));
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("ASD_PORT는 올바른 포트 번호여야 합니다.");
  const server = await startServer({
    port,
    host: process.env.ASD_HOST || (lan ? "0.0.0.0" : "127.0.0.1"),
    staticRoot: dev ? undefined : resolve(root, "dist"),
  });
  console.log(
    dev
      ? `시세 서버 준비: 포트 ${port}`
      : `Asset Strategy Dashboard: http://localhost:${port}`,
  );
  if (lan) {
    const { lanAddresses } = await import("../server/network.mjs");
    console.log(
      "\n휴대폰을 PC와 같은 Wi-Fi에 연결하고 아래 주소를 Chrome에 입력하세요.",
    );
    for (const address of lanAddresses(port))
      console.log(`  휴대폰 접속 주소: ${address}`);
    console.log(
      "이 실행창과 PC를 켜 두세요. PC·휴대폰 기록은 별도이며 JSON 백업으로 옮길 수 있습니다.\n",
    );
  }
  if (!dev && process.argv.includes("--open")) {
    const url = `http://localhost:${port}`;
    const command =
      process.platform === "win32"
        ? "cmd"
        : process.platform === "darwin"
          ? "open"
          : "xdg-open";
    const args =
      process.platform === "win32" ? ["/c", "start", "", url] : [url];
    const opener = spawn(command, args, { stdio: "ignore", detached: true });
    opener.on("error", () =>
      console.log("브라우저 주소창에 위 주소를 입력하세요."),
    );
    opener.unref();
  }
  let vite;
  if (dev) {
    const args = process.argv
      .slice(2)
      .filter((x) => x !== "--dev" && x !== "--lan");
    vite = spawn(
      process.execPath,
      [resolve(root, "node_modules/vite/bin/vite.js"), ...args],
      {
        cwd: root,
        stdio: "inherit",
        env: { ...process.env, ASD_API_PORT: String(port) },
      },
    );
    vite.on("exit", (code) => {
      server.close();
      process.exitCode = code ?? 1;
    });
    vite.on("error", (e) => {
      console.error(e.message);
      server.close();
      process.exitCode = 1;
    });
  }
  let stopping = false;
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      if (stopping) return;
      stopping = true;
      vite?.kill(signal);
      server.close();
      server.closeAllConnections();
    });
}
