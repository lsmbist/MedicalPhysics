
const data=window.TIMMERMAN_DATA||[];
const organs=[...new Set(data.map(r=>r.organ))].sort((a,b)=>a.localeCompare(b));
const fractions=[...new Set(data.map(r=>r.fractions))].sort((a,b)=>a-b);
const organSelect=document.getElementById('organSelect');
const fractionSelect=document.getElementById('fractionSelect');
const searchInput=document.getElementById('searchInput');
const detailRows=document.getElementById('detailRows');
const allRows=document.getElementById('allRows');
const canvas=document.getElementById('doseChart');
const ctx=canvas.getContext('2d');
const tooltip=document.getElementById('chartTooltip');
let chartPoints=[];

organs.forEach(o=>organSelect.add(new Option(o,o)));
fractions.forEach(f=>fractionSelect.add(new Option(`${f} fraction${f===1?'':'s'}`,f)));
organSelect.value=organs.includes('Spinal cord and medulla')?'Spinal cord and medulla':organs[0];

const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const show=v=>v===null||v===undefined||v===''?'—':v;

function currentRows(){
  const term=searchInput.value.trim().toLowerCase();
  let organ=organSelect.value;
  if(term){
    const hit=organs.find(o=>o.toLowerCase().includes(term))||
      data.find(r=>[r.organ,r.endpoint,r.tissueType].some(x=>String(x).toLowerCase().includes(term)))?.organ;
    if(hit){organSelect.value=hit;organ=hit}
  }
  let rows=data.filter(r=>r.organ===organ);
  if(fractionSelect.value!=='all')rows=rows.filter(r=>r.fractions===Number(fractionSelect.value));
  return rows.sort((a,b)=>a.fractions-b.fractions);
}

function update(){
  const rows=currentRows();
  const organ=organSelect.value;
  const allOrgan=data.filter(r=>r.organ===organ).sort((a,b)=>a.fractions-b.fractions);
  document.getElementById('selectedOrgan').textContent=organ||'—';
  document.getElementById('selectedEndpoint').textContent=[...new Set(allOrgan.map(r=>r.endpoint).filter(Boolean))].join(' / ')||'—';
  document.getElementById('selectedType').textContent=[...new Set(allOrgan.map(r=>r.tissueType).filter(Boolean))].join(' / ')||'—';
  const contours=[...new Set(allOrgan.map(r=>r.contouringInstructions).filter(Boolean))];
  document.getElementById('contourText').textContent=contours.join(' ')||'No contouring instructions listed for this selection.';
  detailRows.innerHTML=rows.map(r=>`<tr><td>${r.fractions}</td><td>${esc(show(r.volume))}</td><td>${esc(show(r.volumeMax))}</td><td>${esc(show(r.pointMax))}</td><td>${esc(show(r.endpoint))}</td></tr>`).join('');
  document.getElementById('volumeStrip').innerHTML=allOrgan.filter(r=>r.volume).map(r=>`<span class="chip">${r.fractions} fx: ${esc(r.volume)}</span>`).join('')||'<span class="chip">No volume value listed</span>';
  drawChart(allOrgan);
}

