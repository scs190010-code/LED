/*
 ezledview DB Firebase Sync Patch v1.0
 - 기존 v42 HTML의 DEFAULT_DB/CURRENT_DB/localStorage 방식은 유지
 - DB관리 화면에서 수정하면 Firestore 서버에 반영
 - 다른 클라이언트는 Firestore onSnapshot으로 자동 동기화
 - GitHub Pages 같은 정적 호스팅에서도 동작
*/
(function(){
  "use strict";

  const VERSION = "ezled-db-sync-v1.0";
  const defaultOptions = {
    enabled: false,
    autoConnect: false,
    useAnonymousAuth: true,
    docPath: "ezledview/databases/led_db_final_v4_0",
    auditCollection: "ezledview_db_audit",
    localKey: "ezled_db_final_v4_0_g2b_synced",
    publishOnAdminSave: true,
    serverWinsOnConnect: true,
    seedIfServerEmpty: true,
    requireConfirmText: "SYNC-DB"
  };

  const options = Object.assign({}, defaultOptions, window.EZLED_DB_SYNC_OPTIONS || {});
  const clientId = localStorage.getItem("ezled_sync_client_id") || ("client-" + Math.random().toString(36).slice(2) + "-" + Date.now());
  localStorage.setItem("ezled_sync_client_id", clientId);

  const state = {
    connected: false,
    connecting: false,
    firebaseReady: false,
    db: null,
    docRef: null,
    unsubscribe: null,
    lastServerUpdatedAt: 0,
    lastLocalWriteAt: 0,
    suppressPublish: false,
    flushTimer: null,
    logs: []
  };

  function nowIso(){ return new Date().toISOString(); }
  function getItemCount(db){ return db && typeof db === "object" ? Object.keys(db).length : 0; }
  function log(msg, level){
    const line = "[" + new Date().toLocaleTimeString() + "] " + msg;
    state.logs.push(line);
    if(state.logs.length > 300) state.logs.shift();
    console[(level==="error" ? "error" : "log")]("[EZLED-SYNC]", msg);
    const box = document.getElementById("ezledSyncLog");
    if(box) box.textContent = state.logs.slice(-80).join("\n");
    updateBadge();
  }

  function updateBadge(){
    const badge = document.getElementById("ezledDbSyncBadge");
    if(!badge) return;
    if(state.connected){
      badge.textContent = "☁️ DB Sync: ONLINE";
      badge.style.color = "#86efac";
      badge.style.borderColor = "#10b981";
    }else if(state.connecting){
      badge.textContent = "☁️ DB Sync: CONNECTING";
      badge.style.color = "#fcd34d";
      badge.style.borderColor = "#f59e0b";
    }else{
      badge.textContent = "☁️ DB Sync: LOCAL";
      badge.style.color = "#cbd5e1";
      badge.style.borderColor = "#64748b";
    }
  }

  function safeCall(fnName){
    try{
      if(typeof window[fnName] === "function") return window[fnName]();
      // classic script function declarations may be global identifiers but not window props in some builds
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
      // CURRENT_DB is a top-level let in the original HTML; accessible as a global lexical binding.
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
    try { CURRENT_DB = JSON.parse(JSON.stringify(newDb)); } catch(e) { window.CURRENT_DB = JSON.parse(JSON.stringify(newDb)); }
    try{
      const key = (typeof DB_VERSION !== "undefined") ? DB_VERSION : options.localKey;
      localStorage.setItem(key, JSON.stringify(newDb));
    }catch(e){}
    localStorage.setItem(options.localKey, JSON.stringify(newDb));
    state.lastLocalWriteAt = Date.now();
    refreshUI();
    log(reason + " 적용 완료 · " + getItemCount(newDb) + "개 품목");
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

  async function ensureFirebase(){
    if(state.firebaseReady) return true;
    if(!window.EZLED_FIREBASE_CONFIG || !window.EZLED_FIREBASE_CONFIG.projectId || window.EZLED_FIREBASE_CONFIG.projectId === "YOUR_PROJECT_ID"){
      log("Firebase 설정이 없습니다. firebase-config.js를 먼저 설정하세요.", "error");
      return false;
    }
    await loadScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js");
    if(options.useAnonymousAuth) await loadScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js");

    if(!firebase.apps.length) firebase.initializeApp(window.EZLED_FIREBASE_CONFIG);
    if(options.useAnonymousAuth && firebase.auth){
      try { await firebase.auth().signInAnonymously(); }
      catch(e){ log("익명 로그인 실패: " + e.message, "error"); }
    }
    state.db = firebase.firestore();
    // 오프라인 캐시는 브라우저별 제한 때문에 실패할 수 있으므로 실패해도 무시
    try { await state.db.enablePersistence({synchronizeTabs:true}); } catch(e) {}
    state.docRef = state.db.doc(options.docPath);
    state.firebaseReady = true;
    return true;
  }

  function serverTimestamp(){
    try { return firebase.firestore.FieldValue.serverTimestamp(); } catch(e){ return new Date(); }
  }

  async function publishCurrentDb(reason, skipConfirm){
    if(!state.firebaseReady || !state.docRef){
      const ok = await connect();
      if(!ok) return false;
    }
    if(!skipConfirm && options.requireConfirmText){
      const txt = prompt("서버 DB에 현재 로컬 DB를 반영합니다.\n다른 클라이언트에도 즉시 동기화됩니다.\n확인 문구를 입력하세요: " + options.requireConfirmText);
      if(txt !== options.requireConfirmText){
        log("서버 반영 취소");
        return false;
      }
    }
    const db = getCurrentDb();
    const payload = {
      schema: "ezledview-led-db",
      version: "v4.0-g2b-procurement-final",
      itemCount: getItemCount(db),
      updatedAt: serverTimestamp(),
      updatedAtClient: Date.now(),
      updatedBy: clientId,
      reason: reason || "manual-publish",
      db: JSON.parse(JSON.stringify(db))
    };
    state.suppressPublish = true;
    await state.docRef.set(payload, {merge:false});
    if(options.auditCollection){
      try{
        await state.db.collection(options.auditCollection).add({
          type:"publish",
          docPath: options.docPath,
          itemCount: payload.itemCount,
          reason: payload.reason,
          clientId,
          createdAt: serverTimestamp(),
          createdAtClient: Date.now()
        });
      }catch(e){}
    }
    state.suppressPublish = false;
    log("서버 반영 완료 · " + payload.itemCount + "개 품목");
    return true;
  }

  async function pullServerDb(){
    if(!state.firebaseReady || !state.docRef){
      const ok = await connect();
      if(!ok) return false;
    }
    const snap = await state.docRef.get();
    if(!snap.exists){
      log("서버 DB 문서가 없습니다.");
      return false;
    }
    const data = snap.data();
    if(data && data.db){
      state.suppressPublish = true;
      setCurrentDb(data.db, "서버 DB 수동 불러오기");
      state.suppressPublish = false;
      return true;
    }
    return false;
  }

  async function connect(){
    if(state.connecting) return false;
    state.connecting = true; updateBadge();
    try{
      const ok = await ensureFirebase();
      if(!ok) return false;
      if(state.unsubscribe) { try{state.unsubscribe();}catch(e){} }
      const initial = await state.docRef.get();
      if(initial.exists && options.serverWinsOnConnect){
        const data = initial.data();
        if(data && data.db) setCurrentDb(data.db, "서버 DB");
      }else if(!initial.exists && options.seedIfServerEmpty){
        loadSeedDb(true);
        await publishCurrentDb("initial-seed", true);
      }

      state.unsubscribe = state.docRef.onSnapshot((snap)=>{
        if(!snap.exists) return;
        const data = snap.data();
        if(!data || !data.db) return;
        const remoteTime = data.updatedAtClient || 0;
        if(remoteTime && remoteTime === state.lastServerUpdatedAt) return;
        state.lastServerUpdatedAt = remoteTime;
        if(data.updatedBy === clientId) {
          log("내 변경사항 서버 확인 · " + (data.itemCount || getItemCount(data.db)) + "개");
          return;
        }
        state.suppressPublish = true;
        setCurrentDb(data.db, "다른 클라이언트 변경사항");
        state.suppressPublish = false;
      }, (err)=>{
        state.connected=false;
        log("실시간 동기화 오류: " + err.message, "error");
      });

      state.connected = true;
      log("Firebase 실시간 DB 동기화 연결 완료");
      return true;
    }catch(e){
      state.connected=false;
      log("Firebase 연결 실패: " + e.message, "error");
      return false;
    }finally{
      state.connecting=false; updateBadge();
    }
  }

  function schedulePublish(reason){
    if(!options.publishOnAdminSave || state.suppressPublish) return;
    if(!state.connected && !options.enabled) return;
    clearTimeout(state.flushTimer);
    state.flushTimer = setTimeout(()=>{
      publishCurrentDb(reason || "admin-save-auto", true).catch(e=>log("자동 서버반영 실패: "+e.message, "error"));
    }, 900);
  }

  function wrapFunction(name, reason){
    try{
      const original = eval("typeof " + name + "==='function' ? " + name + " : null");
      if(!original || original.__ezledSyncWrapped) return;
      const wrapped = function(){
        const ret = original.apply(this, arguments);
        setTimeout(()=>schedulePublish(reason || name), 600);
        return ret;
      };
      wrapped.__ezledSyncWrapped = true;
      eval(name + " = wrapped");
      log(name + " 동기화 후킹 완료");
    }catch(e){ console.warn("wrap failed", name, e); }
  }

  function installUI(){
    if(document.getElementById("ezledDbSyncBadge")) return;
    const group = document.querySelector(".export-group") || document.querySelector("header") || document.body;
    const badge = document.createElement("button");
    badge.id = "ezledDbSyncBadge";
    badge.className = "btn-export";
    badge.type = "button";
    badge.style.borderColor = "#64748b";
    badge.style.background = "#0f172a";
    badge.textContent = "☁️ DB Sync: LOCAL";
    badge.title = "서버 DB 동기화 패널 열기";
    badge.onclick = openSyncPanel;
    group.insertBefore(badge, group.firstChild);
    addAdminPanel();
    updateBadge();
  }

  function openSyncPanel(){
    const modal = document.getElementById("ezledSyncModal");
    if(modal) modal.classList.add("active");
  }

  function closeSyncPanel(){
    const modal = document.getElementById("ezledSyncModal");
    if(modal) modal.classList.remove("active");
  }

  function addAdminPanel(){
    if(document.getElementById("ezledSyncModal")) return;
    const style = document.createElement("style");
    style.textContent = `
      #ezledSyncModal{display:none;position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,.72);align-items:center;justify-content:center}
      #ezledSyncModal.active{display:flex}
      #ezledSyncModal .sync-box{width:min(760px,94vw);max-height:88vh;background:#0f172a;color:#e5e7eb;border:1px solid #334155;border-radius:12px;padding:18px;box-shadow:0 24px 70px rgba(0,0,0,.55);overflow:auto;font-family:Pretendard,Arial,sans-serif}
      #ezledSyncModal .sync-row{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
      #ezledSyncModal button{background:#1e293b;color:#fff;border:1px solid #475569;border-radius:6px;padding:8px 10px;font-weight:800;cursor:pointer}
      #ezledSyncModal button.green{background:#065f46;border-color:#10b981}
      #ezledSyncModal button.blue{background:#1d4ed8;border-color:#60a5fa}
      #ezledSyncModal button.yellow{background:#92400e;border-color:#f59e0b}
      #ezledSyncModal button.red{background:#7f1d1d;border-color:#ef4444}
      #ezledSyncLog{height:220px;overflow:auto;background:#020617;border:1px solid #334155;border-radius:8px;padding:10px;white-space:pre-wrap;font-size:12px;line-height:1.45}
      .ezled-sync-help{font-size:12px;color:#cbd5e1;line-height:1.55;background:#111827;border:1px solid #334155;border-radius:8px;padding:10px;margin-top:10px}
    `;
    document.head.appendChild(style);

    const modal = document.createElement("div");
    modal.id = "ezledSyncModal";
    modal.innerHTML = `
      <div class="sync-box">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid #334155;padding-bottom:10px;">
          <div>
            <div style="font-size:18px;font-weight:900;">☁️ ezledview DB 서버 동기화</div>
            <div style="font-size:12px;color:#94a3b8;">로컬 DB 수정 → Firebase 서버 반영 → 다른 클라이언트 실시간 갱신</div>
          </div>
          <button class="red" id="ezledSyncClose">닫기</button>
        </div>
        <div class="sync-row">
          <button class="blue" id="ezledSyncConnect">서버 연결</button>
          <button class="green" id="ezledSyncPublish">현재 DB 서버 반영</button>
          <button class="yellow" id="ezledSyncPull">서버 DB 불러오기</button>
          <button id="ezledSyncSeed">최종 조달 Seed DB 적용</button>
          <button id="ezledSyncExport">현재 DB JSON 백업</button>
        </div>
        <div class="ezled-sync-help">
          <b>현재 품목 수:</b> <span id="ezledSyncItemCount">-</span>개<br>
          <b>문서 경로:</b> <span id="ezledSyncDocPath"></span><br>
          <b>클라이언트:</b> <span id="ezledSyncClient"></span><br>
          Firebase 설정 전에는 LOCAL 모드로 동작합니다. 설정 후 서버 연결을 누르면 모든 접속자가 동일 DB를 받습니다.
        </div>
        <pre id="ezledSyncLog"></pre>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById("ezledSyncClose").onclick = closeSyncPanel;
    document.getElementById("ezledSyncConnect").onclick = ()=>connect();
    document.getElementById("ezledSyncPublish").onclick = ()=>publishCurrentDb("manual-publish", false);
    document.getElementById("ezledSyncPull").onclick = ()=>pullServerDb();
    document.getElementById("ezledSyncSeed").onclick = ()=>{ if(confirm("최종 조달 Seed DB 54개 품목을 현재 화면 DB로 적용할까요?")) loadSeedDb(true); };
    document.getElementById("ezledSyncExport").onclick = exportCurrentDbJson;
    document.getElementById("ezledSyncDocPath").textContent = options.docPath;
    document.getElementById("ezledSyncClient").textContent = clientId;
    setInterval(()=>{ const c=document.getElementById("ezledSyncItemCount"); if(c)c.textContent=getItemCount(getCurrentDb()); }, 1000);
  }

  function exportCurrentDbJson(){
    const payload = {
      schema:"ezledview-led-db-export",
      version:"manual-export",
      exportedAt:nowIso(),
      itemCount:getItemCount(getCurrentDb()),
      db:getCurrentDb()
    };
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download="ezledview_led_db_export_"+Date.now()+".json";
    a.click();
  }

  function boot(){
    installUI();
    // 최종 조달 DB를 기본값으로 적용하되, 이미 서버/로컬 동기화 캐시가 있으면 유지
    loadSeedDb(false);
    wrapFunction("addDBItem", "admin-save");
    wrapFunction("deleteDB", "admin-delete");
    wrapFunction("resetDB", "admin-reset");
    // 엑셀 업로드는 FileReader 비동기 완료 후 반영되므로 넉넉히 지연
    wrapFunction("uploadDBExcel", "excel-upload");
    if(options.enabled && options.autoConnect) setTimeout(()=>connect(), 1200);
    log(VERSION + " 준비 완료 · " + getItemCount(getCurrentDb()) + "개 품목");
  }

  window.EZLED_DB_SYNC = {
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

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, {once:true});
  else boot();
})();
