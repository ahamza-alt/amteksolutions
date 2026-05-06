// AMTEK Inline Weekly Scheduling Planner
// Overrides Scheduling Board with faster project/stage/crew/plant allocation workflow.

const modulePageBeforeSchedulingPlanner = modulePage;

async function weeklySchedulingPlanner(){
  const c=document.getElementById('content');
  let [jobs,schedules,staff,assets]=await Promise.all([api('jobs'),api('schedules'),api('staff'),api('assets')]);
  const days=['Mon','Tue','Wed','Thu','Fri','Mon+','Tue+','Wed+','Thu+','Fri+'];
  const stages=['Pre-construction','Civil','Electrical','ITS / Signals','Testing','Commissioning','Defects','Complete'];

  c.innerHTML=`<div class="page"><div class="pageHead"><h2>Weekly Scheduling Board</h2><div><button id="addAllocation">+ Add Allocation</button><button onclick="active='jobs';render()">Projects</button></div></div><section class="stats" id="plannerStats"></section><div class="quoteToolbar"><select id="plannerDay"><option value="">Full Week</option>${days.map(d=>`<option>${d}</option>`).join('')}</select><select id="plannerStage"><option value="">All Stages</option>${stages.map(s=>`<option>${s}</option>`).join('')}</select><input id="plannerSearch" placeholder="Search project, site, crew, plant..."></div><div id="allocationForm"></div><div id="plannerBoard"></div></div>`;

  function stageFor(j){return j?.current_phase||j?.stage||'Pre-construction';}
  function jobById(id){return jobs.find(j=>String(j.id)===String(id));}
  function assetByCode(code){return assets.find(a=>String(a.asset_code||a.code)===String(code));}
  async function reload(){[jobs,schedules,staff,assets]=await Promise.all([api('jobs'),api('schedules'),api('staff'),api('assets')]);}
  function staffOptions(selected=[]){return staff.map(s=>`<option value="${safe(s.short_name||s.id)}" ${selected.includes(s.short_name||s.id)?'selected':''}>${safe(s.short_name||s.full_name)} - ${safe(s.trade||s.role||'')}</option>`).join('');}
  function assetOptions(selected=[]){return assets.map(a=>`<option value="${safe(a.asset_code||a.code)}" ${selected.includes(a.asset_code||a.code)?'selected':''}>${safe(a.asset_code||a.code)} - ${safe(a.name||a.display_name||'')}</option>`).join('');}
  function jobOptions(selected=''){return jobs.map(j=>`<option value="${safe(j.id)}" ${String(j.id)===String(selected)?'selected':''}>${safe(j.job_number||j.id)} - ${safe(j.site||j.client||'')} [${safe(stageFor(j))}]</option>`).join('');}

  function drawForm(existing){
    document.getElementById('allocationForm').innerHTML=`<div class="form"><h3>${existing?'Edit Allocation':'New Allocation'}</h3><div class="formGrid"><label>Day<select id="allocDay">${days.map(d=>`<option ${existing?.day===d?'selected':''}>${d}</option>`).join('')}</select></label><label>Project<select id="allocJob">${jobOptions(existing?.job_id||'')}</select></label><label>Task / Scope<input id="allocTask" value="${safe(existing?.task||'') || 'Site works'}"></label><label>Status<select id="allocStatus"><option ${existing?.status==='Planned'?'selected':''}>Planned</option><option ${existing?.status==='In Progress'?'selected':''}>In Progress</option><option ${existing?.status==='Complete'?'selected':''}>Complete</option></select></label><label>Crew<select id="allocStaff" multiple size="5">${staffOptions(existing?.staff||[])}</select></label><label>Plant / Fleet<select id="allocAssets" multiple size="5">${assetOptions(existing?.assets||[])}</select></label></div><div class="actions"><button id="saveAllocation">Save Allocation</button><button id="cancelAllocation">Cancel</button></div></div>`;
    document.getElementById('cancelAllocation').onclick=()=>document.getElementById('allocationForm').innerHTML='';
    document.getElementById('saveAllocation').onclick=async()=>{
      const job=jobById(document.getElementById('allocJob').value)||{};
      const body={day:document.getElementById('allocDay').value,job_id:document.getElementById('allocJob').value,site:job.site||'',task:document.getElementById('allocTask').value,status:document.getElementById('allocStatus').value,staff:Array.from(document.getElementById('allocStaff').selectedOptions).map(o=>o.value),assets:Array.from(document.getElementById('allocAssets').selectedOptions).map(o=>o.value)};
      const assetOut=body.assets.map(assetByCode).filter(a=>a&&a.status==='Out of Service');
      if(assetOut.length&&!confirm('One or more selected assets are out of service. Save anyway?')) return;
      if(existing?.id) await api('schedules/'+existing.id,{method:'PUT',body:JSON.stringify(body)}); else await api('schedules',{method:'POST',body:JSON.stringify(body)});
      document.getElementById('allocationForm').innerHTML=''; await reload(); draw();
    };
  }

  function draw(){
    const day=document.getElementById('plannerDay').value, stage=document.getElementById('plannerStage').value, q=(document.getElementById('plannerSearch').value||'').toLowerCase();
    const filtered=schedules.filter(s=>{const j=jobById(s.job_id)||{};return(!day||s.day===day)&&(!stage||stageFor(j)===stage)&&[s.day,s.site,s.task,(s.staff||[]).join(' '),(s.assets||[]).join(' '),j.job_number,j.client,stageFor(j)].join(' ').toLowerCase().includes(q);});
    const assetBookings={}; filtered.forEach(s=>(s.assets||[]).forEach(a=>assetBookings[a]=(assetBookings[a]||0)+1));
    const staffBookings={}; filtered.forEach(s=>(s.staff||[]).forEach(x=>staffBookings[x]=(staffBookings[x]||0)+1));
    document.getElementById('plannerStats').innerHTML=`${stat('Allocations',filtered.length,'visible')}${stat('Projects',new Set(filtered.map(s=>s.job_id)).size,'scheduled')}${stat('Crew',Object.keys(staffBookings).length,'allocated')}${stat('Plant',Object.keys(assetBookings).length,'allocated')}${stat('Clashes',Object.values(assetBookings).filter(n=>n>1).length+Object.values(staffBookings).filter(n=>n>1).length,'crew/plant',Object.values(assetBookings).some(n=>n>1)||Object.values(staffBookings).some(n=>n>1)?'danger':'')}`;
    document.getElementById('plannerBoard').innerHTML=days.filter(d=>!day||d===day).map(d=>{const rows=filtered.filter(s=>s.day===d);return `<div class="record"><div class="pageHead"><h3>${d}</h3><button data-add-day="${d}">+ Add</button></div>${rows.map(s=>{const j=jobById(s.job_id)||{};const badAssets=(s.assets||[]).filter(a=>assetBookings[a]>1);const badStaff=(s.staff||[]).filter(x=>staffBookings[x]>1);return `<div class="miniRow"><span><b>${safe(j.job_number||s.job_id||'')}</b> ${safe(s.site||j.site||'')}<br><small>${safe(stageFor(j))} - ${safe(s.task||'')}</small><br>${badStaff.length?`<span class="tag danger">Crew clash: ${safe(badStaff.join(', '))}</span>`:''}${badAssets.length?`<span class="tag danger">Plant clash: ${safe(badAssets.join(', '))}</span>`:''}</span><span>${safe((s.staff||[]).join(', '))}<br><small>${safe((s.assets||[]).join(', '))}</small><br><button data-edit-allocation="${safe(s.id)}">Edit</button><button data-delete-allocation="${safe(s.id)}" class="dangerBtn">Delete</button></span></div>`;}).join('')||'<div class="emptySmall">No works scheduled.</div>'}</div>`;}).join('');
    document.querySelectorAll('[data-add-day]').forEach(b=>b.onclick=()=>drawForm({day:b.dataset.addDay,status:'Planned',staff:[],assets:[]}));
    document.querySelectorAll('[data-edit-allocation]').forEach(b=>b.onclick=()=>drawForm(schedules.find(s=>String(s.id)===String(b.dataset.editAllocation))));
    document.querySelectorAll('[data-delete-allocation]').forEach(b=>b.onclick=async()=>{if(confirm('Delete allocation?')){await api('schedules/'+b.dataset.deleteAllocation,{method:'DELETE'});await reload();draw();}});
  }
  document.getElementById('addAllocation').onclick=()=>drawForm({day:'Mon',status:'Planned',staff:[],assets:[]});
  document.getElementById('plannerDay').onchange=draw;document.getElementById('plannerStage').onchange=draw;document.getElementById('plannerSearch').oninput=draw;draw();
}

modulePage=function(name){if(name==='schedules')return weeklySchedulingPlanner();return modulePageBeforeSchedulingPlanner(name);};
