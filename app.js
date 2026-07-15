
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


// Practical comparison with Timmerman single-course constraints
const tmOrgan=document.getElementById('timmermanOrgan');
const tmFractions=document.getElementById('timmermanFractions');
const tmMetric=document.getElementById('timmermanMetric');

function tmNumeric(value){
  if(typeof value==='number' && Number.isFinite(value))return value;
  if(value===null||value===undefined)return null;
  const text=String(value).trim();
  if(!text || text.includes('%') || /^V-/i.test(text))return null;
  const match=text.match(/^<?\s*(-?\d+(?:\.\d+)?)/);
  return match?Number(match[1]):null;
}

function tmAvailableRows(){
  return data.filter(row =>
    tmNumeric(row.pointMax)!==null || tmNumeric(row.volumeMax)!==null
  );
}

function populateTmOrgans(){
  if(!tmOrgan)return;
  const names=[...new Set(tmAvailableRows().map(row=>row.organ))].sort((a,b)=>a.localeCompare(b));
  tmOrgan.innerHTML='';
  names.forEach(name=>tmOrgan.add(new Option(name,name)));
  if(names.includes('Spinal cord and medulla'))tmOrgan.value='Spinal cord and medulla';
  populateTmFractions();
}

function populateTmFractions(){
  if(!tmOrgan||!tmFractions)return;
  const fx=[...new Set(tmAvailableRows().filter(row=>row.organ===tmOrgan.value).map(row=>row.fractions))].sort((a,b)=>a-b);
  const previous=Number(tmFractions.value);
  tmFractions.innerHTML='';
  fx.forEach(n=>tmFractions.add(new Option(`${n} fraction${n===1?'':'s'}`,n)));
  if(fx.includes(previous))tmFractions.value=String(previous);
  updateTmComparison();
}

function selectedTmRow(){
  if(!tmOrgan||!tmFractions)return null;
  const candidates=data.filter(row=>row.organ===tmOrgan.value && row.fractions===Number(tmFractions.value));
  const metric=tmMetric?.value||'pointMax';
  return candidates.find(row=>tmNumeric(row[metric])!==null) || candidates[0] || null;
}

function setComplianceCard(elementId,status,title,text){
  const box=document.getElementById(elementId);
  if(!box)return;
  box.classList.remove('pass','fail','caution','neutral');
  box.classList.add(status);
  const titleEl=document.getElementById(`${elementId}Title`);
  const textEl=document.getElementById(`${elementId}Text`);
  if(titleEl)titleEl.textContent=title;
  if(textEl)textEl.textContent=text;
}

