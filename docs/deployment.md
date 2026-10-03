# V2 단독 배포

저장소 루트의 `index.html` → `apps/play/src/main.ts`가 유일한 빌드 진입점이다. Vite + TypeScript + Three.js 정적 사이트로, 서버/DB/환경변수 없이 `dist/`를 호스팅한다.

## 로컬 확인

```powershell
npm.cmd ci
npm.cmd run test
npm.cmd run build
npm.cmd run dev
```

개발 서버는 `0.0.0.0:5173`에서 같은 Wi-Fi의 휴대폰 접속을 허용한다. 사진 저장의 네이티브 메뉴는 HTTPS 배포 주소에서 실기기 확인한다. LAN HTTP는 PNG 길게 누르기 대체 흐름을 사용한다.

## Vercel 설정

- Framework: Vite
- Root Directory: `package.json`과 `index.html`이 있는 저장소 루트 (`apps/play`가 아님)
- Install Command: `npm ci`
- Build Command: `npm run build`
- Output Directory: `dist`
- 환경변수: 현재 필요 없음

`package-lock.json`은 업로드한다. `node_modules/`, `dist/`, 테스트 산출물, `.env` 계열 파일은 업로드하지 않는다. 개발 전용 `?stress=` 진입 코드는 프로덕션 빌드에서 제거된다. 실제 GitHub 커밋/푸시와 Vercel 연결은 별도 단계다.

## 로컬에만 남기는 파일

`.gitignore`로 아래 파일들을 제외했으며 삭제/이동하지 않았다.

- `legacy/`, `apps/mobile/`
- `packages/game-core/`, `packages/activity-core/`
- `tests/game.test.ts`
- V1 브라우저 스크립트: `scripts/browser-check.js`, `scripts/lan-check.js`, `scripts/sound-check.js`
- V1 구현 문서: `docs/prototype.md`
- 원본 참고 이미지: `ex/`

V2 효과음은 `apps/play/src/audio.ts`에 독립적으로 있다. V1의 두 소리 레시피만 가져왔으며 레거시 설정/로컬 저장소/UI는 포함하지 않는다. 기본 타입 검사 및 Vitest 설정도 V2만 대상으로 한다. 로컬 개발 서버에서는 남아 있는 `/legacy/`가 열릴 수 있지만, GitHub에 복제한 프로젝트와 `dist/`에는 포함되지 않는다.

이 로컬 보관본은 GitHub에 백업되지 않는다. PC 이동/정리 전에 별도 백업이 필요하다. 이미 추적 중인 파일에는 `.gitignore`만으로 추적 해제가 되지 않지만, 이번 정리 시점에는 저장소에 추적 파일이 없었다.

## 앱 (Capacitor)

- 설정: `capacitor.config.ts`. 앱 ID `com.simulien.bodobodo`는 첫 스토어 업로드 후 바꿀 수 없다. 표시 이름 ‘보도보도’.
- `dist/`가 앱 안에 그대로 들어간다(외부 주소 로딩 없음, 오프라인 동작). `npm run app:sync` = 웹 빌드 + `cap sync`. `npm run app:android`는 이어서 Android Studio를 연다.
- 안드로이드: minSdk 24(Android 7), target/compile 36. 세로 고정이며, Android 16 대화면에서도 고정이 유지되도록 `PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY`를 넣었다(SDK 37 대상부터 무시되므로 그때 재검토).
- iOS: 세로 고정(아이패드는 세로·거꾸로 세로, `UIRequiresFullScreen`), 상태 표시줄 숨김, 사진 추가 권한 문구, `ITSAppUsesNonExemptEncryption = false`. Mac이 없으므로 빌드는 Codemagic에서 한다.
- 내보내기: 앱에서는 PNG를 사진 앱(안드로이드는 ‘보도보도’ 앨범)에, SVG는 공유 시트로 보낸다. 큰 파일은 3MB씩 캐시에 쓴다.
- 서명 키(`*.jks`, `key.properties`)와 Firebase 설정 파일은 `.gitignore`로 제외한다. 키는 반드시 별도로 백업한다.
- 빌드 JDK: Android Studio 내장 JDK(25)는 Gradle 8.14가 지원하지 않는다. `android/gradle/gradle-daemon-jvm.properties`가 JDK 21을 요구하며, 이 PC에는 `~/.jdks/jdk-21*`(Temurin)을 두었다. 명령줄 빌드: `cd android && ./gradlew assembleDebug`.
- 아이콘·시작 화면: `python scripts/make-app-icon.py` 후 `npx @capacitor/assets generate --assetPath assets/app-icon --android --ios --iconBackgroundColor '#2d2a2a' --iconBackgroundColorDark '#2d2a2a' --splashBackgroundColor '#2c2929' --splashBackgroundColorDark '#2c2929'`.

