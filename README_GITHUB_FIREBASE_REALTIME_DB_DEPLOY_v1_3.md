# ezledview v1.3 - NovaStar Main + LED Viewer + Firebase Realtime DB

이번 패키지는 GitHub Pages 첫 화면을 NovaStar 유지보수 메인페이지로 복구한 버전입니다.

## 핵심 변경

- `index.html`을 자동 리다이렉트가 아닌 NovaStar 유지보수 메인페이지로 변경
- 메인페이지에서 `LED Viewer 열기` 버튼으로 `ledviewer.html` 이동
- LED Viewer 화면 상단에 `NovaStar 메인` 복귀 버튼 추가
- Firebase Realtime Database 동기화 파일 유지
- 최종 조달 DB 54개 품목 유지

## GitHub에 올릴 파일

저장소 루트에 아래 구조 그대로 올리세요.

```text
index.html
novastar_maintenance_main.html
ledviewer.html
viewer.html
ezledview_PRO_v42_G2B_REALTIME_DB_SYNC_v1_3.html
firebase-config.js
ezled-db-sync-rtdb.js
data/
rules/
docs/
.nojekyll
```

## 접속 방식

- 메인: `https://계정명.github.io/저장소명/`
- LED Viewer: `https://계정명.github.io/저장소명/ledviewer.html`

## Firebase Realtime Database 경로

```text
ezledview/databases/led_db_final_v4_0
```

## 주의

`firebase-config.js`에는 실제 Firebase Web App 설정값과 `databaseURL`을 넣어야 ONLINE 동기화가 됩니다.
