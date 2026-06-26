// ezledview Firebase 동기화 설정 파일
// 1) Firebase 콘솔에서 Web App을 만든 뒤 firebaseConfig 값을 아래에 붙여 넣으세요.
// 2) Firestore Database를 생성하고, Authentication > Sign-in method에서 Anonymous 또는 Email 로그인을 활성화하세요.
// 3) 테스트 중에는 rules/firestore.rules.dev, 운영 시에는 rules/firestore.rules.prod를 참고하세요.

window.EZLED_FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

window.EZLED_DB_SYNC_OPTIONS = {
  enabled: false,              // Firebase 설정을 넣은 뒤 true로 변경
  autoConnect: true,           // 화면 로딩 시 서버 DB 자동 연결
  useAnonymousAuth: true,      // 테스트/사내 운영용. 운영 보안은 Email Auth 권장
  docPath: "ezledview/databases/led_db_final_v4_0",
  auditCollection: "ezledview_db_audit",
  localKey: "ezled_db_final_v4_0_g2b_synced",
  publishOnAdminSave: true,    // DB관리에서 저장/삭제/엑셀업로드 후 서버 자동반영
  serverWinsOnConnect: true,   // 접속 시 서버 DB가 있으면 서버 DB 우선
  seedIfServerEmpty: true,     // 서버 문서가 없으면 data/led_db_seed_v4_0.js의 최종 DB를 서버에 초기 등록
  requireConfirmText: "SYNC-DB" // 서버 반영 버튼 누를 때 확인 문구
};
