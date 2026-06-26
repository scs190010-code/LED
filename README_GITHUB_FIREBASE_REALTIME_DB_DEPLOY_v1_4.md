# ezledview v1.4 - NovaStar Staff Maintenance Portal + LED Viewer + Firebase Realtime DB

이번 패키지는 GitHub Pages 첫 화면을 **직원용 NovaStar 유지보수 포털**로 정리한 버전입니다.

## 변경 사항

- 메인페이지에서 Bridge URL, Device IP, Port 등 기술환경 셋팅 입력 영역 제거
- 잡다한 안내문 제거
- 회사 직원들이 바로 사용해볼 수 있는 **직원 테스트 공간** 추가
- 장애 유형 선택 드롭다운 추가
- 장애 유형별 영향, 점검 순서, 권장 조치, 보고문구 자동 생성
- NovaStar 유지보수 장점과 기술적 포인트를 간결하게 정리
- LED Viewer / 조달 DB관리 페이지로 이동 버튼 유지
- Firebase Realtime Database 동기화 파일 유지

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

## 메인 장애 유형

```text
정상 운영
화면 무출력 / 전체 Black
DATA 포트 통신 단절
특정 캐비닛 통신 불량
5V 전압 저하
후면 열 적체 / 고온 경고
수신카드 장애
컨트롤러 오프라인
SNMP Trap 알람
VMP/COEX 제어권 충돌
휘도/색상 편차
3상 전원 부하 불균형
```

## Firebase Realtime Database 경로

```text
ezledview/databases/led_db_final_v4_0
```

## 주의

`firebase-config.js`에는 실제 Firebase Web App 설정값과 `databaseURL`을 넣어야 ONLINE 동기화가 됩니다.
