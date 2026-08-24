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
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
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

app.get("/api/queue", (req,res)=>{
  const rows = readQueue().sort((a,b)=>a.id-b.id);
  const total = rows.reduce((s,r)=>s+Number(r.amount||0),0);
  res.json({rows,total});
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
  const status=String(req.body.status||"รอคิว");
  if(!name || !Number.isFinite(amount) || amount<0)
    return res.status(400).json({error:"ข้อมูลไม่ถูกต้อง"});
  const rows=readQueue();
  const now = new Date();
  const localIso = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString();
  const item={id:nextId(rows),name,amount,status,created_at:localIso};
  rows.push(item);
  writeQueue(rows);
  res.json({ok:true,id:item.id});
});

app.put("/api/queue/:id", adminOnly, (req,res)=>{
  const id=Number(req.params.id);
  const name=String(req.body.name||"").trim();
  const amount=Number(req.body.amount);
  const status=String(req.body.status||"รอคิว");
  if(!name || !Number.isFinite(amount) || amount<0)
    return res.status(400).json({error:"ข้อมูลไม่ถูกต้อง"});
  const rows=readQueue();
  const item=rows.find(r=>r.id===id);
  if(!item) return res.status(404).json({error:"ไม่พบคิว"});
  item.name=name; item.amount=amount; item.status=status;
  writeQueue(rows);
  res.json({ok:true});
});

app.delete("/api/queue/:id", adminOnly, (req,res)=>{
  const id=Number(req.params.id);
  const rows=readQueue().filter(r=>r.id!==id);
  writeQueue(rows);
  res.json({ok:true});
});

app.get("/api/me",(req,res)=>res.json({admin:!!req.session.admin}));

app.listen(PORT,()=>console.log(`Donate Queue running at http://localhost:${PORT}`));
