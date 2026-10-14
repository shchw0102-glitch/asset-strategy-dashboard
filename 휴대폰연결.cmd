@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 goto no_node
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>24||(a===24&&b>=10)?0:1)"
if errorlevel 1 goto no_node
if not exist dist\index.html (
  echo 처음 실행에 필요한 파일을 설치합니다. 인터넷에 연결해 주세요.
  call npm ci
  if errorlevel 1 goto failed
  call npm run build
  if errorlevel 1 goto failed
)
echo Asset Strategy Dashboard와 시세 서버를 시작합니다.
echo 앱을 사용하는 동안 이 창을 열어 두세요. 종료하려면 Ctrl+C를 누르세요.
node scripts/run.mjs --lan --open
if errorlevel 1 goto failed
exit /b 0
:no_node
echo Node.js 24 LTS 버전이 필요합니다. https://nodejs.org 에서 설치 후 다시 실행하세요.
pause
exit /b 1
:failed
echo 실행에 실패했습니다. 위 오류를 확인하거나 README.md의 문제 해결 안내를 확인하세요.
pause
exit /b 1
