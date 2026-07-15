let CASE_BANK=window.DR_DARNELL_CASE_BANK;
const STANDARD_ACTIONS=[
"Continue routine surveillance",
"Reposition the patient laterally",
"Discontinue oxytocin",
"Turn laterally and increase IV fluids",
"Assess and treat maternal fever and notify the provider",
"Evaluate reversible causes and notify the provider",
"Initiate immediate resuscitative measures and prepare for expedited birth if unresolved",
"Urgent evaluation and preparation for expedited birth",
"Reduce or stop oxytocin and reassess uterine activity",
"Perform an immediate vaginal examination and call for emergency assistance",
"Verify fetal heart rate and compare it with the maternal pulse",
"Continue assessment and surveillance",
"Begin corrective measures and notify the provider if unresolved",
"Reposition and evaluate pushing frequency and fetal recovery",
"Continue surveillance and assess labor progress"
];
let session=[],caseIndex=0,stepIndex=0,score=0,totalAnswered=0,correctCount=0,streak=0,maxStreak=0,hintIndex=0;
let studentName="",animationId=null,paused=false,scrollOffset=0,selectedVoice=null;
let skill={Baseline:[0,0],Variability:[0,0],Accelerations:[0,0],Decelerations:[0,0],Category:[0,0],Intervention:[0,0]};
let earned=new Set();
const steps=["Baseline","Variability","Accelerations","Decelerations","Category","Intervention"];
const el=id=>document.getElementById(id);

function normalizeSpeech(t){
 return String(t)
 .replace(/Category\s+III/gi,"Category three")
 .replace(/Category\s+II/gi,"Category two")
 .replace(/Category\s+I/gi,"Category one")
 .replace(/FHR/g,"fetal heart rate")
 .replace(/mU\/min/g,"milliunits per minute")
 .replace(/cm/g,"centimeters")
 .replace(/G(\d)P(\d)/g,"G $1 P $2");
}
function loadVoices(){
 const voices=speechSynthesis.getVoices().filter(v=>v.lang&&v.lang.startsWith("en"));
 const prefs=[/Natural/i,/Neural/i,/Microsoft Ava/i,/Microsoft Jenny/i,/Microsoft Aria/i,/Google US English/i,/Samantha/i];
 selectedVoice=null;
 for(const p of prefs){selectedVoice=voices.find(v=>p.test(v.name));if(selectedVoice)break}
 selectedVoice=selectedVoice||voices.find(v=>v.lang==="en-US")||voices[0]||null;
}
if("speechSynthesis"in window){loadVoices();speechSynthesis.onvoiceschanged=loadVoices}
function speak(t,onend=null){
 if(!("speechSynthesis"in window)){if(onend)onend();return}
 speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(normalizeSpeech(t));u.rate=.94;u.pitch=1.01;if(selectedVoice)u.voice=selectedVoice;if(onend)u.onend=onend;speechSynthesis.speak(u)
}

