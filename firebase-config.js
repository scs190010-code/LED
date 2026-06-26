// ezledview Firebase Realtime Database 동기화 설정 파일 v1.2
// 사용법:
// 1) Firebase Console > Project Settings > Web App에서 firebaseConfig 값을 복사합니다.
// 2) 아래 YOUR_* 값을 실제 값으로 바꿉니다.
// 3) Realtime Database를 만들고 rules/realtime-database.rules.test.json 규칙을 붙여넣습니다.
// 4) Authentication > Sign-in method > Anonymous를 사용 설정합니다.
// 5) GitHub Pages에 업로드 후 index.html 또는 ezledview_PRO_v42_G2B_REALTIME_DB_SYNC_v1_2.html로 접속합니다.

window.EZLED_FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

window.EZLED_DB_SYNC_OPTIONS = {
  enabled: true,               // 실제 config 값이 들어가면 자동 연결됩니다. placeholder이면 LOCAL 모드 유지
  autoConnect: true,
  useAnonymousAuth: true,

  mode: "realtime-database",
  dbPath: "ezledview/databases/led_db_final_v4_0",
  auditPath: "ezledview/audit",

  localKey: "ezled_db_final_v4_0_g2b_rtdb_synced",
  publishOnAdminSave: true,    // DB관리 저장/삭제/엑셀업로드 후 자동 서버 반영
  serverWinsOnConnect: true,   // 서버 DB가 있으면 접속 시 서버값 우선
  seedIfServerEmpty: true,     // 서버가 비어 있으면 최종 조달 Seed 54개 자동 업로드
  requireConfirmText: "SYNC-DB"
};
