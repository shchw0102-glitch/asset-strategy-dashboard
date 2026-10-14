#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if ! command -v node >/dev/null 2>&1; then
  echo 'Termux에서 pkg install nodejs-lts 를 먼저 실행하세요.'
  exit 1
fi
node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<24||(a===24&&b<10)){console.error("Node.js 24.10 이상 필요: pkg upgrade 후 재시도하세요.");process.exit(1)}'
if [ ! -f dist/index.html ]; then
  npm ci
  npm run build
fi
echo '휴대폰 Chrome에 실행창의 주소를 입력하세요. Termux를 실행 상태로 유지하세요.'
exec node scripts/run.mjs