function drawChart(rows){
  const dpr=window.devicePixelRatio||1;
  const W=canvas.clientWidth||1000,H=Math.max(330,Math.min(460,W*.46));
  canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
  const m={l:62,r:24,t:24,b:52};
  const nums=rows.flatMap(r=>[r.volumeMaxNumeric,r.pointMaxNumeric]).filter(v=>typeof v==='number');
  if(!nums.length){ctx.fillStyle='#617187';ctx.font='15px system-ui';ctx.fillText('No numeric dose limits available for this selection.',m.l,70);return}
  const xs=rows.map(r=>r.fractions),minX=Math.min(...xs),maxX=Math.max(...xs),maxY=Math.max(...nums)*1.12;
  const x=v=>m.l+(maxX===minX?.5:(v-minX)/(maxX-minX))*(W-m.l-m.r);
  const y=v=>H-m.b-(v/maxY)*(H-m.t-m.b);
  ctx.strokeStyle='#dfe6ef';ctx.lineWidth=1;ctx.fillStyle='#617187';ctx.font='12px system-ui';
  for(let i=0;i<=5;i++){const yy=m.t+(H-m.t-m.b)*i/5;ctx.beginPath();ctx.moveTo(m.l,yy);ctx.lineTo(W-m.r,yy);ctx.stroke();ctx.fillText((maxY*(1-i/5)).toFixed(0),m.l-36,yy+4)}
  [...new Set(xs)].forEach(v=>{const xx=x(v);ctx.beginPath();ctx.moveTo(xx,m.t);ctx.lineTo(xx,H-m.b);ctx.stroke();ctx.fillText(v,xx-4,H-m.b+22)});
  ctx.fillStyle='#35506b';ctx.font='600 12px system-ui';ctx.fillText('Dose limit (Gy)',8,16);ctx.fillText('Number of fractions',W/2-55,H-12);
  chartPoints=[];
  [{key:'volumeMaxNumeric',color:'#2f855a',label:'Volume max'},{key:'pointMaxNumeric',color:'#d97706',label:'Max point dose'}].forEach(s=>{
    const pts=rows.filter(r=>typeof r[s.key]==='number').map(r=>({x:x(r.fractions),y:y(r[s.key]),row:r,value:r[s.key],series:s.label,color:s.color}));
    ctx.strokeStyle=s.color;ctx.lineWidth=3;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
    pts.forEach(p=>{ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();chartPoints.push(p)});
  });
}

canvas.addEventListener('mousemove',e=>{
  const rect=canvas.getBoundingClientRect(),mx=e.clientX-rect.left,my=e.clientY-rect.top;
  const p=chartPoints.find(p=>Math.hypot(p.x-mx,p.y-my)<10);
  if(!p){tooltip.hidden=true;return}
  tooltip.hidden=false;tooltip.style.left=`${p.x}px`;tooltip.style.top=`${p.y}px`;
  tooltip.innerHTML=`<strong>${p.series}</strong><br>${p.row.fractions} fx · ${p.value} Gy${p.row.volume?`<br>Volume: ${esc(p.row.volume)}`:''}`;
});
canvas.addEventListener('mouseleave',()=>tooltip.hidden=true);

function renderAll(term=''){
  term=term.toLowerCase();
  const filtered=data.filter(r=>Object.values(r).some(v=>String(v).toLowerCase().includes(term)));
  allRows.innerHTML=filtered.map(r=>`<tr><td>${r.fractions}</td><td>${esc(r.organ)}</td><td>${esc(r.tissueType)}</td><td>${esc(show(r.volume))}</td><td>${esc(show(r.volumeMax))}</td><td>${esc(show(r.pointMax))}</td><td>${esc(show(r.endpoint))}</td></tr>`).join('');
}

document.getElementById('downloadCsv').addEventListener('click',()=>{
  const rows=currentRows(),headers=['Fractions','Organ','Tissue Type','Volume','Volume Max','Max Point Dose / Other','Endpoint','Contouring Instructions'];
  const csv=[headers,...rows.map(r=>[r.fractions,r.organ,r.tissueType,r.volume,r.volumeMax,r.pointMax,r.endpoint,r.contouringInstructions])].map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`${organSelect.value.replace(/[^a-z0-9]+/gi,'_')}_constraints.csv`;a.click();
});

document.querySelectorAll('.nav').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.nav,.view').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');document.getElementById(btn.dataset.view).classList.add('active');
}));
organSelect.addEventListener('change',update);
fractionSelect.addEventListener('change',update);
searchInput.addEventListener('input',update);
document.getElementById('allSearch').addEventListener('input',e=>renderAll(e.target.value));
window.addEventListener('resize',()=>drawChart(data.filter(r=>r.organ===organSelect.value).sort((a,b)=>a.fractions-b.fractions)));

update();renderAll();
