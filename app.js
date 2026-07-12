
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


// BED and EQD2 calculator
const bedInputs={
  totalDose:document.getElementById('bedTotalDose'),
  fractions:document.getElementById('bedFractions'),
  alphaBeta:document.getElementById('bedAlphaBeta'),
  newFractions:document.getElementById('newFractions')
};

function fmtDose(value){
  return Number.isFinite(value)?`${value.toFixed(2)} Gy`:'—';
}

function calculateBed(){
  const totalDose=Number(bedInputs.totalDose.value);
  const n=Number(bedInputs.fractions.value);
  const ab=Number(bedInputs.alphaBeta.value);
  const newN=Number(bedInputs.newFractions.value);
  const error=document.getElementById('bedError');

  if(!(totalDose>0)||!(n>0)||!(ab>0)||!(newN>0)){
    error.hidden=false;
    error.textContent='Enter positive values for total dose, fractions, α/β, and new fractions.';
    return;
  }
  error.hidden=true;

  const d=totalDose/n;
  const bed=n*d*(1+d/ab);
  const eqd2=bed/(1+2/ab);

  const discriminant=(ab*ab)+(4*bed*ab/newN);
  const newD=(-ab+Math.sqrt(discriminant))/2;
  const newTotal=newN*newD;
  const bedCheck=newN*newD*(1+newD/ab);
  const newEqd2=bedCheck/(1+2/ab);

  document.getElementById('bedDosePerFraction').textContent=fmtDose(d);
  document.getElementById('bedResult').textContent=fmtDose(bed);
  document.getElementById('eqd2Result').textContent=fmtDose(eqd2);
  document.getElementById('equivalentDosePerFraction').textContent=fmtDose(newD);
  document.getElementById('equivalentExplanation').textContent=`${newN} fractions × ${newD.toFixed(2)} Gy`;
  document.getElementById('equivalentTotalDose').textContent=fmtDose(newTotal);
  document.getElementById('equivalentBedCheck').textContent=fmtDose(bedCheck);

  document.getElementById('tableInitialDose').textContent=fmtDose(totalDose);
  document.getElementById('tableInitialFractions').textContent=n.toString();
  document.getElementById('tableInitialDpf').textContent=fmtDose(d);
  document.getElementById('tableInitialBed').textContent=fmtDose(bed);
  document.getElementById('tableInitialEqd2').textContent=fmtDose(eqd2);
  document.getElementById('tableNewDose').textContent=fmtDose(newTotal);
  document.getElementById('tableNewFractions').textContent=newN.toString();
  document.getElementById('tableNewDpf').textContent=fmtDose(newD);
  document.getElementById('tableNewBed').textContent=fmtDose(bedCheck);
  document.getElementById('tableNewEqd2').textContent=fmtDose(newEqd2);
}

Object.values(bedInputs).forEach(input=>input.addEventListener('input',calculateBed));
document.querySelectorAll('.preset').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.preset').forEach(x=>x.classList.remove('active'));
  button.classList.add('active');
  bedInputs.alphaBeta.value=button.dataset.ab;
  calculateBed();
}));
calculateBed();

document.querySelectorAll('[data-open-view]').forEach(button=>button.addEventListener('click',()=>{
  const target=button.dataset.openView;
  document.querySelectorAll('.nav,.view').forEach(x=>x.classList.remove('active'));
  document.querySelector(`.nav[data-view="${target}"]`)?.classList.add('active');
  document.getElementById(target)?.classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
}));


