const q=document.getElementById("queue");
const count=document.getElementById("count");
const empty=document.getElementById("empty");
const loginModal=document.getElementById("loginModal");

if(loginModal) loginModal.classList.add("hidden");

async function load(){
  try{
    const d=await fetch("/api/queue",{cache:"no-store"}).then(r=>r.json());
    count.textContent=d.rows.length;
    empty.classList.toggle("hidden", d.rows.length!==0);

    // หายอดโดเนทสูงสุด เพื่อแสดง 👑 ให้คนที่ยอดสูงสุด
    const amounts=d.rows.map(r=>Number(r.amount)||0);
    const maxAmount=amounts.length ? Math.max(...amounts) : 0;

    // แสดงว่า "ตอนนี้ถึงคิวใคร" โดยยึดคิวที่มีสถานะกำลังทำเป็นหลัก
    // ถ้ายังไม่มีคิวกำลังทำ จะใช้คิวรอคิวตัวแรกเป็นคิวถัดไป
    const current = d.rows.find(r => r.status === "กำลังทำ") || d.rows.find(r => r.status === "รอคิว");
    const currentName = document.getElementById("currentTurnName");
    const currentInfo = document.getElementById("currentTurnInfo");
    const currentBtn = document.getElementById("currentTurnBtn");
    if (current) {
      const currentIndex = d.rows.findIndex(r => r.id === current.id);
      const stateText = current.status === "กำลังทำ" ? "กำลังทำอยู่ตอนนี้" : "คิวถัดไป";
      const currentLevel = Math.max(1, Math.floor((Number(current.amount)||0)/10));
      currentName.textContent = `${current.name || "ไม่ระบุชื่อ"} • คิวที่ ${currentIndex + 1}`;
      currentInfo.textContent = `${stateText} • ${fmt(Number(current.amount) || 0)} • ระดับคิว ${currentLevel}`;
      currentBtn.disabled = false;
      currentBtn.dataset.id = current.id;
      currentBtn.textContent = current.status === "กำลังทำ" ? "ไปยังคิวนี้ ↓" : "ดูคิวถัดไป ↓";
    } else {
      currentName.textContent = "ยังไม่มีคิว";
      currentInfo.textContent = "เมื่อมีโดเนทเข้ามา ระบบจะแสดงคิวที่ถึงทันที";
      currentBtn.disabled = true;
      currentBtn.removeAttribute("data-id");
      currentBtn.textContent = "ยังไม่มีคิว";
    }

    const rules = d.queueRules || {};
    const firstTurnAmount = Number(rules.firstTurnAmount) || 10;
    const maxAmountNow = Number(rules.maxAmount) || 0;
    const firstTurnAmountEl = document.getElementById("firstTurnAmount");
    const priorityRuleText = document.getElementById("priorityRuleText");
    const priorityExampleTitle = document.getElementById("priorityExampleTitle");
    const priorityExampleText = document.getElementById("priorityExampleText");

    if(firstTurnAmountEl) firstTurnAmountEl.textContent = `${fmt(firstTurnAmount)}`;
    if(priorityRuleText){
      priorityRuleText.textContent = maxAmountNow > 0
        ? `ตอนนี้ยอดสูงสุดที่อยู่ในคิวคือ ${fmt(maxAmountNow)} • ถ้าโดเนท ${fmt(firstTurnAmount)} ขึ้นไป จะขึ้นระดับใหม่และได้สิทธิ์ตาหน้า`
        : "ยังไม่มีคิว • ตาหน้าจะเริ่มที่ 10 บาท";
    }
    if(priorityExampleTitle) priorityExampleTitle.textContent = maxAmountNow > 0
      ? `ยอดสูงสุดตอนนี้ ${fmt(maxAmountNow)} → ตาหน้าต้องโดเนท ${fmt(firstTurnAmount)} ขึ้นไป`
      : "ตัวอย่าง: 10 บาท → 15 บาท";
    if(priorityExampleText) priorityExampleText.textContent = maxAmountNow > 0
      ? `ระบบจะขยับทีละ 10 บาทตามระดับคิว • ถ้ายอดสูงสุดเป็น ${fmt(maxAmountNow)} ตาหน้าคือ ${fmt(firstTurnAmount)}`
      : "ถ้ายอดอยู่ระดับเดียวกัน คนที่เข้าก่อนยังได้ก่อน • ตาหน้าจะคำนวณจากยอดสูงสุดในคิว";

    q.innerHTML=d.rows.map((r,i)=>{
      const amount=Number(r.amount)||0;
      const isTopDonor=maxAmount>0 && amount===maxAmount;
      return `
      <tr data-id="${esc(r.id)}" class="${isTopDonor?"top-donor":""}">
        <td data-label="คิว"><span class="queue-number ${i<3?"top":""}">${i+1}</span></td>
        <td data-label="ชื่อ">
          <div class="name-cell">
            <div class="mini-avatar">${esc((r.name||"?").slice(0,1).toUpperCase())}</div>
            <strong>${isTopDonor?'<span class="crown" title="ยอดโดเนทสูงสุด">👑</span> ':''}${esc(r.name)}</strong>
            ${isTopDonor?'<span class="top-donor-badge">ยอดสูงสุด</span>':''}
          </div>
        </td>
        <td data-label="โดเนท">
          <div class="amount-wrap">
            <strong class="amount">${fmt(amount)}</strong>
            <span class="priority-level">LV.${Math.max(1,Math.floor(amount/10))}</span>
          </div>
        </td>
        <td data-label="เพิ่มเมื่อ"><span class="time-chip">${formatDateTime(r.created_at)}</span></td>
        <td data-label="สถานะ"><span class="status ${statusClass(r.status)}"><i></i>${esc(r.status)}</span></td>
      </tr>`;
    }).join("");
    q.classList.remove("loading");
  }catch(e){
    q.innerHTML='<tr><td colspan="5" class="load-error">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง</td></tr>';
  }
}
function fmt(n){return new Intl.NumberFormat("th-TH",{maximumFractionDigits:2}).format(n)+" บาท"}
function statusClass(s){return s==="เสร็จแล้ว"?"done":s==="กำลังทำ"?"doing":"waiting"}
function formatDateTime(v){
  const d=new Date(v);
  if(Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH",{hour:"2-digit",minute:"2-digit",hour12:false,day:"2-digit",month:"2-digit"});
}
function updateClock(){
  const d=new Date();
  document.getElementById("clock").textContent=d.toLocaleTimeString("th-TH",{hour12:false});
  document.getElementById("date").textContent=d.toLocaleDateString("th-TH",{day:"numeric",month:"long",year:"numeric"});
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

document.getElementById("refresh").onclick=async()=>{
  const b=document.getElementById("refresh");
  b.disabled=true; b.classList.add("spinning");
  await load();
  setTimeout(()=>{b.disabled=false;b.classList.remove("spinning")},500);
};
document.getElementById("adminBtn").onclick=()=>loginModal.classList.remove("hidden");
document.querySelector("[data-close]").onclick=()=>loginModal.classList.add("hidden");
loginModal.addEventListener("click",e=>{if(e.target===loginModal)loginModal.classList.add("hidden")});
document.getElementById("login").onclick=async()=>{
  const password=document.getElementById("password").value;
  const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password})});
  if(r.ok) location.href="/admin.html";
  else document.getElementById("loginError").textContent="รหัสผ่านไม่ถูกต้อง";
};
document.getElementById("password").addEventListener("keydown",e=>{if(e.key==="Enter")document.getElementById("login").click()});
document.getElementById("currentTurnBtn").onclick=()=>{
  const id=document.getElementById("currentTurnBtn").dataset.id;
  if(!id) return;
  const row=[...document.querySelectorAll("#queue tr")].find(tr=>tr.dataset.id===id);
  if(row) row.scrollIntoView({behavior:"smooth",block:"center"});
};

updateClock(); setInterval(updateClock,1000);
load(); setInterval(load,10000);