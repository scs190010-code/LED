# ezledview G2B DB Sync v1.1 STABLE

## 수정 원인
v1.0 패치 HTML은 동기화 스크립트가 `</script>`마다 반복 삽입되어 기존 JavaScript 내부에 `<script>` 태그가 끼어드는 문제가 있었습니다. 이 경우 브라우저가 HTML/JS를 정상 파싱하지 못해 화면이 깨지거나 로딩이 멈출 수 있습니다.

## v1.1 수정 방식
- 원본 `ezledview_PRO_v42_RESTORED_BASE_STANDBY.html`을 기준으로 재생성
- 동기화 스크립트는 `</body>` 바로 앞에 1회만 삽입
- 기존 3D/렌더링/DB관리/엑셀 업로드 기능은 건드리지 않음
- Firebase 설정 전에는 LOCAL 모드로 동작
- 최종 조달 DB 54개 seed 포함

## 업로드 파일
GitHub 저장소 루트에 아래 파일/폴더를 올리세요.

```
ezledview_PRO_v42_G2B_DB_SYNC_STABLE_v1_1.html
firebase-config.js
ezled-db-sync.js
data/
rules/
server/
```

## 사용 순서
1. GitHub Pages에서 `ezledview_PRO_v42_G2B_DB_SYNC_STABLE_v1_1.html` 실행
2. 브라우저에서 Ctrl+F5 강력 새로고침
3. 상단 `☁️ DB Sync: LOCAL` 버튼 확인
4. Firebase 설정 후 `firebase-config.js`의 enabled를 true로 변경
5. 서버 연결 후 `현재 DB 서버 반영` 또는 `최종 조달 Seed DB 적용`

## 주의
기존 v1.0 파일은 삭제하거나 사용하지 마세요. 같은 파일명으로 교체하는 경우 브라우저 캐시 때문에 깨진 파일이 계속 뜰 수 있으니 Ctrl+F5 또는 새 파일명으로 접속하세요.