// Reirradiation evidence summaries
const reirrEvidence = [
  {
    organ:"Spinal cord / thecal sac",
    level:"Moderate retrospective evidence",
    dose:[
      "Historical human data suggest cumulative EQD2/BED is a major determinant of myelopathy risk.",
      "A commonly cited SBRT reirradiation framework uses reirradiation thecal-sac Pmax EQD2 about 20–25 Gy, cumulative Pmax EQD2 about 70 Gy or less, and the SBRT component no more than about 50% of the cumulative normalized dose.",
      "The 2018 review summarizes cumulative BED guidance around 130 Gy2, but this is not a universal constraint."
    ],
    recovery:[
      "Intervals shorter than 6 months increase concern.",
      "Partial recovery has been reported over 6–24 months; recovery is not assumed to be complete.",
      "Dose, fraction size, irradiated cord volume, and prior injury remain important."
    ],
    cautions:[
      "Myelopathy is catastrophic and may occur months after treatment.",
      "Use the actual prior cord/thecal-sac dose, not prescription dose alone.",
      "Do not apply a generic recovery percentage without an institutional model."
    ],
    source:"Nieder & Langendijk, 2017; Das et al., 2018; Sahgal et al. and Nieder et al. models summarized in those sources."
  },
  {
    organ:"Brain / brainstem",
    level:"Limited retrospective evidence",
    dose:[
      "The 2018 review summarizes cumulative brain BED/EQD2 ranges around 130–159 Gy2 and reports reirradiation courses of 30–40 Gy in selected patients.",
      "For previously irradiated intracranial targets, published radiosurgery dose selection depends strongly on target size.",
      "Brainstem point and small-volume doses require separate review rather than whole-brain prescription-dose summation."
    ],
    recovery:[
      "Partial recovery is described, commonly with intervals of at least 12 months in reported series.",
      "For brain reirradiation, some literature uses a minimum interval of about 3 months, but longer intervals are generally preferred when feasible."
    ],
    cautions:[
      "Risk depends on treated volume, location, prior necrosis, surgery, chemotherapy, and survival.",
      "Radionecrosis risk rises with cumulative dose and larger stereotactic treatment volumes.",
      "Brain and brainstem should be evaluated separately."
    ],
    source:"Nieder & Langendijk, 2017; Das et al., 2018."
  },
  {
    organ:"Optic nerves / chiasm",
    level:"Very limited evidence",
    dose:[
      "The 2018 review reports very conservative stereotactic reirradiation limits, including approximately 8–10 Gy to small volumes in selected series.",
      "Evidence is sparse and highly technique- and volume-dependent."
    ],
    recovery:[
      "A minimum interval of about 12 months is commonly cited in the review.",
      "No dependable full-recovery assumption is supported."
    ],
    cautions:[
      "Optic neuropathy can cause permanent blindness.",
      "Previous dose uncertainty, image registration, and small-volume maxima are critical.",
      "Use current disease-site-specific guidance and institutional review."
    ],
    source:"Das et al., 2018; supporting head-and-neck reirradiation literature cited therein."
  },
  {
    organ:"Great vessels / carotids / aorta",
    level:"Limited observational evidence",
    dose:[
      "The book reports grade-5 aortic toxicity in 25% of patients receiving at least 120 Gy raw cumulative dose to 1 cc in one small thoracic series, with no events below that level.",
      "The 2018 review summarizes great-vessel cumulative BED guidance around 90–100 Gy2 after recovery correction, but this should not be treated as universal.",
      "Carotid blowout risk is not determined by dose alone."
    ],
    recovery:[
      "The 2018 review cites intervals longer than 36 months as potentially associated with substantial recovery estimates.",
      "Recovery remains uncertain and vessel-specific."
    ],
    cautions:[
      "Carotid encasement, ulceration, nodal-area irradiation, surgery, infection, and tumor invasion substantially alter risk.",
      "Carotid blowout is often fatal.",
      "Do not use cumulative EQD2 alone to clear a plan."
    ],
    source:"Nieder & Langendijk, 2017; Das et al., 2018; Evans et al. and Yamazaki et al. summarized in those sources."
  },
  {
    organ:"Heart",
    level:"Sparse clinical evidence",
    dose:[
      "The 2018 review summarizes a cumulative BED3Gy value around 70 Gy3 and a small-volume point-dose value around 49 Gy3 from one retrospective thoracic analysis.",
      "These values are literature summaries rather than validated universal constraints."
    ],
    recovery:[
      "Animal data suggest incomplete or absent long-term recovery.",
      "The review notes lower late toxicity in one series when the interval exceeded 24 months."
    ],
    cautions:[
      "Cardiac substructures may have different tolerance.",
      "Prior chemotherapy and cardiovascular disease modify risk.",
      "Mean heart dose alone may be insufficient."
    ],
    source:"Nieder & Langendijk, 2017; Das et al., 2018."
  },
  {
    organ:"Lung",
    level:"Sparse heterogeneous evidence",
    dose:[
      "Published retreatment series include conventional courses around 20–30 Gy and selected stereotactic regimens, but no single cumulative limit is validated.",
      "Peripheral lesions are generally more amenable to stereotactic retreatment than central lesions."
    ],
    recovery:[
      "Partial recovery is suggested in animal and clinical literature.",
      "The 2018 review cites intervals longer than 12 months in many reported series."
    ],
    cautions:[
      "Central airway, esophagus, heart, and great-vessel doses may dominate risk.",
      "Short survival in many studies limits assessment of late pneumonitis and fibrosis.",
      "Composite lung DVH metrics are preferable to prescription-dose addition."
    ],
    source:"Nieder & Langendijk, 2017; Das et al., 2018."
  },
  {
    organ:"Head and neck soft tissue / mandible",
    level:"Retrospective disease-site evidence",
    dose:[
      "The 2018 review summarizes conventional reirradiation courses around 58–60 Gy in selected patients and stereotactic regimens around 18–40 Gy in 3–5 fractions.",
      "Mandibular osteoradionecrosis risk rises with high cumulative bone dose and cortical involvement.",
      "Parotid function may be substantially affected at cumulative doses around 45 Gy in the cited literature."
    ],
    recovery:[
      "Intervals of at least 6–12 months are commonly reported.",
      "Smaller treated volume and less pre-existing injury are favorable."
    ],
    cautions:[
      "Carotid blowout, necrosis, dysphagia, edema, fibrosis, and osteoradionecrosis may occur.",
      "Elective nodal reirradiation is generally avoided in many modern approaches.",
      "Existing severe toxicity strongly argues against simple dose-based clearance."
    ],
    source:"Nieder & Langendijk, 2017; Das et al., 2018."
  },
  {
    organ:"Rectum / bowel / pelvic soft tissue",
    level:"Limited retrospective evidence",
    dose:[
      "The 2018 review summarizes cumulative rectal doses around 70–100 Gy2 in heterogeneous series.",
      "Late bowel obstruction, diarrhea, fistula, and stricture were reported more often at higher cumulative doses and larger reirradiated volumes."
    ],
    recovery:[
      "Longer intervals, often beyond 12–24 months, are generally favorable.",
      "Recovery is incomplete and volume-dependent."
    ],
    cautions:[
      "Technique, overlap volume, surgery, chemotherapy, and bowel displacement matter.",
      "Do not combine prescription doses without reviewing actual bowel and rectal DVHs.",
      "Intraoperative and brachytherapy doses require separate interpretation."
    ],
    source:"Nieder & Langendijk, 2017; Das et al., 2018."
  },
  {
    organ:"Bladder / ureter",
    level:"Very limited evidence",
    dose:[
      "The 2018 review reports point cumulative bladder doses up to about 120 Gy3 and pelvic ureter doses up to about 110 Gy3 in selected series.",
      "These are not validated universal constraints."
    ],
    recovery:[
      "Animal data suggest limited or absent long-term bladder recovery.",
      "The review cites intervals from 6–24 months in reported pelvic series."
    ],
    cautions:[
      "Late cystitis, reduced capacity, fistula, and ureteric stenosis may occur.",
      "Small-volume hot spots and pre-existing urinary injury are important.",
      "Use actual composite dose and anatomy."
    ],
    source:"Nieder & Langendijk, 2017; Das et al., 2018."
  },
  {
    organ:"Kidney",
    level:"Predominantly preclinical evidence",
    dose:[
      "No reliable universal reirradiation limit is established in the supplied sources.",
      "Partial-organ dose and remaining renal function are essential."
    ],
    recovery:[
      "Animal evidence suggests progressive injury rather than meaningful recovery."
    ],
    cautions:[
      "Do not apply a time-based recovery discount.",
      "Renal reserve, contralateral kidney function, systemic therapy, and comorbidities matter.",
      "Assess mean dose and spared functional volume."
    ],
    source:"Nieder & Langendijk, 2017; Das et al., 2018."
  },
  {
    organ:"Skin / mucosa",
    level:"Mixed preclinical and clinical evidence",
    dose:[
      "Acutely reacting tissues may show substantial recovery, and selected conventional reirradiation courses around 50–60 Gy have been reported.",
      "Tolerance still depends on prior injury, fraction size, field overlap, and volume."
    ],
    recovery:[
      "Recovery is often substantial after several months; the 2018 review emphasizes intervals longer than about 6 months.",
      "Persistent severe mucosal injury predicts poorer tolerance."
    ],
    cautions:[
      "Necrosis and ulceration remain possible at high cumulative doses.",
      "Previously injured or surgically compromised tissue may behave differently.",
      "Do not assume full recovery solely from elapsed time."
    ],
    source:"Nieder & Langendijk, 2017; Das et al., 2018."
  }
];

