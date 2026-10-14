# Android 설치형 APK

이 버전은 React 화면과 계산 코드를 APK 안에 포함한 실제 Android 앱입니다. **실행에 PC, Node.js, Termux 또는 별도 서버가 필요하지 않습니다.** Android 8.0 이상과 최신 Android System WebView/Chrome을 권장합니다. 인터넷 없이 계산·입력·저장·백업이 동작하며 시세 조회에만 인터넷이 필요합니다.

[**설치 APK 바로 다운로드**](https://github.com/shchw0102-glitch/asset-strategy-dashboard/raw/refs/heads/main/downloads/app-debug.apk)

## 휴대폰에 설치하기

1. 제공된 `app-debug.apk`를 휴대폰에 내려받습니다.
2. ‘내 파일 → 다운로드’에서 APK를 누릅니다.
3. Android가 묻는 경우 다운로드에 사용한 앱의 **이 출처의 앱 설치 허용**을 켭니다.
4. **설치 → 열기**를 누릅니다. 홈 화면의 **Asset Strategy** 아이콘으로 다시 실행할 수 있습니다.

디버그 서명 APK이며 Play Store 배포용은 아닙니다. 동일한 앱 ID와 서명키로 만든 새 APK는 덮어 설치해 데이터를 유지합니다. 서명이 다르다는 오류가 나면 먼저 기존 앱에서 JSON 백업을 보관하세요. 앱 삭제 또는 Android 설정의 ‘데이터 삭제’는 저장값을 지웁니다.

## 기존 기록 옮기기

Chrome/PC/Termux의 웹 저장소와 APK 저장소는 Android 보안 정책상 별개입니다. 기존 앱 아래 **JSON 백업**으로 파일을 저장하고 APK의 **백업 복원**에서 선택하세요. v1 형식, 수량, 대출, 시나리오, 수동 가격과 자동 모드를 유지하며 기존 연금 항목만 제외합니다. 기존 웹 기록을 삭제하지 않습니다.

APK의 **JSON 백업**은 Android 파일 저장 창을 엽니다. Downloads 등 원하는 위치를 선택하세요. 복원은 Android 파일 선택 창에서 JSON을 고른 뒤 기존 검증 함수를 거칩니다. 자동 조회 가격 캐시는 백업과 별개이므로 복원 후 다시 조회합니다.

## 보존된 기능

자산·부채·순자산·목표 달성률, CNTN/CC 시뮬레이터, 분할매도, 대출, 레버리지, 아파트 비교, 5년 전망, 미국/국내 주식·ETF 추가, JSON 백업·복원, 모바일 메뉴를 그대로 사용합니다. 주식 추가는 **내 자산 → 내 주식 추가·관리**에서 거래소·코드·수량을 입력하세요.

## 시세 구조

- 화면은 앱 내 assets에서 읽습니다. 웹사이트를 원격으로 불러오거나 Node 서버를 실행하지 않습니다.
- Yahoo의 CNTN·미국/국내 주식·ETF·USD/KRW와 Upbit REST 조회는 Android `HttpsURLConnection`으로 직접 전송합니다. CORS 우회용 외부 서버나 API 키가 없습니다.
- 기존 `server/market.mjs`와 `server/stocks.mjs`의 순수 제공처 모듈을 앱 번들에서도 재사용합니다. 같은 응답 검증, 캐시, 동시 요청 제한, 보조 Yahoo 호스트를 사용합니다. Node HTTP 서버 파일은 APK에 포함하지 않습니다.
- Upbit WebSocket은 기존 연결을 유지하며 실패 시 네이티브 REST 조회로 보완합니다.
- 주식은 약60초마다 최근 정규장 가격을 조회합니다. 제공처 지연·휴장·요청 제한이 있을 수 있습니다. 시각과 실패 상태를 표시하고 마지막 시세 또는 수동값으로 계산합니다.
- APK에 계좌 비밀번호·API 키가 없으며 외부로 보내는 것은 종목 조회뿐입니다. 개인정보가 포함된 자산 JSON은 사용자가 선택한 파일에만 저장됩니다.

## 개발자: 재현 가능한 빌드

필수: Node.js24.10+, JDK17 또는 전체 JDK21, Android SDK Platform35, Build Tools35.0.0. Android Studio SDK Manager에서 설치할 수 있습니다. Gradle Wrapper는8.11.1, Android Gradle Plugin은8.9.2입니다.

```sh
npm ci
npm test
npm run android:prepare
cd android
# Android Studio가 생성하거나 직접 local.properties에 sdk.dir=<SDK 경로> 지정
./gradlew assembleDebug
./gradlew bundleRelease
```

Windows에서는 `gradlew.bat assembleDebug` 및 `gradlew.bat bundleRelease`를 사용합니다. macOS/Linux에서는 `npm run android:debug`와 `npm run android:bundle`도 가능합니다.

산출물:

- 설치 APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- release AAB: `android/app/build/outputs/bundle/release/app-release.aab`

기본 release AAB는 **서명되지 않습니다**. Play Console 제출은 본인의 업로드 키로 서명해야 합니다. 다음 환경변수를 설정하면 release 빌드가 서명을 적용합니다: `ASD_RELEASE_KEYSTORE`(절대 경로), `ASD_RELEASE_STORE_PASSWORD`, `ASD_RELEASE_KEY_ALIAS`, `ASD_RELEASE_KEY_PASSWORD`. 키·비밀번호를 Git에 넣지 마세요. 같은 서명키를 안전하게 보관해야 이후 업데이트를 설치할 수 있습니다.

웹 소스 수정 후에는 반드시 `npm run android:prepare`로 assets를 갱신한 다음 Gradle을 실행하세요. 앱 ID `com.assetstrategy.dashboard`, 로컬 origin `https://appassets.androidplatform.net`과 localStorage 키는 업데이트 시 유지해야 합니다.

## 웹 버전

PC/브라우저 실행 방식은 그대로 지원합니다. 이전 Wi-Fi 및 Termux 안내는 [ANDROID-WEB.md](ANDROID-WEB.md)에 보존했습니다. APK 사용자에게는 필요하지 않습니다.

## 이번 빌드 검증 결과

- 기존 금융·저장·시세 회귀 및 Android 브리지 테스트: 81개 통과.
- Android JVM URL 검증 테스트: 2개 통과.
- `assembleDebug`, `bundleRelease`, `lintDebug` 성공. Lint 오류0개, 경고3개(신규 Android 속성, JavaScript 사용, 데이터 추출 규칙 안내). JavaScript는 APK 내장 React 화면에만 사용하고 외부 페이지는 브라우저로 엽니다.
- `apksigner verify --verbose`로 debug APK v2 서명 검증 완료.
- APK 내 화면 파일이 최신 dist와 일치하며 DEX·Manifest·시작 Activity·인터넷 권한을 확인했습니다. Node 실행 파일이나 웹 서버를 포함하지 않습니다.
- 이 클라우드 환경에는 Android 기기/에뮬레이터가 연결되어 있지 않아 실기기 설치·터치·시스템 파일 선택 창 동작은 아직 직접 확인하지 못했습니다. APK 생성·서명·정적 검사와 단위 테스트를 실기기 검증으로 표현하지 않습니다.
