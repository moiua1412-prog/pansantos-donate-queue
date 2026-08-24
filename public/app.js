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
    q.innerHTML=d.rows.map((r,i)=>`
      <tr>
        <td><span class="queue-number ${i<3?"top":""}">${i+1}</span></td>
        <td>
          <div class="name-cell">
            <div class="mini-avatar">${esc((r.name||"?").slice(0,1).toUpperCase())}</div>
            <strong>${esc(r.name)}</strong>
          </div>
        </td>
        <td><strong class="amount">${fmt(r.amount)}</strong></td>
        <td><span class="time-chip">${formatDateTime(r.created_at)}</span></td>
        <td><span class="status ${statusClass(r.status)}"><i></i>${esc(r.status)}</span></td>
      </tr>`).join("");
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
updateClock(); setInterval(updateClock,1000);
load(); setInterval(load,10000);