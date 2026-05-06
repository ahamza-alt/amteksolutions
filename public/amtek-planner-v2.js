// AMTEK Planner V2
// Refined from the uploaded dashboard direction: scheduling-first, project-stage planning, fleet and staff matrix in one workflow.

const modulePageBeforePlannerV2 = modulePage;

function amtekStage(job){ return job?.current_phase || job?.stage || 'Pre-construction'; }
function amtekCodeAsset(assets, code){ return assets.find(a => String(a.asset_code||a.code) === String(code)); }
function amtekStaffLabel(staff, code){ const s=staff.find(x=>String(x.short_name||x.id)===String(code)); return s ? `${s.short_name||''} ${s.full_name||''}`.trim() : code; }
function amtekStaffCaps(s){
  const text=[s.role,s.trade,s.group,(s.training||[]).join(' '),(s.licences||[]).join(' '),(s.tickets||[]).map(t=>t.name||t).join(' ')].join(' ').toLowerCase();
  const caps=[];
  if(text.includes('civil')) caps.push('Civil');
  if(text.includes('electrical')) caps.push('Electrical');
  ['sts1','sts2','stce','stcv','vedn'].forEach(x=>{ if(text.includes(x)) caps.push(x.toUpperCase()); });
  return caps;
}
function amtekStageNeed(stage){
  if(stage==='Civil') return ['Civil'];
  if(stage==='Electrical') return ['Electrical'];
  if(stage==='ITS / Signals') return ['Electrical','STS1'];
  if(stage==='Testing') return ['Electrical','STS2'];
  if(stage==='Commissioning') return ['Electrical','STCE'];
  return [];
}
function amtekCrewWarnings(staffRows, selected, stage){
  const need=amtekStageNeed(stage);
  if(!need.length || !selected.length) return '';
  const selectedCaps=new Set(selected.flatMap(code=>amtekStaffCaps(staffRows.find(s=>String(s.short_name||s.id)===String(code))||{})));
  const missing=need.filter(n=>!selectedCaps.has(n));
  return missing.length ? `<span class="tag danger">Missing: ${safe(missing.join(', '))}</span>` : `<span class="tag">Competency OK</span>`;
}