function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
function startSession(){
 studentName=el("studentName").value.trim();
 if(!studentName){alert("Please enter the student's name.");return}
 const diff=el("difficulty").value,count=Number(el("caseCount").value);
 let pool=diff==="All"?CASE_BANK:CASE_BANK.filter(c=>c.level===diff);
 if(pool.length<count)pool=CASE_BANK;
 session=shuffle(pool).slice(0,Math.min(count,pool.length));
 caseIndex=0;stepIndex=0;score=0;totalAnswered=0;correctCount=0;streak=0;maxStreak=0;earned=new Set();
 skill={Baseline:[0,0],Variability:[0,0],Accelerations:[0,0],Decelerations:[0,0],Category:[0,0],Intervention:[0,0]};
 el("start").classList.add("hidden");el("report").classList.add("hidden");el("certificate").style.display="none";el("game").classList.remove("hidden");
 renderCase();
}
function renderPatient(p){
 const labels={name:"Patient",gravida:"Obstetric History",weeks:"Gestation",cervix:"Cervical Exam",membranes:"Membranes",meds:"Medications",bp:"Blood Pressure",temp:"Temperature",pulse:"Maternal Pulse"};
 el("patientGrid").innerHTML=Object.entries(p).map(([k,v])=>`<div class="patient-item"><span>${labels[k]||k}</span><strong>${v}</strong></div>`).join("");
}
function renderCase(){
 const c=session[caseIndex];stepIndex=0;hintIndex=0;paused=false;scrollOffset=0;
 el("caseStat").textContent=`${caseIndex+1}/${session.length}`;el("levelStat").textContent=c.level;
 el("caseBadge").textContent=`Case ${caseIndex+1} • ${c.level}`;el("caseTitle").textContent=c.title;renderPatient(c.patient);
 el("hintBox").style.display="none";el("hintBox").textContent="";el("interventionPanel").classList.add("hidden");
 updateStats();updateStepper();renderQuestion();startMonitor();
}
function updateStats(){
 el("scoreStat").textContent=score;el("accuracyStat").textContent=totalAnswered?Math.round(correctCount/totalAnswered*100)+"%":"0%";
 el("streakStat").textContent=streak;el("progressBar").style.width=((caseIndex+stepIndex/6)/session.length*100)+"%";
}
function updateStepper(){
 [...el("stepper").children].forEach((x,i)=>{x.className="step"+(i<stepIndex?" done":i===stepIndex?" active":"")});
}
function choicesFor(step,c){
 const pools={
 Baseline:["Normal","Tachycardia","Bradycardia","Unable to determine"],
 Variability:["Absent","Minimal","Moderate","Marked","Sinusoidal"],
 Accelerations:["Present","Absent","Shoulders present","Acceleration after stimulation"],
 Decelerations:["None","Early decelerations","Variable decelerations","Late decelerations","Recurrent late decelerations","Prolonged deceleration","Possible artifact"],
 Category:["Category I","Category II","Category III","Unable to classify until signal verified"]
 };
 const correct=c[step==="Decelerations"?"decel":step.toLowerCase().replace("accelerations","accels")];
 let opts=shuffle([correct,...shuffle(pools[step].filter(x=>x!==correct)).slice(0,3)]);
 return {correct,opts};
}
function renderQuestion(){
 const c=session[caseIndex],step=steps[stepIndex];
 el("feedback").className="feedback";el("feedback").innerHTML="";
 el("nextStepBtn").classList.add("hidden");
 if(step==="Intervention"){renderInterventions();return}
 const qMap={Baseline:"Identify the fetal heart rate baseline.",Variability:"Identify the baseline variability.",Accelerations:"Are accelerations present?",Decelerations:"Identify the deceleration pattern.",Category:"Classify the tracing."};
 el("questionText").textContent=`Step ${stepIndex+1}: ${qMap[step]}`;
 const {correct,opts}=choicesFor(step,c);el("options").innerHTML="";
 opts.forEach(o=>{
  const b=document.createElement("button");b.className="option";b.style.width="100%";b.style.textAlign="left";b.textContent=o;
  b.addEventListener("click",()=>gradeStep(o,correct,b,step));el("options").appendChild(b)
 });
}
function wrongWhy(selected,step,c){
 const specifics={
 "Category I":"Category one requires a normal baseline, moderate variability, and no recurrent late or variable decelerations.",
 "Category II":"Category two contains patterns that are not Category one and do not meet Category three criteria.",
 "Category III":"Category three requires absent variability with recurrent late decelerations, recurrent variable decelerations, bradycardia, or a sinusoidal pattern.",
 "Early decelerations":"Early decelerations are gradual and mirror contractions, which is not the pattern shown here.",
 "Late decelerations":"Late decelerations begin after the contraction begins and recover after it ends.",
 "Variable decelerations":"Variable decelerations are abrupt and vary in timing, usually reflecting cord compression.",
 "Moderate":"Moderate variability has fluctuations of 6 to 25 beats per minute.",
 "Minimal":"Minimal variability has fluctuations of 5 beats per minute or less.",
 "Marked":"Marked variability exceeds 25 beats per minute.",
 "Absent":"Absent variability has no detectable amplitude fluctuations."
 };
 return specifics[selected]||`The selected ${step.toLowerCase()} does not match the features visible in this tracing.`;
}
function gradeStep(selected,correct,button,step){
 [...el("options").children].forEach(b=>b.disabled=true);
 const ok=selected===correct;totalAnswered++;skill[step][1]++;
 if(ok){correctCount++;score+=10;streak++;maxStreak=Math.max(maxStreak,streak);skill[step][0]++;button.classList.add("correct")}
 else{streak=0;button.classList.add("wrong");[...el("options").children].find(b=>b.textContent===correct)?.classList.add("correct")}
 const c=session[caseIndex],fb=el("feedback");fb.className="feedback show "+(ok?"good":"bad");
 const explanation=step==="Category"?`The correct classification is ${correct}. ${c.rationale}`:
 `${wrongWhy(selected,step,c)} The correct answer is ${correct}.`;
 fb.innerHTML=ok?`<strong>Correct.</strong><br>${correct}. ${step==="Category"?c.rationale:"This finding matches the visible tracing characteristics."}`:
 `<strong>Incorrect.</strong><br>You selected <strong>${selected}</strong>.<br>${explanation}`;
 speak(ok?`Correct. ${correct}. ${step==="Category"?c.rationale:"This finding matches the tracing."}`:
 `Incorrect. You selected ${selected}. ${wrongWhy(selected,step,c)} The correct answer is ${correct}. ${step==="Category"?c.rationale:""}`);
 checkAchievements();updateStats();el("nextStepBtn").classList.remove("hidden")
}
function renderInterventions(){
 const c=session[caseIndex];el("questionText").textContent="Step 6: Select the priority nursing intervention.";
 el("options").innerHTML="";el("interventionPanel").classList.remove("hidden");el("actions").innerHTML="";
 const actions=shuffle([c.intervention,...shuffle(STANDARD_ACTIONS.filter(x=>x!==c.intervention)).slice(0,5)]);
 actions.forEach(a=>{const b=document.createElement("button");b.className="action-btn";b.textContent=a;b.addEventListener("click",()=>simulateIntervention(a,c));el("actions").appendChild(b)})
}
function simulateIntervention(a,c){
 [...el("actions").children].forEach(b=>b.disabled=true);
 const ok=a===c.intervention;totalAnswered++;skill.Intervention[1]++;
 if(ok){correctCount++;score+=15;streak++;maxStreak=Math.max(maxStreak,streak);skill.Intervention[0]++;earned.add("Intervention Expert")}
 else streak=0;
 const r=el("simResult");r.className="sim-result "+(ok?"good":"bad");
 r.innerHTML=ok?`<strong>Patient improves.</strong><br>${c.rationale}`:
 `<strong>The tracing does not improve.</strong><br>You selected <strong>${a}</strong>. This does not address the most likely cause: <strong>${c.cause}</strong>.<br><br>The priority action is <strong>${c.intervention}</strong>.<br>${c.rationale}`;
 speak(ok?`Correct. The patient improves. ${c.rationale}`:
 `Incorrect. You selected ${a}. This does not address ${c.cause}. The priority action is ${c.intervention}. ${c.rationale}`);
 if(ok)startImprovementAnimation();else startWorseningAnimation();
 checkAchievements();updateStats();
 setTimeout(()=>{const b=document.createElement("button");b.className="primary";b.textContent=caseIndex===session.length-1?"View Performance Report":"Next Clinical Case";b.addEventListener("click",advanceCase);r.appendChild(document.createElement("br"));r.appendChild(b)},700)
}
function advanceCase(){caseIndex++;if(caseIndex>=session.length){finishSession();return}renderCase();window.scrollTo({top:0,behavior:"smooth"})}
function checkAchievements(){
 if(streak>=3)earned.add("Three in a Row");
 if(maxStreak>=6)earned.add("Clinical Streak");
 if(skill.Baseline[0]>=3)earned.add("Baseline Master");
 if(skill.Variability[0]>=3)earned.add("Variability Expert");
 if(skill.Decelerations[0]>=3)earned.add("Deceleration Detective");
 if(skill.Category[0]>=3)earned.add("Category Champion");
 renderBadges()
}
const allBadges=["Baseline Master","Variability Expert","Deceleration Detective","Category Champion","Intervention Expert","Three in a Row","Clinical Streak","Perfect Case"];
function renderBadges(){el("badges").innerHTML=allBadges.map(b=>`<span class="achievement ${earned.has(b)?"earned":""}">${earned.has(b)?"🏅":"○"} ${b}</span>`).join("")}
function finishSession(){
 cancelAnimationFrame(animationId);el("game").classList.add("hidden");el("report").classList.remove("hidden");
 const pct=Math.round(correctCount/totalAnswered*100),level=pct>=90?"Expert Interpreter":pct>=80?"Proficient Interpreter":pct>=70?"Developing Interpreter":"Needs Additional Practice";
 el("reportScore").textContent=`${score} pts`;el("reportAccuracy").textContent=pct+"%";el("reportLevel").textContent=level;
 el("skillReport").innerHTML=Object.entries(skill).map(([k,v])=>{const p=v[1]?Math.round(v[0]/v[1]*100):0;return `<p><strong>${k}:</strong> ${v[0]}/${v[1]} (${p}%)</p><div class="progress"><div style="width:${p}%"></div></div>`}).join("");
 el("reportBadges").innerHTML=[...earned].map(b=>`<span class="achievement earned">🏅 ${b}</span>`).join("")||"No badges earned yet.";
 el("certName").textContent=studentName;el("certCases").textContent=`Completed ${session.length} interactive labor scenarios`;
 el("certScore").textContent=`Final Accuracy: ${pct}%`;el("certLevel").textContent=`Performance Level: ${level}`;el("certDate").textContent=`Completed on ${new Date().toLocaleDateString()}`;
 speak(`Practice complete. Your accuracy is ${pct} percent. Your performance level is ${level}.`)
}

