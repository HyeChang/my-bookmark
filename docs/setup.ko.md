# 셀프 호스팅 설정 가이드

이 프로젝트는 사용자가 자신의 Firebase와 Cloudflare 리소스로 직접 배포해서 사용하는 셀프 호스팅 앱입니다. 원저자의 Firebase, Cloudflare Worker, D1, R2 설정은 이 저장소에 포함되어 있지 않습니다.

## 1. 준비물

- Node.js 20 이상
- npm
- Firebase 프로젝트
- Cloudflare 계정
- Wrangler 로그인 권한

## 2. 저장소 설치

```bash
npm install
```

## 3. Firebase 설정

Firebase Console에서 아래 작업을 진행합니다.

1. Firebase 프로젝트를 생성하거나 기존 프로젝트를 엽니다.
2. Authentication 메뉴로 이동합니다.
3. Sign-in method에서 Google 로그인을 활성화합니다.
4. Web App을 생성합니다.
5. Web App 설정값을 복사합니다.

설정 과정에서 아래 값을 입력해야 합니다.

```txt
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MESSAGING_SENDER_ID
```

배포 후에는 Firebase Authentication의 Authorized domains에 배포된 Worker 도메인도 추가해야 합니다.

## 4. Cloudflare 리소스 생성

Wrangler에 로그인합니다.

```bash
npx wrangler login
```

D1 데이터베이스를 생성합니다.

```bash
npx wrangler d1 create my-bookmark
```

R2 버킷을 생성합니다.

```bash
npx wrangler r2 bucket create my-bookmark-assets
```

D1 생성 결과에 표시되는 `database_id`를 복사해 둡니다. `npm run setup:ko` 실행 중 입력해야 합니다.

## 5. 설정 마법사 실행

한국어 안내로 실행하려면 아래 명령을 사용합니다.

```bash
npm run setup:ko
```

언어를 직접 선택하려면 아래 명령을 사용해도 됩니다.

```bash
npm run setup
```

설정 마법사는 아래 로컬 파일을 생성합니다.

```txt
.env
.dev.vars
wrangler.toml
```

이 파일들은 개인 Firebase/Cloudflare 설정을 담고 있으므로 git에 커밋되지 않도록 `.gitignore`에 포함되어 있습니다.

## 6. SESSION_SECRET 등록

설정 마법사는 로컬 개발용 `SESSION_SECRET`을 자동 생성합니다. 운영 배포에서도 같은 값을 Cloudflare Worker secret으로 등록합니다.

```bash
npx wrangler secret put SESSION_SECRET
```

Wrangler가 값을 물어보면 설정 마법사가 출력한 `SESSION_SECRET` 값을 붙여넣습니다.

## 7. 설정 검증

```bash
npm run setup:check
```

오류가 나오면 `.env`, `.dev.vars`, `wrangler.toml` 값을 확인합니다. `.dev.vars` 경고는 로컬 개발용 값이 비어 있을 때 표시될 수 있습니다.

## 8. 로컬 실행

```bash
npm run dev:api
```

Wrangler가 출력하는 로컬 주소를 열고 Google 로그인이 동작하는지 확인합니다.

## 9. 배포

```bash
npm run deploy
```

배포가 끝나면 Firebase Authentication의 Authorized domains에 배포된 Worker 도메인을 추가합니다.

예:

```txt
my-bookmark.<account>.workers.dev
```

## 10. 확장 프로그램 설정

앱의 다운로드 화면에서 확장 프로그램 zip을 설치합니다. 설치 후 확장 프로그램 옵션 화면에서 자신의 Worker URL을 입력합니다.

예:

```txt
https://my-bookmark.<account>.workers.dev
```

앱에서 확장 토큰을 생성한 뒤 자동 연결 기능을 사용할 수도 있습니다.

## 문제 해결

Google 로그인이 실패하면 Firebase Authorized domains와 `.env` 값을 확인합니다.

API 요청이 실패하면 `wrangler.toml`, `.dev.vars`, D1 migration 적용 여부를 확인합니다.

이미지 업로드가 실패하면 `wrangler.toml`의 R2 bucket 이름이 Cloudflare 계정에 실제로 존재하는지 확인합니다.
