// 선택사항: Firebase 없이 사내망 PC/서버에서 로컬 동기화 서버로 사용할 수 있는 예제입니다.
// 사용: node local-db-sync-server.js
// 접속: http://서버IP:8787/api/db

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8787;
const DB_FILE = path.join(__dirname, "led_db_server.json");
const clients = new Set();

function loadDb(){
  if(fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  return {schema:"ezledview-led-db-server", version:"empty", updatedAt:Date.now(), db:{}};
}
function saveDb(payload){
  payload.updatedAt = Date.now();
  fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), "utf8");
  broadcast(payload);
}
function broadcast(payload){
  const data = "event: db\n" + "data: " + JSON.stringify({updatedAt:payload.updatedAt,itemCount:Object.keys(payload.db||{}).length}) + "\n\n";
  for(const res of clients){ try{res.write(data);}catch(e){clients.delete(res);} }
}
function send(res, code, obj){
  res.writeHead(code, {"Content-Type":"application/json; charset=utf-8", "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"GET,POST,OPTIONS", "Access-Control-Allow-Headers":"Content-Type"});
  res.end(JSON.stringify(obj));
}

http.createServer((req,res)=>{
  if(req.method === "OPTIONS") return send(res, 200, {ok:true});
  if(req.url === "/api/health") return send(res, 200, {ok:true, service:"ezled-db-local-sync", port:PORT});
  if(req.url === "/api/db" && req.method === "GET") return send(res, 200, loadDb());
  if(req.url === "/api/db" && req.method === "POST"){
    let body="";
    req.on("data", d=> body += d);
    req.on("end", ()=>{
      try{
        const payload = JSON.parse(body);
        if(!payload.db) return send(res, 400, {ok:false, error:"db field required"});
        saveDb(payload);
        send(res, 200, {ok:true, itemCount:Object.keys(payload.db).length});
      }catch(e){ send(res, 400, {ok:false, error:e.message}); }
    });
    return;
  }
  if(req.url === "/api/stream"){
    res.writeHead(200, {"Content-Type":"text/event-stream; charset=utf-8", "Cache-Control":"no-cache", "Connection":"keep-alive", "Access-Control-Allow-Origin":"*"});
    clients.add(res);
    res.write("event: hello\ndata: {}\n\n");
    req.on("close", ()=>clients.delete(res));
    return;
  }
  send(res,404,{ok:false,error:"not found"});
}).listen(PORT, ()=>console.log("ezled local db sync server listening on", PORT));