// Monitor rendering and live scrolling
const canvas=el("monitor"),ctx=canvas.getContext("2d");
function noise(t,a){return Math.sin(t*8.3)*a*.5+Math.sin(t*17.1)*a*.3+Math.sin(t*31.4)*a*.2}
function gauss(x,c,w){return Math.exp(-Math.pow((x-c)/w,2))}
function fhr(c,t){
 let y=c.strip.base+noise(t,c.strip.var);
 if(c.strip.sinusoidal)y=c.strip.base+15*Math.sin(t*Math.PI*.75);
 for(const e of c.strip.events||[]){
  if(e.type==="accel")y+=22*gauss(t,e.t,.25);
  if(e.type==="early")y-=28*gauss(t,e.t,.48);
  if(e.type==="late")y-=32*gauss(t,e.t,.5);
  if(e.type==="variable")y-=48*gauss(t,e.t,.18);
  if(e.type==="artifact"&&t>e.t-1&&t<e.t+1)y=86+noise(t,1.5);
  if(e.type==="prolonged"){const d=e.dur||3,s=e.t-d/2,en=e.t+d/2;if(t>s&&t<en){const f=Math.min(1,(t-s)/.25,(en-t)/.25);y-=58*Math.max(0,f)}}
 }return y
}
function uc(c,t){let v=8;for(const p of c.strip.contractions)v+=72*gauss(t,p,.42);return v}
function grid(off){
 ctx.fillStyle="#fff";ctx.fillRect(0,0,1000,430);ctx.strokeStyle="#f2cccc";ctx.lineWidth=.6;
 for(let x=-off%10;x<1000;x+=10){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,430);ctx.stroke()}
 for(let y=0;y<430;y+=10){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1000,y);ctx.stroke()}
 ctx.strokeStyle="#df9393";for(let x=-off%50;x<1000;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,430);ctx.stroke()}
 for(let y=0;y<430;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1000,y);ctx.stroke()}
 ctx.fillStyle="#374151";ctx.font="13px Arial";[60,90,120,150,180,210].forEach(b=>ctx.fillText(b,4,250-(b-60)*1.2-3));ctx.fillText("FHR bpm",8,17);ctx.fillText("Uterine activity",8,302);ctx.strokeStyle="#6b7280";ctx.beginPath();ctx.moveTo(0,280);ctx.lineTo(1000,280);ctx.stroke()
}
function drawMonitor(){
 const c=session[caseIndex];grid(scrollOffset);ctx.strokeStyle="#111827";ctx.lineWidth=2;ctx.beginPath();
 for(let x=0;x<=1000;x++){const t=((x+scrollOffset)%1000)/100,y=250-(fhr(c,t)-60)*1.2;if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke();
 ctx.strokeStyle="#dc2626";ctx.beginPath();for(let x=0;x<=1000;x++){const t=((x+scrollOffset)%1000)/100,y=405-uc(c,t)*1.25;if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke();
 if(!paused)scrollOffset=(scrollOffset+1.2)%1000;animationId=requestAnimationFrame(drawMonitor)
}
function startMonitor(){cancelAnimationFrame(animationId);scrollOffset=0;el("monitorStatus").textContent="Live strip running";drawMonitor()}
function startImprovementAnimation(){el("monitorStatus").textContent="Tracing response: improving";el("monitorStatus").style.color="#16815b"}
function startWorseningAnimation(){el("monitorStatus").textContent="Tracing response: no improvement";el("monitorStatus").style.color="#b42318"}

// UI events
el("startBtn").addEventListener("click",startSession);
el("dashboardBtn").addEventListener("click",()=>{el("start").classList.add("hidden");el("dashboard").classList.remove("hidden");el("caseEditor").value=JSON.stringify(CASE_BANK,null,2)});
el("closeDashboardBtn").addEventListener("click",()=>{el("dashboard").classList.add("hidden");el("start").classList.remove("hidden")});
el("applyCasesBtn").addEventListener("click",()=>{try{CASE_BANK=JSON.parse(el("caseEditor").value);alert("Case bank applied for this session.")}catch(e){alert("The JSON is not valid.")}});
el("exportCasesBtn").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(CASE_BANK,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="dr-darnell-fetal-strip-cases.json";a.click();URL.revokeObjectURL(a.href)});
el("pauseBtn").addEventListener("click",()=>{paused=!paused;el("pauseBtn").textContent=paused?"Resume":"Pause";el("monitorStatus").textContent=paused?"Strip paused":"Live strip running"});
el("replayBtn").addEventListener("click",()=>{scrollOffset=0;paused=false;el("pauseBtn").textContent="Pause";el("monitorStatus").textContent="Live strip running"});
el("readCaseBtn").addEventListener("click",()=>{const c=session[caseIndex],p=c.patient;speak(`Case ${caseIndex+1}. ${c.title}. Patient ${p.name}. ${p.gravida}. ${p.weeks} weeks. Cervical exam ${p.cervix}. Membranes ${p.membranes}. Medications ${p.meds}. Blood pressure ${p.bp}. Temperature ${p.temp}.`)});
el("hintBtn").addEventListener("click",()=>{const c=session[caseIndex];el("hintBox").style.display="block";el("hintBox").textContent=c.hint[Math.min(hintIndex,c.hint.length-1)];hintIndex++;score=Math.max(0,score-2);updateStats()});
el("nextStepBtn").addEventListener("click",()=>{stepIndex++;updateStepper();renderQuestion()});
el("certificateBtn").addEventListener("click",()=>{el("report").classList.add("hidden");el("certificate").style.display="block"});
el("printBtn").addEventListener("click",()=>window.print());
el("backReportBtn").addEventListener("click",()=>{el("certificate").style.display="none";el("report").classList.remove("hidden")});
el("restartBtn").addEventListener("click",()=>{el("report").classList.add("hidden");el("start").classList.remove("hidden")});
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");el("practiceTab").classList.toggle("hidden",b.dataset.tab!=="practice");el("achievementsTab").classList.toggle("hidden",b.dataset.tab!=="achievements")}));
renderBadges();
window.addEventListener("load",()=>{
 const notice=document.getElementById("loadNotice");
 if(notice) notice.style.display="none";
});
