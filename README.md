# ezledview Static Pages Site

이 패키지는 `GitHub Pages` 또는 `Cloudflare Pages`에 그대로 업로드 가능한 완전 정적 사이트입니다.

## 포함 파일

- `index.html`  
  서버 없이 동작하는 NovaStar 유지보수 데모 시뮬레이션 화면입니다.
- `ezledview_full_v42.html`  
  기존 v42 전체 기능 보존 HTML입니다.
- `404.html`  
  GitHub Pages / Cloudflare Pages fallback.
- `_headers`  
  Cloudflare Pages용 기본 보안 헤더.
- `_redirects`  
  Cloudflare Pages용 SPA fallback.
- `.nojekyll`  
  GitHub Pages에서 정적 파일을 그대로 서빙하도록 하는 파일.
- `.github/workflows/deploy-github-pages.yml`  
  GitHub Actions 방식 자동 배포 워크플로우.

## GitHub Pages 배포 방법

### 가장 쉬운 방법
1. GitHub에서 새 repository를 만듭니다.
2. 이 폴더의 모든 파일을 업로드합니다.
3. Repository Settings → Pages로 이동합니다.
4. Source를 `Deploy from a branch`로 선택합니다.
5. Branch는 `main`, folder는 `/root`로 설정합니다.
6. 저장 후 표시되는 Pages URL로 접속합니다.

### GitHub Actions 방식
Repository Settings → Pages에서 Source를 `GitHub Actions`로 선택하면, 포함된 workflow가 `main` 브랜치 push 때 자동 배포합니다.

## Cloudflare Pages 배포 방법

### Direct Upload
1. Cloudflare Dashboard → Workers & Pages → Pages로 이동합니다.
2. Create application → Pages → Direct Upload를 선택합니다.
3. 이 폴더 전체를 업로드합니다.
4. 배포 후 발급된 `*.pages.dev` 주소로 접속합니다.

### Git 연동
1. 이 폴더를 GitHub repository에 올립니다.
2. Cloudflare Pages에서 Import an existing Git repository를 선택합니다.
3. Build command는 비워둡니다.
4. Build output directory는 `/` 또는 루트로 설정합니다.

## 주의

정적 사이트는 브라우저에서만 실행됩니다. 실제 NovaStar 장비 API, SNMP, Raw TCP/RS232 실연동은 브라우저 보안 정책상 별도 브리지 서버가 필요합니다. 이 패키지는 고객 시연·제안·데모·기능 설명용 정적 사이트입니다.
