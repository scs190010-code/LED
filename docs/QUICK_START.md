# ezledview v1.3 GitHub + Firebase Realtime Database 배포 요약

## 구조

- `index.html` : NovaStar 유지보수 메인페이지
- `ledviewer.html` : LED Viewer / 조달 DB관리 / Realtime Database 동기화 페이지
- `firebase-config.js` : Firebase Web App 설정 입력 파일
- `ezled-db-sync-rtdb.js` : Firebase Realtime Database 동기화 모듈
- `data/led_db_final_v4_0.json` : 최종 조달 DB 54개 품목

## 접속 흐름

1. GitHub Pages 루트 주소 접속
2. NovaStar 유지보수 메인페이지 표시
3. 상단의 `LED Viewer 열기` 클릭
4. LED Viewer에서 DB관리/동기화 수행

## Firebase 설정

1. Authentication > Anonymous 사용 설정
2. Realtime Database 생성
3. `rules/realtime-database.rules.test.json` 적용
4. `firebase-config.js`에 Web App config와 `databaseURL` 입력

## GitHub Pages

Settings > Pages > Deploy from branch > main / root 저장.


---

# 초간단 배포 순서

1. 이 폴더 전체를 GitHub 저장소 루트에 업로드
2. Firebase Console에서 Realtime Database 생성
3. Authentication > Anonymous 켜기
4. Realtime Database > Rules에 `rules/realtime-database.rules.test.json` 붙여넣기
5. Firebase Web App 설정값을 `firebase-config.js`에 붙여넣기
6. GitHub Settings > Pages > Deploy from branch > main / root 저장
7. GitHub Pages 주소 접속
8. `⚡ RTDB Sync: ONLINE` 확인
9. DB관리에서 저장하면 다른 PC도 자동 동기화