async function amtekPlannerV2(){
  const c=document.getElementById('content');
  let [jobs,schedules,staff,assets,tasks]=await Promise.all([api('jobs'),api('schedules'),api('staff'),api('assets'),api('tasks')]);
  const days=['Mon','Tue','Wed','Thu','Fri','Mon+','Tue+','Wed+','Thu+','Fri+'];
  const stages=['Pre-construction','Civil','Electrical','ITS / Signals','Testing','Commissioning','Defects','Complete'];
  c.innerHTML=`<div class="page plannerV2"><div class="pageHead"><h2>AMTEK Weekly Works Planner</h2><div><button id="v2New">+ Plan Work</button><button onclick="active='jobs';render()">Projects</button><button onclick="active='staff';render()">Training Matrix</button></div></div><section class="stats" id="v2Stats"></section><div class="quoteToolbar"><select id="v2Day"><option value="">Full Week</option>${days.map(d=>`<option>${d}</option>`).join('')}</select><select id="v2Stage"><option value="">All Stages</option>${stages.map(s=>`<option>${s}</option>`).join('')}</select><input id="v2Search" placeholder="Search project, site, crew, plant, stage..."></div><div id="v2Form"></div><div id="v2Board"></div></div>`;

  async function reload(){ [jobs,schedules,staff,assets,tasks]=await Promise.all([api('jobs'),api('schedules'),api('staff'),api('assets'),api('tasks')]); }
  function jobById(id){ return jobs.find(j=>String(j.id)===String(id)); }
  function jobOptions(selected=''){ return jobs.map(j=>`<option value="${safe(j.id)}" ${String(j.id)===String(selected)?'selected':''}>${safe(j.job_number||j.id)} - ${safe(j.site||j.client||'')} [${safe(amtekStage(j))}]</option>`).join(''); }
  function staffOptions(selected=[]){ return staff.map(s=>`<option value="${safe(s.short_name||s.id)}" ${selected.includes(s.short_name||s.id)?'selected':''}>${safe(s.short_name||s.full_name)} - ${safe(s.trade||s.role||'')}</option>`).join(''); }
  function assetOptions(selected=[]){ return assets.map(a=>`<option value="${safe(a.asset_code||a.code)}" ${selected.includes(a.asset_code||a.code)?'selected':''}>${safe(a.asset_code||a.code)} - ${safe(a.name||a.display_name||'')}</option>`).join(''); }

  function showForm(existing={day:'Mon',staff:[],assets:[],status:'Planned'}){
    const j=jobById(existing.job_id)||jobs[0]||{};
    const stage=amtekStage(j);
    document.getElementById('v2Form').innerHTML=`<div class="form"><h3>${existing.id?'Edit Scheduled Work':'Plan Scheduled Work'}</h3><div class="formGrid"><label>Day<select id="v2fDay">${days.map(d=>`<option ${existing.day===d?'selected':''}>${d}</option>`).join('')}</select></label><label>Project<select id="v2fJob">${jobOptions(existing.job_id||'')}</select></label><label>Stage<select id="v2fStage">${stages.map(s=>`<option ${stage===s?'selected':''}>${s}</option>`).join('')}</select></label><label>Scope<input id="v2fTask" value="${safe(existing.task||'Site works')}"></label><label>Crew<select id="v2fStaff" multiple size="7">${staffOptions(existing.staff||[])}</select></label><label>Plant / Fleet<select id="v2fAssets" multiple size="7">${assetOptions(existing.assets||[])}</select></label></div><div id="v2CompetencyHint"></div><div class="actions"><button id="v2Save">Save Plan</button><button id="v2Cancel">Cancel</button></div></div>`;
    function updateHint(){ const selected=Array.from(document.getElementById('v2fStaff').selectedOptions).map(o=>o.value); document.getElementById('v2CompetencyHint').innerHTML=amtekCrewWarnings(staff,selected,document.getElementById('v2fStage').value); }
    document.getElementById('v2fStaff').onchange=updateHint; document.getElementById('v2fStage').onchange=updateHint; document.getElementById('v2Cancel').onclick=()=>document.getElementById('v2Form').innerHTML='';
    document.getElementById('v2Save').onclick=async()=>{
      const job=jobById(document.getElementById('v2fJob').value)||{};
      const body={day:document.getElementById('v2fDay').value,job_id:document.getElementById('v2fJob').value,site:job.site||'',task:document.getElementById('v2fTask').value,status:'Planned',staff:Array.from(document.getElementById('v2fStaff').selectedOptions).map(o=>o.value),assets:Array.from(document.getElementById('v2fAssets').selectedOptions).map(o=>o.value)};
      await api('jobs/'+body.job_id,{method:'PUT',body:JSON.stringify({current_phase:document.getElementById('v2fStage').value})});
      if(existing.id) await api('schedules/'+existing.id,{method:'PUT',body:JSON.stringify(body)}); else await api('schedules',{method:'POST',body:JSON.stringify(body)});
      document.getElementById('v2Form').innerHTML=''; await reload(); draw();
    };
    updateHint();
  }

  function draw(){
    const filterDay=document.getElementById('v2Day').value, filterStage=document.getElementById('v2Stage').value, q=(document.getElementById('v2Search').value||'').toLowerCase();
    const visible=schedules.filter(s=>{ const j=jobById(s.job_id)||{}; return (!filterDay||s.day===filterDay)&&(!filterStage||amtekStage(j)===filterStage)&&[s.day,s.site,s.task,(s.staff||[]).join(' '),(s.assets||[]).join(' '),j.job_number,j.client,amtekStage(j)].join(' ').toLowerCase().includes(q); });
    const assetBookings={}; visible.forEach(s=>(s.assets||[]).forEach(a=>assetBookings[a]=(assetBookings[a]||0)+1));
    const staffBookings={}; visible.forEach(s=>(s.staff||[]).forEach(x=>staffBookings[x]=(staffBookings[x]||0)+1));
    document.getElementById('v2Stats').innerHTML=`${stat('Works Planned',visible.length,'visible')}${stat('Projects',new Set(visible.map(s=>s.job_id)).size,'scheduled')}${stat('Crew',Object.keys(staffBookings).length,'allocated')}${stat('Plant',Object.keys(assetBookings).length,'allocated')}${stat('Conflicts',Object.values(assetBookings).filter(n=>n>1).length+Object.values(staffBookings).filter(n=>n>1).length,'crew/plant',Object.values(assetBookings).some(n=>n>1)||Object.values(staffBookings).some(n=>n>1)?'danger':'')}`;
    document.getElementById('v2Board').innerHTML=days.filter(d=>!filterDay||d===filterDay).map(day=>{ const rows=visible.filter(s=>s.day===day); return `<div class="record"><div class="pageHead"><h3>${day}</h3><button data-v2-add="${day}">+ Add Work</button></div>${rows.map(s=>{ const j=jobById(s.job_id)||{}; const stage=amtekStage(j); const staffList=s.staff||[]; const assetList=s.assets||[]; const badStaff=staffList.filter(x=>staffBookings[x]>1); const badAssets=assetList.filter(a=>assetBookings[a]>1); const firstAsset=amtekCodeAsset(assets,assetList[0]); return `<div class="miniRow" style="align-items:flex-start"><span style="display:flex;gap:10px;align-items:flex-start">${firstAsset?`<img src="${safe(firstAsset.image||'/logo.png')}" style="width:72px;height:52px;object-fit:cover;border-radius:10px;border:1px solid #e5e7eb">`:''}<span><b>${safe(j.job_number||s.job_id||'Project')}</b> ${safe(s.site||j.site||'')}<br><small>${safe(stage)} - ${safe(s.task||'')}</small><br>${amtekCrewWarnings(staff,staffList,stage)} ${badStaff.length?`<span class="tag danger">Crew clash: ${safe(badStaff.join(', '))}</span>`:''} ${badAssets.length?`<span class="tag danger">Plant clash: ${safe(badAssets.join(', '))}</span>`:''}</span></span><span>${safe(staffList.map(x=>amtekStaffLabel(staff,x)).join(', '))}<br><small>${safe(assetList.join(', '))}</small><br><button data-v2-edit="${safe(s.id)}">Edit</button><button data-v2-del="${safe(s.id)}" class="dangerBtn">Delete</button></span></div>`; }).join('')||'<div class="emptySmall">No works scheduled.</div>'}</div>`; }).join('');
    document.querySelectorAll('[data-v2-add]').forEach(b=>b.onclick=()=>showForm({day:b.dataset.v2Add,staff:[],assets:[],status:'Planned'}));
    document.querySelectorAll('[data-v2-edit]').forEach(b=>b.onclick=()=>showForm(schedules.find(s=>String(s.id)===String(b.dataset.v2Edit))));
    document.querySelectorAll('[data-v2-del]').forEach(b=>b.onclick=async()=>{ if(confirm('Delete scheduled work?')){ await api('schedules/'+b.dataset.v2Del,{method:'DELETE'}); await reload(); draw(); } });
  }
  document.getElementById('v2New').onclick=()=>showForm();
  document.getElementById('v2Day').onchange=draw; document.getElementById('v2Stage').onchange=draw; document.getElementById('v2Search').oninput=draw;
  draw();
}

modulePage=function(name){ if(name==='schedules') return amtekPlannerV2(); return modulePageBeforePlannerV2(name); };
