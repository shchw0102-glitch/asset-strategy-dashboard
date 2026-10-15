# 1.0.1 빌드 검증 (2026-10-15)

기준 main: b05439e. 앱 기능은 유지하고 국내 종목 검증 및 빌드 자동화만 수정했습니다.

- npm ci: 통과
- npm test: 107개 통과
- npm run typecheck: 통과
- npm run build: 통과
- npm run android:debug: 통과
- npm run android: 통과
- ./gradlew testDebugUnitTest: 4개 통과
- actionlint .github/workflows/android-build.yml: 통과
- APK 서명, 기존 배포 APK와 동일한 서명 인증서, APK assets와 dist 일치 확인

APK 경로: android/app/build/outputs/apk/debug/app-debug.apk

APK 크기: 240,096 bytes

SHA256: `73f4666375b2e00ffffc4af3a52da8ccce3b2ddf71ed913302df430d04e16297`

국내 정규식: `[A-Z0-9]{6}\.K[QS]`. 미국 티커 분기에서는 `.KS`/`.KQ` 접미사를 제외하여 ABC.KS가 통과하지 않게 합니다. 공백·탭·개행 및 URL 삽입을 거부합니다. Android의 HTTPS 호스트·경로·쿼리 제한은 유지합니다.

0052D0, 0138Y0, 0184N0, 0210A0, 0167A0 및 기존005930 모두 KS/KQ 유효성과 KRW 분류 테스트를 통과했습니다. 검증 통과는 Yahoo의 실제 데이터 제공을 보장하지 않습니다.

server/market.mjs는 CNTN/CC/환율 고정 종목 전용이며 국내 코드 정규식이 없어 수정하지 않았습니다. 일반 종목 검증은 server/stocks.mjs가 담당합니다.

실물 Android 설치 검증 및 GitHub Actions 원격 실행은 이번 점검에 포함하지 않았습니다. GitHub Actions 설정은 actionlint로 검증했으며 동일 명령을 현재 환경에서 실제 실행했습니다.