const reirrOrgan=document.getElementById('reirrOrgan');
if(reirrOrgan){
  reirrEvidence.forEach((item,i)=>reirrOrgan.add(new Option(item.organ,i)));
}

function reirrFmt(v){return Number.isFinite(v)?`${v.toFixed(2)} Gy`:'—';}
function intervalLabel(m){
  if(m<3)return '<3 months';
  if(m<6)return '3–6 months';
  if(m<12)return '6–12 months';
  if(m<24)return '12–24 months';
  return '≥24 months';
}
function renderEvidence(){
  if(!reirrOrgan)return;
  const item=reirrEvidence[Number(reirrOrgan.value)||0];
  document.getElementById('evidenceTitle').textContent=item.organ;
  document.getElementById('evidenceLevel').textContent=item.level;
  document.getElementById('evidenceDose').innerHTML=item.dose.map(x=>`<li>${x}</li>`).join('');
  document.getElementById('evidenceRecovery').innerHTML=item.recovery.map(x=>`<li>${x}</li>`).join('');
  document.getElementById('evidenceCautions').innerHTML=item.cautions.map(x=>`<li>${x}</li>`).join('');
  document.getElementById('evidenceSource').textContent=item.source;
}
function calculateReirr(){
  const d1=Number(document.getElementById('r1Dose')?.value);
  const n1=Number(document.getElementById('r1Fractions')?.value);
  const d2=Number(document.getElementById('r2Dose')?.value);
  const n2=Number(document.getElementById('r2Fractions')?.value);
  const ab=Number(document.getElementById('rAlphaBeta')?.value);
  const interval=Number(document.getElementById('rInterval')?.value);
  const error=document.getElementById('rCalcError');
  if(!(d1>=0)||!(d2>=0)||!(n1>0)||!(n2>0)||!(ab>0)||!(interval>=0)){
    if(error){error.hidden=false;error.textContent='Enter valid non-negative doses and interval, positive fractions, and a positive α/β ratio.';}
    return;
  }
  if(error)error.hidden=true;
  const f1=d1/n1,f2=d2/n2;
  const bed1=d1*(1+f1/ab),bed2=d2*(1+f2/ab);
  const eq1=bed1/(1+2/ab),eq2=bed2/(1+2/ab);
  const cumBed=bed1+bed2,cumEq=eq1+eq2;
  const contribution=cumEq>0?100*eq2/cumEq:0;
  document.getElementById('r1Dpf').textContent=reirrFmt(f1);
  document.getElementById('r1Bed').textContent=reirrFmt(bed1);
  document.getElementById('r1Eqd2').textContent=reirrFmt(eq1);
  document.getElementById('r2Dpf').textContent=reirrFmt(f2);
  document.getElementById('r2Bed').textContent=reirrFmt(bed2);
  document.getElementById('r2Eqd2').textContent=reirrFmt(eq2);
  document.getElementById('rCumBed').textContent=reirrFmt(cumBed);
  document.getElementById('rCumEqd2').textContent=reirrFmt(cumEq);
  document.getElementById('rContribution').textContent=`${contribution.toFixed(1)}%`;
  document.getElementById('rIntervalLabel').textContent=intervalLabel(interval);
}

const rInputs=['r1Dose','r1Fractions','r2Dose','r2Fractions','rAlphaBeta','rInterval'];
rInputs.forEach(id=>document.getElementById(id)?.addEventListener('input',calculateReirr));
reirrOrgan?.addEventListener('change',renderEvidence);

const reirrTableBody=document.getElementById('reirrTableBody');
if(reirrTableBody){
  reirrTableBody.innerHTML=reirrEvidence.map((x,i)=>`
    <tr>
      <td><button class="table-link" data-evidence-index="${i}">${x.organ}</button></td>
      <td>${x.dose[0]}</td>
      <td>${x.recovery[0]}</td>
      <td>${x.cautions[0]}</td>
    </tr>`).join('');
  document.querySelectorAll('[data-evidence-index]').forEach(btn=>btn.addEventListener('click',()=>{
    reirrOrgan.value=btn.dataset.evidenceIndex;
    renderEvidence();
    document.querySelector('.evidence-card')?.scrollIntoView({behavior:'smooth',block:'start'});
  }));
}

calculateReirr();
renderEvidence();