function updateTmComparison(){
  if(!tmOrgan)return;
  const row=selectedTmRow();
  const metric=tmMetric.value;
  const limit=row?tmNumeric(row[metric]):null;
  const proposed=Number(document.getElementById('r2Dose')?.value);
  const n2=Number(document.getElementById('r2Fractions')?.value);
  const ab=Number(document.getElementById('rAlphaBeta')?.value);
  const d1=Number(document.getElementById('r1Dose')?.value);
  const n1=Number(document.getElementById('r1Fractions')?.value);

  document.getElementById('tmVolume').textContent=row?.volume||'Not specified';
  document.getElementById('tmLimit').textContent=limit!==null?`${limit.toFixed(1)} Gy`:'No numeric limit';
  document.getElementById('tmEndpoint').textContent=row?.endpoint||'Not specified';
  document.getElementById('tmProposedDose').textContent=Number.isFinite(proposed)?`${proposed.toFixed(2)} Gy`:'—';

  const badge=document.getElementById('timmermanStatusBadge');
  const courseBox=document.getElementById('tmCourseResult');
  const cumBox=document.getElementById('tmCumulativeResult');

  if(!row || limit===null || !(proposed>=0)){
    setComplianceCard('tmCourseResult','neutral','Not evaluated','No numeric Timmerman constraint is available for this selection.');
    setComplianceCard('tmCumulativeResult','neutral','Not evaluated','Choose a numeric constraint and enter valid course doses.');
    badge.className='compliance-badge neutral';
    badge.textContent='No comparison available';
    return;
  }

  const difference=limit-proposed;
  if(proposed<=limit){
    setComplianceCard(
      'tmCourseResult','pass','COMPLIES with selected Timmerman limit',
      `The proposed course-2 organ dose is ${Math.abs(difference).toFixed(2)} Gy below the selected ${limit.toFixed(2)} Gy single-course limit.`
    );
    badge.className='compliance-badge pass';
    badge.textContent='Course 2 complies';
  }else{
    setComplianceCard(
      'tmCourseResult','fail','DOES NOT COMPLY with selected Timmerman limit',
      `The proposed course-2 organ dose exceeds the selected ${limit.toFixed(2)} Gy single-course limit by ${Math.abs(difference).toFixed(2)} Gy.`
    );
    badge.className='compliance-badge fail';
    badge.textContent='Course 2 exceeds limit';
  }

  if(!(n2>0)||!(n1>0)||!(ab>0)||!(d1>=0)){
    setComplianceCard('tmCumulativeResult','neutral','Not evaluated','Enter valid doses, fractions, and α/β values.');
    return;
  }

  const priorDpf=d1/n1;
  const proposedDpf=proposed/n2;
  const priorEqd2=(d1*(1+priorDpf/ab))/(1+2/ab);
  const proposedEqd2=(proposed*(1+proposedDpf/ab))/(1+2/ab);
  const cumulativeEqd2=priorEqd2+proposedEqd2;

  const tmDpf=limit/Number(row.fractions);
  const tmEqd2=(limit*(1+tmDpf/ab))/(1+2/ab);
  const ratio=tmEqd2>0?100*cumulativeEqd2/tmEqd2:NaN;

  if(cumulativeEqd2<=tmEqd2){
    setComplianceCard(
      'tmCumulativeResult','caution','Cumulative EQD2 below single-course equivalent',
      `Cumulative EQD2 is ${cumulativeEqd2.toFixed(2)} Gy versus ${tmEqd2.toFixed(2)} Gy for the selected Timmerman limit (${ratio.toFixed(1)}%). This is not a validated reirradiation clearance.`
    );
  }else{
    setComplianceCard(
      'tmCumulativeResult','fail','Cumulative EQD2 exceeds single-course equivalent',
      `Cumulative EQD2 is ${cumulativeEqd2.toFixed(2)} Gy versus ${tmEqd2.toFixed(2)} Gy for the selected Timmerman limit (${ratio.toFixed(1)}%). This raises concern but is not itself a validated toxicity prediction.`
    );
  }
}

tmOrgan?.addEventListener('change',populateTmFractions);
tmFractions?.addEventListener('change',updateTmComparison);
tmMetric?.addEventListener('change',updateTmComparison);
['r1Dose','r1Fractions','r2Dose','r2Fractions','rAlphaBeta','rInterval'].forEach(id=>{
  document.getElementById(id)?.addEventListener('input',updateTmComparison);
});

populateTmOrgans();


// PDF-assisted reirradiation extraction and Timmerman comparison
const pdfState={
  file:null,
  prescription:null,
  fractions:null,
  current:{},
  cumulative:{},
  goals:{},
  rows:[],
  results:[]
};

const pdfAliasMap={
  "airway":"Trachea and main bronchus",
  "bowel":"Small bowel",
  "small bowel":"Small bowel",
  "esophagus":"Esophagus",
  "heart":"Heart",
  "kidney_l":"Renal cortex",
  "kidney_r":"Renal cortex",
  "kidney l":"Renal cortex",
  "kidney r":"Renal cortex",
  "liver":"Liver",
  "lung_l":"Lungs",
  "lung_r":"Lungs",
  "lung l":"Lungs",
  "lung r":"Lungs",
  "total lung":"Lungs",
  "spinalcanal":"Spinal cord and medulla",
  "spinal canal":"Spinal cord and medulla",
  "spinalcord":"Spinal cord and medulla",
  "spinal cord":"Spinal cord and medulla",
  "stomach":"Stomach",
  "skin":"Skin"
};

