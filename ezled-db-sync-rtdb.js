/*
 ezledview DB Firebase Realtime Database Sync Patch v1.2
 - GitHub Pages 정적 배포 + Firebase Realtime Database JSON 동기화
 - 기존 v42 HTML의 DEFAULT_DB/CURRENT_DB/localStorage 방식 유지
 - DB관리 화면에서 수정하면 RTDB 서버에 반영
 - 다른 클라이언트는 RTDB on('value')로 자동 동기화
*/
(function(){
  "use strict";

  const VERSION = "ezled-db-sync-rtdb-v1.2";
  const defaultOptions = {
    enabled: false,
    autoConnect: false,
    useAnonymousAuth: true,
    mode: "realtime-database",
    dbPath: "ezledview/databases/led_db_final_v4_0",
    auditPath: "ezledview/audit",
    localKey: "ezled_db_final_v4_0_g2b_rtdb_synced",
    publishOnAdminSave: true,
    serverWinsOnConnect: true,
    seedIfServerEmpty: true,
    requireConfirmText: "SYNC-DB"
  };

  const options = Object.assign({}, defaultOptions, window.EZLED_DB_SYNC_OPTIONS || {});
  const clientId = localStorage.getItem("ezled_rtdb_client_id") || ("client-" + Math.random().toString(36).slice(2) + "-" + Date.now());
  localStorage.setItem("ezled_rtdb_client_id", clientId);

  const state = {
    connected: false,
    connecting: false,
    firebaseReady: false,
    db: null,
    dbRef: null,
    auditRef: null,
    authUser: null,
    lastServerUpdatedAt: 0,
    suppressApply: false,
    flushTimer: null,
    logs: []
  };

  function nowIso(){ return new Date().toISOString(); }
  function getItemCount(db){ return db && typeof db === "object" ? Object.keys(db).length : 0; }
  function log(msg, level){
    const line = "[" + new Date().toLocaleTimeString() + "] " + msg;
    state.logs.push(line);
    if(state.logs.length > 300) state.logs.shift();
    console[(level === "error" ? "error" : "log")]("[EZLED-RTDB]", msg);
    const box = document.getElementById("ezledRtdbSyncLog");
    if(box) box.textContent = state.logs.slice(-90).join("\n");
    updateBadge();
  }

  function updateBadge(){
    const badge = document.getElementById("ezledRtdbSyncBadge");
    if(!badge) return;
    if(state.connected){
      badge.textContent = "⚡ RTDB Sync: ONLINE";
      badge.style.color = "#86efac";
      badge.style.borderColor = "#10b981";
    }else if(state.connecting){
      badge.textContent = "⚡ RTDB Sync: CONNECTING";
      badge.style.color = "#fcd34d";
      badge.style.borderColor = "#f59e0b";
    }else{
      badge.textContent = "⚡ RTDB Sync: LOCAL";
      badge.style.color = "#cbd5e1";
      badge.style.borderColor = "#64748b";
    }
  }

  function safeCall(fnName){
    try{
      if(typeof window[fnName] === "function") return window[fnName]();
      return eval("typeof " + fnName + "==='function' ? " + fnName + "() : undefined");
    }catch(e){ console.warn("safeCall failed", fnName, e); }
  }

  function refreshUI(){
    try { safeCall("updateSelect"); } catch(e){}
    try { safeCall("renderAdmin"); } catch(e){}
    try { safeCall("buildWall"); } catch(e){}
  }

  function getCurrentDb(){
    try{
      if(typeof CURRENT_DB !== "undefined" && CURRENT_DB && Object.keys(CURRENT_DB).length) return CURRENT_DB;
    }catch(e){}
    try{
      const key = (typeof DB_VERSION !== "undefined") ? DB_VERSION : options.localKey;
      const raw = localStorage.getItem(key) || localStorage.getItem(options.localKey);
      if(raw) return JSON.parse(raw);
    }catch(e){}
    if(window.EZLED_SEED_DB && window.EZLED_SEED_DB.db) return window.EZLED_SEED_DB.db;
    return {};
  }

  function setCurrentDb(newDb, reason){
    if(!newDb || typeof newDb !== "object") return;
    const clone = JSON.parse(JSON.stringify(newDb));
    try { CURRENT_DB = clone; } catch(e) { window.CURRENT_DB = clone; }
    try{
      const key = (typeof DB_VERSION !== "undefined") ? DB_VERSION : options.localKey;
      localStorage.setItem(key, JSON.stringify(clone));
    }catch(e){}
    localStorage.setItem(options.localKey, JSON.stringify(clone));
    refreshUI();
    log((reason || "DB") + " 적용 완료 · " + getItemCount(clone) + "개 품목");
  }

  function loadSeedDb(force){
    const localRaw = localStorage.getItem(options.localKey);
    if(localRaw && !force){
      try{
        setCurrentDb(JSON.parse(localRaw), "로컬 캐시 DB");
        return true;
      }catch(e){}
    }
    if(window.EZLED_SEED_DB && window.EZLED_SEED_DB.db){
      setCurrentDb(window.EZLED_SEED_DB.db, "최종 조달 Seed DB");
      return true;
    }
    log("Seed DB를 찾지 못했습니다.", "error");
    return false;
  }

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      if(document.querySelector("script[src='"+src+"']")) return resolve();
      const s=document.createElement("script");
      s.src=src;
      s.async=true;
      s.onload=resolve;
      s.onerror=()=>reject(new Error("script load failed: "+src));
      document.head.appendChild(s);
    });
  }

  function hasFirebaseConfig(){
    const c = window.EZLED_FIREBASE_CONFIG || {};
    return !!(c.apiKey && c.projectId && c.databaseURL && c.projectId !== "YOUR_PROJECT_ID" && !String(c.databaseURL).includes("YOUR_PROJECT_ID"));
  }

  async function ensureFirebase(){
    if(state.firebaseReady) return true;
    if(!hasFirebaseConfig()){
      log("Firebase Realtime Database 설정이 없습니다. firebase-config.js 값을 먼저 넣으세요.", "error");
      return false;
    }
    await loadScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js");
    if(options.useAnonymousAuth) await loadScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js");

    if(!firebase.apps.length) firebase.initializeApp(window.EZLED_FIREBASE_CONFIG);

    if(options.useAnonymousAuth && firebase.auth){
      try {
        const cred = await firebase.auth().signInAnonymously();
        state.authUser = cred.user || (firebase.auth().currentUser || null);
      } catch(e){
        log("익명 로그인 실패: " + e.message, "error");
        return false;
      }
    }

    state.db = firebase.database();
    state.dbRef = state.db.ref(options.dbPath);
    state.auditRef = state.db.ref(options.auditPath);
    state.firebaseReady = true;
    return true;
  }

  function makePayload(reason){
    const db = getCurrentDb();
    return {
      schema: "ezledview-led-db",
      version: "v4.0-g2b-procurement-final",
      itemCount: getItemCount(db),
      updatedAt: nowIso(),
      updatedAtClient: Date.now(),
      updatedBy: (state.authUser && state.authUser.uid) ? state.authUser.uid : clientId,
      clientId: clientId,
      reason: reason || "manual-publish",
      db: JSON.parse(JSON.stringify(db))
    };
  }

  async function publishCurrentDb(reason, skipConfirm){
    if(!state.firebaseReady || !state.dbRef){
      const ok = await connect();
      if(!ok) return false;
    }
    if(!skipConfirm && options.requireConfirmText){
      const txt = prompt("Realtime Database 서버에 현재 로컬 DB를 반영합니다.\n다른 클라이언트에도 즉시 동기화됩니다.\n확인 문구를 입력하세요: " + options.requireConfirmText);
      if(txt !== options.requireConfirmText){
        log("서버 반영 취소");
        return false;
      }
    }
    const payload = makePayload(reason);
    await state.dbRef.set(payload);
    if(state.auditRef){
      try{
        await state.auditRef.push({
          type:"publish",
          dbPath: options.dbPath,
          itemCount: payload.itemCount,
          reason: payload.reason,
          clientId: payload.clientId,
          uid: payload.updatedBy,
          createdAt: nowIso(),
          createdAtClient: Date.now()
        });
      }catch(e){ console.warn("audit write failed", e); }
    }
    state.lastServerUpdatedAt = payload.updatedAtClient;
    log("Realtime Database 서버 반영 완료 · " + payload.itemCount + "개 품목");
    return true;
  }

  async function pullServerDb(){
    if(!state.firebaseReady || !state.dbRef){
      const ok = await connect();
      if(!ok) return false;
    }
    const snap = await state.dbRef.once("value");
    const data = snap.val();
    if(!data || !data.db){
      log("서버 DB가 비어 있습니다.");
      return false;
    }
    state.suppressApply = true;
    setCurrentDb(data.db, "서버 DB 수동 불러오기");
    state.suppressApply = false;
    state.lastServerUpdatedAt = data.updatedAtClient || Date.now();
    return true;
  }

  async function connect(){
    if(state.connecting) return false;
    state.connecting = true; updateBadge();
    try{
      const ok = await ensureFirebase();
      if(!ok) return false;

      const initial = await state.dbRef.once("value");
      const initialData = initial.val();
      if(initialData && initialData.db && options.serverWinsOnConnect){
        setCurrentDb(initialData.db, "서버 DB");
        state.lastServerUpdatedAt = initialData.updatedAtClient || Date.now();
      }else if((!initialData || !initialData.db) && options.seedIfServerEmpty){
        loadSeedDb(true);
        await publishCurrentDb("initial-seed", true);
      }

      state.dbRef.off("value");
      state.dbRef.on("value", (snap)=>{
        const data = snap.val();
        if(!data || !data.db) return;
        const remoteTime = data.updatedAtClient || 0;
        if(remoteTime && remoteTime === state.lastServerUpdatedAt) return;
        state.lastServerUpdatedAt = remoteTime;
        if(data.clientId === clientId){
          log("내 변경사항 서버 확인 · " + (data.itemCount || getItemCount(data.db)) + "개");
          return;
        }
        if(state.suppressApply) return;
        state.suppressApply = true;
        setCurrentDb(data.db, "다른 클라이언트 변경사항");
        state.suppressApply = false;
      }, (err)=>{
        state.connected=false;
        log("Realtime Database 수신 오류: " + err.message, "error");
      });

      state.connected = true;
      log("Firebase Realtime Database 동기화 연결 완료");
      return true;
    }catch(e){
      state.connected=false;
      log("Firebase RTDB 연결 실패: " + e.message, "error");
      return false;
    }finally{
      state.connecting=false; updateBadge();
    }
  }

  function schedulePublish(reason){
    if(!options.publishOnAdminSave || state.suppressApply) return;
    if(!state.connected && !options.enabled) return;
    clearTimeout(state.flushTimer);
    state.flushTimer = setTimeout(()=>{
      publishCurrentDb(reason || "admin-save-auto", true).catch(e=>log("자동 서버반영 실패: "+e.message, "error"));
    }, 900);
  }

  function wrapFunction(name, reason){
    try{
      const original = eval("typeof " + name + "==='function' ? " + name + " : null");
      if(!original || original.__ezledRtdbWrapped) return;
      const wrapped = function(){
        const ret = original.apply(this, arguments);
        setTimeout(()=>schedulePublish(reason || name), 700);
        return ret;
      };
      wrapped.__ezledRtdbWrapped = true;
      eval(name + " = wrapped");
      log(name + " RTDB 동기화 후킹 완료");
    }catch(e){ console.warn("wrap failed", name, e); }
  }

  function installUI(){
    if(document.getElementById("ezledRtdbSyncBadge")) return;
    const group = document.querySelector(".export-group") || document.querySelector("header") || document.body;
    const badge = document.createElement("button");
    badge.id = "ezledRtdbSyncBadge";
    badge.className = "btn-export";
    badge.type = "button";
    badge.style.borderColor = "#64748b";
    badge.style.background = "#0f172a";
    badge.textContent = "⚡ RTDB Sync: LOCAL";
    badge.title = "Realtime Database 동기화 패널 열기";
    badge.onclick = openSyncPanel;
    group.insertBefore(badge, group.firstChild);
    addAdminPanel();
    updateBadge();
  }

  function openSyncPanel(){
    const modal = document.getElementById("ezledRtdbSyncModal");
    if(modal) modal.classList.add("active");
  }

  function closeSyncPanel(){
    const modal = document.getElementById("ezledRtdbSyncModal");
    if(modal) modal.classList.remove("active");
  }

  function addAdminPanel(){
    if(document.getElementById("ezledRtdbSyncModal")) return;
    const style = document.createElement("style");
    style.textContent = `
      #ezledRtdbSyncModal{display:none;position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,.72);align-items:center;justify-content:center}
      #ezledRtdbSyncModal.active{display:flex}
      #ezledRtdbSyncModal .sync-box{width:min(800px,94vw);max-height:88vh;background:#0f172a;color:#e5e7eb;border:1px solid #334155;border-radius:12px;padding:18px;box-shadow:0 24px 70px rgba(0,0,0,.55);overflow:auto;font-family:Pretendard,Arial,sans-serif}
      #ezledRtdbSyncModal .sync-row{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
      #ezledRtdbSyncModal button{background:#1e293b;color:#fff;border:1px solid #475569;border-radius:6px;padding:8px 10px;font-weight:800;cursor:pointer}
      #ezledRtdbSyncModal button.green{background:#065f46;border-color:#10b981}
      #ezledRtdbSyncModal button.blue{background:#1d4ed8;border-color:#60a5fa}
      #ezledRtdbSyncModal button.yellow{background:#92400e;border-color:#f59e0b}
      #ezledRtdbSyncModal button.red{background:#7f1d1d;border-color:#ef4444}
      #ezledRtdbSyncLog{height:230px;overflow:auto;background:#020617;border:1px solid #334155;border-radius:8px;padding:10px;white-space:pre-wrap;font-size:12px;line-height:1.45}
      .ezled-rtdb-help{font-size:12px;color:#cbd5e1;line-height:1.55;background:#111827;border:1px solid #334155;border-radius:8px;padding:10px;margin-top:10px}
    `;
    document.head.appendChild(style);

    const modal = document.createElement("div");
    modal.id = "ezledRtdbSyncModal";
    modal.innerHTML = `
      <div class="sync-box">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid #334155;padding-bottom:10px;">
          <div>
            <div style="font-size:18px;font-weight:900;">⚡ ezledview Realtime Database 동기화</div>
            <div style="font-size:12px;color:#94a3b8;">GitHub 화면 · Firebase Realtime Database JSON DB · 클라이언트 자동 동기화</div>
          </div>
          <button class="red" id="ezledRtdbSyncClose">닫기</button>
        </div>
        <div class="sync-row">
          <button class="blue" id="ezledRtdbSyncConnect">서버 연결</button>
          <button class="green" id="ezledRtdbSyncPublish">현재 DB 서버 반영</button>
          <button class="yellow" id="ezledRtdbSyncPull">서버 DB 불러오기</button>
          <button id="ezledRtdbSyncSeed">최종 조달 Seed DB 적용</button>
          <button id="ezledRtdbSyncExport">현재 DB JSON 백업</button>
        </div>
        <div class="ezled-rtdb-help">
          <b>현재 품목 수:</b> <span id="ezledRtdbSyncItemCount">-</span>개<br>
          <b>RTDB 경로:</b> <span id="ezledRtdbSyncDbPath"></span><br>
          <b>Audit 경로:</b> <span id="ezledRtdbSyncAuditPath"></span><br>
          <b>클라이언트:</b> <span id="ezledRtdbSyncClient"></span><br>
          Firebase 설정 전에는 LOCAL 모드입니다. Realtime Database 설정 후 ONLINE이 되면 모든 접속자가 동일 DB를 받습니다.
        </div>
        <pre id="ezledRtdbSyncLog"></pre>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById("ezledRtdbSyncClose").onclick = closeSyncPanel;
    document.getElementById("ezledRtdbSyncConnect").onclick = ()=>connect();
    document.getElementById("ezledRtdbSyncPublish").onclick = ()=>publishCurrentDb("manual-publish", false);
    document.getElementById("ezledRtdbSyncPull").onclick = ()=>pullServerDb();
    document.getElementById("ezledRtdbSyncSeed").onclick = ()=>{ if(confirm("최종 조달 Seed DB 54개 품목을 현재 화면 DB로 적용할까요?")) loadSeedDb(true); };
    document.getElementById("ezledRtdbSyncExport").onclick = exportCurrentDbJson;
    document.getElementById("ezledRtdbSyncDbPath").textContent = options.dbPath;
    document.getElementById("ezledRtdbSyncAuditPath").textContent = options.auditPath;
    document.getElementById("ezledRtdbSyncClient").textContent = clientId;
    setInterval(()=>{ const c=document.getElementById("ezledRtdbSyncItemCount"); if(c)c.textContent=getItemCount(getCurrentDb()); }, 1000);
  }

  function exportCurrentDbJson(){
    const payload = {
      schema:"ezledview-led-db-export",
      version:"manual-export-rtdb",
      exportedAt:nowIso(),
      itemCount:getItemCount(getCurrentDb()),
      db:getCurrentDb()
    };
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download="ezledview_led_db_rtdb_export_"+Date.now()+".json";
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  function boot(){
    installUI();
    loadSeedDb(false);
    wrapFunction("addDBItem", "admin-save");
    wrapFunction("deleteDB", "admin-delete");
    wrapFunction("resetDB", "admin-reset");
    wrapFunction("uploadDBExcel", "excel-upload");
    if(options.enabled && options.autoConnect) setTimeout(()=>connect(), 1200);
    log(VERSION + " 준비 완료 · " + getItemCount(getCurrentDb()) + "개 품목");
  }

  window.EZLED_RTDB_SYNC = {
    version: VERSION,
    connect,
    publishCurrentDb,
    pullServerDb,
    loadSeedDb,
    getCurrentDb,
    setCurrentDb,
    options,
    state
  };

  // 과거 Firestore 패널명과 호환용 별칭
  window.EZLED_DB_SYNC = window.EZLED_RTDB_SYNC;

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, {once:true});
  else boot();
})();
