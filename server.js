const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";
const DATA_FILE = path.join(__dirname, "queue.json");

function readQueue() {
  try {
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf8");
    const rows = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return Array.isArray(rows) ? rows.map(r => ({...r, uid: String(r.uid ?? "").trim()})) : [];
  } catch {
    return [];
  }
}
function writeQueue(rows) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(rows, null, 2), "utf8");
}
function nextId(rows) {
  return rows.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;
}

const adminHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret: process.env.SESSION_SECRET || "change-this-secret-before-publishing",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: false }
}));
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req,res)=>res.sendFile(path.join(__dirname, "public", "index.html")));

function adminOnly(req,res,next){
  if(!req.session.admin) return res.status(401).json({error:"กรุณาเข้าสู่ระบบแอดมิน"});
  next();
}

function priorityLevel(amount) {
  const value = Number(amount) || 0;
  if (value < 5) return 0;
  return Math.floor((value - 5) / 5) + 1;
}

function sortQueue(rows) {
  return [...rows].sort((a,b) => {
    const disqualifiedA = a.status === "ตัดสิทธิ์" ? 1 : 0;
    const disqualifiedB = b.status === "ตัดสิทธิ์" ? 1 : 0;
    if (disqualifiedA !== disqualifiedB) return disqualifiedA - disqualifiedB;

    const doingA = a.status === "กำลังทำ" ? 1 : 0;
    const doingB = b.status === "กำลังทำ" ? 1 : 0;
    if (doingA !== doingB) return doingB - doingA;

    const doneA = a.status === "เสร็จแล้ว" ? 1 : 0;
    const doneB = b.status === "เสร็จแล้ว" ? 1 : 0;
    if (doneA !== doneB) return doneA - doneB;

    const levelDiff = priorityLevel(b.amount) - priorityLevel(a.amount);
    if (levelDiff !== 0) return levelDiff;

    const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (Number.isFinite(timeDiff) && timeDiff !== 0) return timeDiff;
    return Number(a.id) - Number(b.id);
  });
}

app.get("/api/queue", (req,res)=>{
  const raw = readQueue();
  const rows = sortQueue(raw);
  const active = rows.filter(r => r.status !== "เสร็จแล้ว" && r.status !== "ตัดสิทธิ์");
  const maxAmount = active.length ? Math.max(...active.map(r => Number(r.amount)||0)) : 0;
  const maxLevel = active.length ? Math.max(...active.map(r => priorityLevel(r.amount))) : 0;
  const firstTurnAmount = active.length ? Math.max(20, maxAmount + 5) : 20;
  const firstTurnName = active.length ? active[0].name : "";
  const total = raw.reduce((s,r)=>s+Number(r.amount||0),0);
  res.json({
    rows,
    total,
    queueRules: {step:5,maxAmount,maxLevel,firstTurnAmount,firstTurnName}
  });
});

app.post("/api/login",(req,res)=>{
  const {password=""}=req.body;
  if(bcrypt.compareSync(password, adminHash)){
    req.session.admin=true;
    return res.json({ok:true});
  }
  res.status(401).json({error:"รหัสผ่านไม่ถูกต้อง"});
});

app.post("/api/logout", adminOnly, (req,res)=>{
  req.session.destroy(()=>res.json({ok:true}));
});

app.post("/api/queue", adminOnly, (req,res)=>{
  const name=String(req.body.name||"").trim();
  const amount=Number(req.body.amount);
  const uid=String(req.body.uid||"").trim();
  const status=String(req.body.status||"รอคิว");
  if(!name || !uid || !Number.isFinite(amount) || amount<20 || Math.abs((amount-20)%5)>0.000001)
    return res.status(400).json({error:"ยอดจองคิวขั้นต่ำ 20 บาท และต้องเพิ่มทีละ 5 บาท"});
  const rows=readQueue();
  const now = new Date();
  const localIso = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString();
  const item={id:nextId(rows),name,uid,amount,status,priority_level:priorityLevel(amount),created_at:localIso};
  rows.push(item);
  writeQueue(rows);
  res.json({ok:true,id:item.id});
});

app.put("/api/queue/:id", adminOnly, (req,res)=>{
  const id=Number(req.params.id);
  const name=String(req.body.name||"").trim();
  const amount=Number(req.body.amount);
  const uid=String(req.body.uid||"").trim();
  const status=String(req.body.status||"รอคิว");
  if(!name || !uid || !Number.isFinite(amount) || amount<20 || Math.abs((amount-20)%5)>0.000001)
    return res.status(400).json({error:"ยอดจองคิวขั้นต่ำ 20 บาท และต้องเพิ่มทีละ 5 บาท"});
  const rows=readQueue();
  const item=rows.find(r=>r.id===id);
  if(!item) return res.status(404).json({error:"ไม่พบคิว"});
  item.name=name; item.uid=uid; item.amount=amount; item.status=status; item.priority_level=priorityLevel(amount);
  writeQueue(rows);
  res.json({ok:true});
});

app.put("/api/queue/:id/uid", adminOnly, (req,res)=>{
  const id=Number(req.params.id);
  const uid=String(req.body.uid ?? "").trim();
  if(!uid) return res.status(400).json({error:"กรุณากรอก UID"});
  const rows=readQueue();
  const item=rows.find(r=>r.id===id);
  if(!item) return res.status(404).json({error:"ไม่พบคิว"});
  item.uid=uid;
  writeQueue(rows);
  res.json({ok:true,uid:item.uid});
});

app.delete("/api/queue/:id", adminOnly, (req,res)=>{
  const id=Number(req.params.id);
  const rows=readQueue().filter(r=>r.id!==id);
  writeQueue(rows);
  res.json({ok:true});
});

app.get("/api/me",(req,res)=>res.json({admin:!!req.session.admin}));

app.listen(PORT,()=>console.log(`Donate Queue running at http://localhost:${PORT}`));