const knownPdfStructures=[
  "SpinalCanal","Spinal Canal","SpinalCord","Spinal Cord","Esophagus","Heart","Airway",
  "Total Lung","Lung_L","Lung_R","Lung L","Lung R","Liver","Stomach","Bowel",
  "Kidney_L","Kidney_R","Kidney L","Kidney R"
];

function normalizePdfName(name){
  return String(name||'').replace(/\s+/g,' ').trim();
}
function defaultTmMatch(name){
  const key=normalizePdfName(name).toLowerCase();
  if(pdfAliasMap[key])return pdfAliasMap[key];
  const found=Object.keys(pdfAliasMap).find(alias=>key.includes(alias));
  return found?pdfAliasMap[found]:'';
}
function showPdfMessage(text,type='info'){
  const box=document.getElementById('pdfAnalysisMessage');
  if(!box)return;
  box.hidden=false;box.className=`pdf-message ${type}`;box.textContent=text;
}
function setPdfProgress(pct,text){
  const wrap=document.getElementById('pdfProgressWrap');
  if(wrap)wrap.hidden=false;
  const bar=document.getElementById('pdfProgressBar');
  if(bar)bar.style.width=`${Math.max(0,Math.min(100,pct))}%`;
  const label=document.getElementById('pdfProgressText');
  if(label)label.textContent=text;
}
function waitForPdfJs(){
  if(window.pdfjsLib)return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('PDF library did not load. Check the internet connection.')),15000);
    window.addEventListener('pdfjs-ready',()=>{clearTimeout(timer);resolve();},{once:true});
  });
}
async function renderPdfPage(page,scale=1.7){
  const viewport=page.getViewport({scale});
  const canvas=document.createElement('canvas');
  canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  const context=canvas.getContext('2d',{willReadFrequently:true});
  await page.render({canvasContext:context,viewport}).promise;
  return canvas;
}
async function extractPdfText(page){
  try{
    const content=await page.getTextContent();
    return content.items.map(item=>item.str).join(' ');
  }catch(e){return '';}
}
async function ocrCanvas(canvas,pageNumber,totalPages){
  if(!window.Tesseract)throw new Error('OCR library did not load.');
  setPdfProgress(10+70*(pageNumber/totalPages),`OCR page ${pageNumber} of ${totalPages}…`);
  const result=await Tesseract.recognize(canvas,'eng',{
    logger:m=>{
      if(m.status==='recognizing text'){
        const pageBase=10+70*((pageNumber-1)/totalPages);
        setPdfProgress(pageBase+(70/totalPages)*(m.progress||0),`OCR page ${pageNumber}: ${Math.round((m.progress||0)*100)}%`);
      }
    }
  });
  return result.data.text||'';
}
function numbersFromLine(line){
  return [...String(line).matchAll(/-?\d+(?:\.\d+)?/g)].map(m=>Number(m[0]));
}
function findStructureLine(text,structure){
  const escaped=structure.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s*');
  const re=new RegExp(`(?:^|\\n)[^\\n]*${escaped}[^\\n]*`,'ig');
  return [...String(text).matchAll(re)].map(m=>m[0].trim());
}
function parsePrescription(allText){
  const patterns=[
    /Prescribed\s+dose[^\d]*(\d+(?:\.\d+)?)\s*cGy\s*x\s*(\d+)\s*fx/i,
    /(\d+(?:\.\d+)?)\s*Gy\s*x\s*(\d+)\s*Fx/i,
    /(\d+(?:\.\d+)?)\s*cGy\s*x\s*(\d+)\s*fx\s*=\s*(\d+(?:\.\d+)?)\s*cGy/i
  ];
  for(const re of patterns){
    const m=allText.match(re);
    if(m){
      let perFx=Number(m[1]);
      if(/cGy/i.test(m[0]))perFx/=100;
      const fx=Number(m[2]);
      return {dose:perFx*fx,fractions:fx,perFx};
    }
  }
  const fxMatch=allText.match(/Number\s+of\s+fractions[^\d]*(\d+)/i);
  const doseMatch=allText.match(/Prescribed\s+dose[^\d]*(\d+(?:\.\d+)?)\s*cGy/i);
  if(fxMatch&&doseMatch)return {dose:Number(doseMatch[1])/100,fractions:Number(fxMatch[1]),perFx:Number(doseMatch[1])/100/Number(fxMatch[1])};
  return null;
}
function parseVelocityText(text){
  const out={};
  const lines=String(text).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  for(const structure of knownPdfStructures){
    const aliases=[structure,structure.replace('_',' ')];
    for(const line of lines){
      if(!aliases.some(a=>line.toLowerCase().includes(a.toLowerCase())))continue;
      const nums=numbersFromLine(line);
      // Velocity rows normally end with Volume, Min, Mean, Max.
      if(nums.length>=4){
        const last=nums.slice(-4);
        const min=last[1],mean=last[2],max=last[3];
        if(max>=0&&max<500){
          out[structure]={name:structure,mean,max,min,source:'Velocity cumulative'};
          break;
        }
      }
    }
  }
  return out;
}
function parseRaystationRoiText(text){
  const out={};
  const lines=String(text).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  for(const structure of knownPdfStructures){
    for(const line of lines){
      if(!line.toLowerCase().includes(structure.toLowerCase().replace('_',' ')) &&
         !line.toLowerCase().includes(structure.toLowerCase()))continue;
      const nums=numbersFromLine(line);
      // RayStation ROI statistics: volume, D99, D98, D95, Average, D50, D2, D1 in cGy.
      if(nums.length>=8){
        const vals=nums.slice(-8);
        const average=vals[4]/100;
        const d2=vals[6]/100;
        const d1=vals[7]/100;
        if(d1>=0&&d1<500){
          out[structure]={name:structure,mean:average,max:d1,d2,source:'RayStation current course'};
          break;
        }
      }
    }
  }
  return out;
}
function parseClinicalGoals(text){
  const goals={};
  const lines=String(text).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const structures=['SpinalCanal','Esophagus','Heart','Airway','Total Lung'];
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    const structure=structures.find(s=>line.toLowerCase().includes(s.toLowerCase()));
    if(!structure)continue;
    const doseMatch=line.match(/At\s+most\s+(\d+(?:\.\d+)?)\s*cGy\s+dose\s+at\s+(\d+(?:\.\d+)?)\s*cm/i);
    const valueNums=numbersFromLine(line);
    if(doseMatch){
      const limit=Number(doseMatch[1])/100;
      const volume=Number(doseMatch[2]);
      const achieved=valueNums.length?valueNums[valueNums.length-1]/100:null;
      if(!goals[structure])goals[structure]=[];
      goals[structure].push({volume,limit,achieved});
    }
  }
  return goals;
}
function mergeDoseObjects(target,source){
  Object.entries(source).forEach(([key,value])=>{
    const canonical=normalizePdfName(key);
    target[canonical]={...(target[canonical]||{}),...value,name:canonical};
  });
}
async function analyzeReirrPdf(){
  const file=pdfState.file;
  if(!file)return;
  try{
    await waitForPdfJs();
    setPdfProgress(2,'Opening PDF…');
    showPdfMessage('Analyzing the PDF locally. Image-based pages require OCR and may take several minutes.','info');
    const bytes=await file.arrayBuffer();
    const pdf=await window.pdfjsLib.getDocument({data:bytes}).promise;
    const pageTexts=[];
    const ocrPages={};
    const likelyOcrPages=new Set([1,2,4,6,8,9,11]);

    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i);
      setPdfProgress(5+5*(i/pdf.numPages),`Reading PDF page ${i} of ${pdf.numPages}…`);
      const text=await extractPdfText(page);
      pageTexts[i]=text;
    }

    // OCR the key Velocity and RayStation report pages when embedded text is unavailable.
    const pagesToOcr=[...likelyOcrPages].filter(i=>i<=pdf.numPages && (pageTexts[i]||'').length<250);
    for(let index=0;index<pagesToOcr.length;index++){
      const pageno=pagesToOcr[index];
      const page=await pdf.getPage(pageno);
      const canvas=await renderPdfPage(page,pageno<=2?2.1:1.7);
      ocrPages[pageno]=await ocrCanvas(canvas,index+1,pagesToOcr.length);
    }

    setPdfProgress(84,'Extracting prescription and organ doses…');
    const combined=pageTexts.map((t,i)=>(t||'')+'\n'+(ocrPages[i]||'')).join('\n');
    const prescription=parsePrescription(combined);
    pdfState.prescription=prescription?.dose||null;
    pdfState.fractions=prescription?.fractions||null;

    pdfState.current={};pdfState.cumulative={};pdfState.goals={};
    const velocityText=[1,2].map(i=>(pageTexts[i]||'')+'\n'+(ocrPages[i]||'')).join('\n');
    mergeDoseObjects(pdfState.cumulative,parseVelocityText(velocityText));

    const rayText=[8,9].map(i=>(pageTexts[i]||'')+'\n'+(ocrPages[i]||'')).join('\n');
    mergeDoseObjects(pdfState.current,parseRaystationRoiText(rayText));

    const goalText=(pageTexts[11]||'')+'\n'+(ocrPages[11]||'');
    pdfState.goals=parseClinicalGoals(goalText);

    // Supplement from DoseCHECK universal metrics if RayStation extraction is sparse.
    const doseCheckText=pageTexts.slice(15).join('\n');
    const dcLines=doseCheckText.split(/\r?\n/);
    for(const structure of knownPdfStructures){
      if(pdfState.current[structure])continue;
      const line=dcLines.find(x=>x.toLowerCase().includes(structure.toLowerCase().replace('_',' '))||x.toLowerCase().includes(structure.toLowerCase()));
      if(!line)continue;
      const nums=numbersFromLine(line);
      if(nums.length>=4){
        // Typical universal metrics sequence includes TPS mean and TPS max.
        const plausible=nums.filter(x=>x>=0&&x<200);
        if(plausible.length>=2){
          pdfState.current[structure]={name:structure,mean:plausible[0],max:plausible[plausible.length>=4?3:1],source:'DoseCHECK current course'};
        }
      }
    }

    buildPdfReviewRows();
    setPdfProgress(100,'Analysis complete');
    showPdfMessage(
      `Detected ${pdfState.fractions||'an unknown number of'} fractions, ${Object.keys(pdfState.current).length} current-course structures, and ${Object.keys(pdfState.cumulative).length} cumulative structures. Review all extracted values before comparison.`,
      'success'
    );
    document.getElementById('pdfSummary').hidden=false;
    document.getElementById('pdfPrescription').textContent=pdfState.prescription?`${pdfState.prescription.toFixed(2)} Gy`:'Not detected';
    document.getElementById('pdfFractions').textContent=pdfState.fractions||'Not detected';
    document.getElementById('pdfCurrentCount').textContent=Object.keys(pdfState.current).length;
    document.getElementById('pdfCumulativeCount').textContent=Object.keys(pdfState.cumulative).length;
    if(pdfState.prescription!==null)document.getElementById('r2Dose').value=pdfState.prescription;
    if(pdfState.fractions!==null){
      document.getElementById('r2Fractions').value=pdfState.fractions;
      calculateReirr();updateTmComparison();
    }
  }catch(error){
    console.error(error);
    setPdfProgress(0,'Analysis stopped');
    showPdfMessage(`Could not analyze this PDF: ${error.message}. You can still use the manual reirradiation tool below.`,'error');
  }
}
function buildPdfReviewRows(){
  const names=[...new Set([...Object.keys(pdfState.current),...Object.keys(pdfState.cumulative)])]
    .filter(name=>!/(gtv|ctv|external|superior|prev|target|couch)/i.test(name))
    .sort((a,b)=>a.localeCompare(b));
  const tmOrgans=[...new Set(data.map(r=>r.organ))].sort((a,b)=>a.localeCompare(b));
  pdfState.rows=names.map((name,index)=>({
    id:index,name,include:true,match:defaultTmMatch(name),
    currentMean:pdfState.current[name]?.mean??null,
    currentMax:pdfState.current[name]?.max??null,
    cumulativeMean:pdfState.cumulative[name]?.mean??null,
    cumulativeMax:pdfState.cumulative[name]?.max??null
  }));
  const body=document.getElementById('pdfExtractedRows');
  body.innerHTML=pdfState.rows.map(row=>`
    <tr data-pdf-row="${row.id}">
      <td><input class="pdf-include" type="checkbox" checked></td>
      <td><strong>${esc(row.name)}</strong></td>
      <td><select class="pdf-tm-match"><option value="">No match</option>${tmOrgans.map(o=>`<option value="${esc(o)}" ${o===row.match?'selected':''}>${esc(o)}</option>`).join('')}</select></td>
      <td><input class="pdf-current-mean" type="number" step="0.01" value="${row.currentMean??''}"></td>
      <td><input class="pdf-current-max" type="number" step="0.01" value="${row.currentMax??''}"></td>
      <td><input class="pdf-cumulative-mean" type="number" step="0.01" value="${row.cumulativeMean??''}"></td>
      <td><input class="pdf-cumulative-max" type="number" step="0.01" value="${row.cumulativeMax??''}"></td>
    </tr>`).join('');
  document.getElementById('pdfReviewSection').hidden=false;
}
function syncPdfRowsFromTable(){
  document.querySelectorAll('[data-pdf-row]').forEach(tr=>{
    const row=pdfState.rows[Number(tr.dataset.pdfRow)];
    row.include=tr.querySelector('.pdf-include').checked;
    row.match=tr.querySelector('.pdf-tm-match').value;
    const num=selector=>{
      const value=tr.querySelector(selector).value;
      return value===''?null:Number(value);
    };
    row.currentMean=num('.pdf-current-mean');
    row.currentMax=num('.pdf-current-max');
    row.cumulativeMean=num('.pdf-cumulative-mean');
    row.cumulativeMax=num('.pdf-cumulative-max');
  });
}
function chooseTmConstraint(organ,fx){
  const rows=data.filter(r=>r.organ===organ&&r.fractions===fx);
  if(!rows.length)return null;
  const point=rows.find(r=>tmNumeric(r.pointMax)!==null);
  if(point)return {row:point,metric:'Maximum point dose',limit:tmNumeric(point.pointMax),pdfMetric:'Current max / D1',valueKey:'currentMax'};
  const volume=rows.find(r=>tmNumeric(r.volumeMax)!==null);
  if(volume)return {row:volume,metric:`Volume dose (${volume.volume||'specified volume'})`,limit:tmNumeric(volume.volumeMax),pdfMetric:null,valueKey:null};
  return {row:rows[0],metric:'Text-only constraint',limit:null,pdfMetric:null,valueKey:null};
}
function runAllPdfComparisons(){
  syncPdfRowsFromTable();
  const fx=pdfState.fractions||Number(document.getElementById('r2Fractions').value);
  pdfState.results=pdfState.rows.filter(r=>r.include).map(row=>{
    if(!row.match)return {...row,status:'neutral',statusText:'NO MATCH',reason:'No Timmerman organ was matched.'};
    const constraint=chooseTmConstraint(row.match,fx);
    if(!constraint)return {...row,status:'neutral',statusText:'NO LIMIT',reason:`No Timmerman row is available for ${fx} fractions.`};
    if(constraint.limit===null)return {...row,constraint,status:'caution',statusText:'NOT COMPARABLE',reason:'The Timmerman row is text-only or has no numeric dose limit.'};
    if(!constraint.valueKey)return {...row,constraint,status:'caution',statusText:'METRIC NOT AVAILABLE',reason:`The report does not provide the required ${constraint.metric} metric in a directly comparable form.`};
    const value=row[constraint.valueKey];
    if(!(value>=0))return {...row,constraint,status:'caution',statusText:'METRIC NOT AVAILABLE',reason:`The PDF did not provide ${constraint.pdfMetric}.`};
    const pass=value<=constraint.limit;
    return {...row,constraint,value,status:pass?'pass':'fail',statusText:pass?'PASS':'EXCEEDS',reason:pass?`${value.toFixed(2)} Gy is within the ${constraint.limit.toFixed(2)} Gy limit.`:`${value.toFixed(2)} Gy exceeds the ${constraint.limit.toFixed(2)} Gy limit by ${(value-constraint.limit).toFixed(2)} Gy.`};
  });
  renderPdfComparison();
}
function renderPdfComparison(){
  const body=document.getElementById('pdfComparisonRows');
  body.innerHTML=pdfState.results.map(result=>{
    const constraint=result.constraint;
    const cumulative=result.cumulativeMax!==null?`${result.cumulativeMax.toFixed(2)} Gy maximum`:(result.cumulativeMean!==null?`${result.cumulativeMean.toFixed(2)} Gy mean`:'Not reported');
    return `<tr>
      <td><strong>${esc(result.name)}</strong><br><small>${esc(result.match||'Unmatched')}</small></td>
      <td>${esc(constraint?.pdfMetric||'—')}</td>
      <td>${result.value!==undefined?`${result.value.toFixed(2)} Gy`:'—'}</td>
      <td>${esc(constraint?.metric||'—')}</td>
      <td>${constraint?.limit!==undefined&&constraint?.limit!==null?`${constraint.limit.toFixed(2)} Gy`:'—'}</td>
      <td><span class="status-pill ${result.status}">${result.statusText}</span><br><small>${esc(result.reason)}</small></td>
      <td>${esc(cumulative)}<br><small>Clinical review only</small></td>
    </tr>`;
  }).join('');
  const count=status=>pdfState.results.filter(r=>r.status===status).length;
  document.getElementById('pdfPassCount').textContent=count('pass');
  document.getElementById('pdfFailCount').textContent=count('fail');
  document.getElementById('pdfCautionCount').textContent=count('caution');
  document.getElementById('pdfNoMatchCount').textContent=count('neutral');
  document.getElementById('pdfComparisonSection').hidden=false;
  document.getElementById('pdfComparisonSection').scrollIntoView({behavior:'smooth',block:'start'});
}
function downloadPdfResults(){
  if(!pdfState.results.length)return;
  const headers=['PDF structure','Timmerman match','Fractions','PDF metric','PDF value Gy','Timmerman metric','Limit Gy','Result','Explanation','Cumulative mean Gy','Cumulative max Gy'];
  const rows=pdfState.results.map(r=>[
    r.name,r.match,pdfState.fractions||'',r.constraint?.pdfMetric||'',r.value??'',r.constraint?.metric||'',r.constraint?.limit??'',r.statusText,r.reason,r.cumulativeMean??'',r.cumulativeMax??''
  ]);
  const csv=[headers,...rows].map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download='reirradiation_timmerman_comparison.csv';a.click();
}

document.getElementById('chooseReirrPdf')?.addEventListener('click',()=>document.getElementById('reirrPdfFile').click());
document.getElementById('reirrPdfFile')?.addEventListener('change',event=>{
  const file=event.target.files?.[0];
  pdfState.file=file||null;
  document.getElementById('reirrPdfName').textContent=file?file.name:'No PDF selected';
  document.getElementById('analyzeReirrPdf').disabled=!file;
  document.getElementById('pdfReviewSection').hidden=true;
  document.getElementById('pdfComparisonSection').hidden=true;
});
document.getElementById('analyzeReirrPdf')?.addEventListener('click',analyzeReirrPdf);
document.getElementById('runPdfComparison')?.addEventListener('click',runAllPdfComparisons);
document.getElementById('downloadPdfComparisonCsv')?.addEventListener('click',downloadPdfResults);
