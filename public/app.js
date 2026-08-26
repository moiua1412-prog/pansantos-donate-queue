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

    // เรียงยอดโดเนทจากมาก -> น้อย และถ้ายอดเท่ากันให้คนที่เข้าก่อนอยู่ก่อน
    const rows=[...d.rows].sort((a,b)=>{
      const doneA=a.status==="เสร็จแล้ว"?1:0;
      const doneB=b.status==="เสร็จแล้ว"?1:0;
      if(doneA!==doneB) return doneA-doneB;
      const amountDiff=(Number(b.amount)||0)-(Number(a.amount)||0);
      if(amountDiff!==0) return amountDiff;
      const ta=new Date(a.created_at).getTime(), tb=new Date(b.created_at).getTime();
      if(Number.isFinite(ta)&&Number.isFinite(tb)&&ta!==tb) return ta-tb;
      return Number(a.id)-Number(b.id);
    });

    const active=rows.filter(r=>r.status!=="เสร็จแล้ว" && r.status!=="ตัดสิทธิ์");
    const maxAmount=active.length?Math.max(...active.map(r=>Number(r.amount)||0)):0;
    const nextTurn=maxAmount>0?Math.max(20,maxAmount+5):20;

    // แสดง "ตอนนี้ถึงคิวใคร" = คนอันดับ 1 ที่ยังไม่เสร็จ
    const current=active[0];
    const currentName=document.getElementById("currentTurnName");
    const currentInfo=document.getElementById("currentTurnInfo");
    const currentBtn=document.getElementById("currentTurnBtn");
    if(current){
      const currentIndex=rows.findIndex(r=>r.id===current.id);
      currentName.textContent=`${current.name||"ไม่ระบุชื่อ"} • อันดับ ${currentIndex+1}`;
      currentInfo.textContent=`ยอดโดเนท ${fmt(Number(current.amount)||0)} • ${current.status==="กำลังทำ"?"กำลังทำอยู่ตอนนี้":"คิวสูงสุดตอนนี้"}`;
      currentBtn.disabled=false;
      currentBtn.dataset.id=current.id;
      currentBtn.textContent="ไปยังคิวนี้ ↓";
    }else{
      currentName.textContent="ยังไม่มีคิว";
      currentInfo.textContent="เมื่อมีคิว ระบบจะแสดงคนที่ยอดสูงสุดให้อัตโนมัติ";
      currentBtn.disabled=true;
      currentBtn.removeAttribute("data-id");
      currentBtn.textContent="ยังไม่มีคิว";
    }

    const firstTurnAmountEl=document.getElementById("firstTurnAmount");
    const priorityRuleText=document.getElementById("priorityRuleText");
    const priorityExampleTitle=document.getElementById("priorityExampleTitle");
    const priorityExampleText=document.getElementById("priorityExampleText");

    if(firstTurnAmountEl) firstTurnAmountEl.textContent=fmt(nextTurn);
    if(priorityRuleText){
      priorityRuleText.textContent=maxAmount>0
        ? `ยอดสูงสุดตอนนี้ ${fmt(maxAmount)} → ตาหน้า ${fmt(nextTurn)}`
        : "ยังไม่มีคิว → ตาหน้าเริ่มที่ 20 บาท";
    }
    if(priorityExampleTitle){
      priorityExampleTitle.textContent=maxAmount>0
        ? `โด ${fmt(maxAmount)} → ตาหน้า ${fmt(nextTurn)}`
        : "ตัวอย่าง: ยอดจองคิว 20 บาท → ตาหน้า 25 บาท";
    }
    if(priorityExampleText){
      priorityExampleText.textContent=maxAmount>0
        ? `คนที่โดเนทสูงสุดจะอยู่ที่อันดับ 1 • ต้องโดเพิ่มอีก 5 บาทเพื่อได้ตาหน้า`
        : "ระบบจะคำนวณจากยอดโดเนทสูงสุดในคิวให้อัตโนมัติ";
    }

    q.innerHTML=rows.map((r,i)=>{
      const amount=Number(r.amount)||0;
      const isTopDonor=maxAmount>0 && amount===maxAmount && r.status!=="เสร็จแล้ว";
      const level=amount>=5?Math.floor((amount-5)/5)+1:0;
      return `
      <tr data-id="${esc(r.id)}" class="${isTopDonor?"top-donor":""}">
        <td data-label="คิว"><span class="queue-number ${i<3?"top":""}">${i+1}</span></td>
        <td data-label="ชื่อ">
          <div class="name-cell">
            <div class="mini-avatar">${esc((r.name||"?").slice(0,1).toUpperCase())}</div>
            <strong>${isTopDonor?'<span class="crown" title="ยอดโดเนทสูงสุด">👑</span> ':''}${esc(r.name)}</strong>
            ${isTopDonor?'<span class="top-donor-badge">อันดับ 1 • ยอดสูงสุด</span>':''}
          </div>
        </td>
        <td data-label="UID"><span class="uid-chip">${esc(r.uid||"-")}</span></td>
        <td data-label="โดเนท"><strong class="amount">${fmt(amount)}</strong></td>
        <td data-label="ระดับคิว"><span class="level-badge">LV.${level}</span></td>
        <td data-label="เพิ่มเมื่อ"><span class="time-chip">${formatDateTime(r.created_at)}</span></td>
        <td data-label="สถานะ"><span class="status ${statusClass(r.status)}"><i></i>${esc(r.status)}</span></td>
      </tr>`;
    }).join("");
    q.classList.remove("loading");
  }catch(e){
    q.innerHTML='<tr><td colspan="7" class="load-error">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง</td></tr>';
  }
}
function fmt(n){return new Intl.NumberFormat("th-TH",{maximumFractionDigits:2}).format(n)+" บาท"}
function statusClass(s){return s==="เสร็จแล้ว"?"done":s==="ตัดสิทธิ์"?"disqualified":s==="กำลังทำ"?"doing":"waiting"}
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