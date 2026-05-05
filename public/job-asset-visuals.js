// AMTEK Jobs + Visual Asset Assignment
// Overrides Jobs page after enhancements.js loads.

async function visualJobsTracker(){
  const c=document.getElementById('content');
  let [jobs,tasks,staff,assets]=await Promise.all([api('jobs'),api('tasks'),api('staff'),api('assets')]);

  c.innerHTML=`
    <div class="page">
      <div class="pageHead"><h2>Jobs Tracker</h2><button onclick="location.href='/api/exports/jobs'">Export Jobs CSV</button></div>
      <section class="stats" id="jobStats"></section>
      <div class="quoteToolbar">
        <input id="jobSearch" placeholder="Search job, client, site, asset..." />
        <select id="jobPhase"><option value="">All Phases</option><option>Pre Install</option><option>Install</option><option>Complete</option></select>
        <select id="assetType"><option value="">All Asset Types</option><option>Plant</option><option>Trailer</option><option>Light Commercial Vehicle</option><option>Heavy Commercial Vehicle</option></select>
      </div>
      <div id="jobs"></div>
    </div>`;

  function jobTasks(jobId){return tasks.filter(t=>String(t.job_id)===String(jobId));}
  function donePct(jobId){const jt=jobTasks(jobId); if(!jt.length)return 0; return Math.round(jt.filter(t=>['Done','Complete','Completed'].includes(String(t.status))).length/jt.length*100);}
  function selectedAsset(job){return assets.find(a=>String(a.asset_code||a.code)===String(job.asset_code||job.asset||job.assigned_asset));}
  function assetOptions(typeFilter){return assets.filter(a=>!typeFilter||String(a.asset_type||a.type)===typeFilter).map(a=>`<option value="${safe(a.asset_code||a.code)}">${safe(a.asset_code||a.code)} - ${safe(a.name||a.display_name||'')}</option>`).join('');}
  async function reload(){[jobs,tasks,staff,assets]=await Promise.all([api('jobs'),api('tasks'),api('staff'),api('assets')]);}

  function draw(){
    const q=(document.getElementById('jobSearch').value||'').toLowerCase();
    const phase=document.getElementById('jobPhase').value;
    const typeFilter=document.getElementById('assetType').value;
    const list=jobs.filter(j=>{
      const a=selectedAsset(j);
      const hay=[j.job_number,j.client,j.site,j.status,j.manager,j.id,j.asset_code,a?.asset_code,a?.name,a?.type].join(' ').toLowerCase();
      return (!phase||String(j.current_phase||'Pre Install')===phase)&&hay.includes(q);
    });
    const avg=jobs.length?Math.round(jobs.reduce((s,j)=>s+Number(j.progress||donePct(j.id)||0),0)/jobs.length):0;
    document.getElementById('jobStats').innerHTML=`${stat('Jobs',jobs.length,'records')}${stat('Avg Progress',avg+'%','all jobs')}${stat('Assets',assets.length,'available')}${stat('Out of Service',assets.filter(a=>a.status==='Out of Service').length,'blocked','danger')}`;
    document.getElementById('jobs').innerHTML=list.map(j=>{
      const jt=jobTasks(j.id);
      const a=selectedAsset(j);
      const progress=Number(j.progress||donePct(j.id)||0);
      const out=a&&a.status==='Out of Service';
      return `<div class="record jobCard">
        <div style="display:flex;gap:16px;align-items:flex-start">
          <img src="${safe(a?.image||'/logo.png')}" style="width:155px;height:115px;object-fit:cover;border-radius:14px;border:1px solid #e5e7eb;background:#f3f4f6" alt="asset">
          <div style="flex:1">
            <h3>${safe(j.job_number||j.id)}</h3>
            <p><b>${safe(j.client||'')}</b><br>${safe(j.site||'')}</p>
            <p><b>Assigned Asset:</b> ${a?`${safe(a.asset_code||a.code)} - ${safe(a.name||a.display_name)}`:'None'} ${out?'<span class="tag danger">OUT OF SERVICE</span>':''}</p>
            <p><b>Quote Value:</b> ${money(j.quote_value||0)} <span class="tag">${safe(j.status||'Planned')}</span></p>
          </div>
        </div>
        <div class="formGrid">
          <label>Phase<select data-phase="${safe(j.id)}"><option ${j.current_phase==='Pre Install'?'selected':''}>Pre Install</option><option ${j.current_phase==='Install'?'selected':''}>Install</option><option ${j.current_phase==='Complete'?'selected':''}>Complete</option></select></label>
          <label>Progress <span id="p-${safe(j.id)}">${progress}%</span><input type="range" min="0" max="100" value="${progress}" data-progress="${safe(j.id)}"></label>
          <label>Asset<select data-asset="${safe(j.id)}"><option value="">No asset</option>${assetOptions(typeFilter)}</select></label>
          <label>Staff<select data-staff="${safe(j.id)}"><option value="">No staff</option>${staff.map(s=>`<option value="${safe(s.short_name||s.id)}">${safe(s.short_name||s.full_name)} - ${safe(s.trade||s.role||'')}</option>`).join('')}</select></label>
          <label>New Task<input data-new-task="${safe(j.id)}" placeholder="Task name"></label>
          <label>Schedule Day<select data-day="${safe(j.id)}"><option>Mon</option><option>Tue</option><option>Wed</option><option>Thu</option><option>Fri</option><option>Mon+</option><option>Tue+</option><option>Wed+</option><option>Thu+</option><option>Fri+</option></select></label>
        </div>
        <div class="actions"><button data-save-job="${safe(j.id)}">Save Job</button><button data-add-task="${safe(j.id)}">Add Task</button><button data-schedule-job="${safe(j.id)}">Push To Schedule</button></div>
        <h4>Linked Tasks</h4>
        <div>${jt.length?jt.map(t=>`<div class="miniRow"><span>${safe(t.name||t.title||t.task||'Task')}</span><select data-task-status="${safe(t.id)}"><option ${t.status==='Planned'?'selected':''}>Planned</option><option ${t.status==='In Progress'?'selected':''}>In Progress</option><option ${t.status==='Done'?'selected':''}>Done</option></select><button data-save-task="${safe(t.id)}">Save</button></div>`).join(''):'<div class="emptySmall">No tasks yet.</div>'}</div>
      </div>`;
    }).join('')||'<div class="empty">No jobs found.</div>';

    jobs.forEach(j=>{const sel=document.querySelector(`[data-asset="${CSS.escape(String(j.id))}"]`); if(sel) sel.value=j.asset_code||j.asset||j.assigned_asset||'';});
    document.querySelectorAll('[data-progress]').forEach(i=>i.oninput=()=>{const l=document.getElementById('p-'+i.dataset.progress); if(l)l.textContent=i.value+'%';});
    document.querySelectorAll('[data-save-job]').forEach(b=>b.onclick=async()=>{const id=b.dataset.saveJob;const asset=document.querySelector(`[data-asset="${CSS.escape(id)}"]`).value;const phase=document.querySelector(`[data-phase="${CSS.escape(id)}"]`).value;const progress=Number(document.querySelector(`[data-progress="${CSS.escape(id)}"]`).value);const a=assets.find(x=>String(x.asset_code||x.code)===asset);if(a&&a.status==='Out of Service'&&!confirm('This asset is out of service. Assign anyway?'))return;await api('jobs/'+id,{method:'PUT',body:JSON.stringify({asset_code:asset,current_phase:phase,progress,status:progress>=100?'Complete':'Active'})});await reload();draw();});
    document.querySelectorAll('[data-add-task]').forEach(b=>b.onclick=async()=>{const id=b.dataset.addTask;const name=(document.querySelector(`[data-new-task="${CSS.escape(id)}"]`).value||'').trim();if(!name)return alert('Enter task name');await api('tasks',{method:'POST',body:JSON.stringify({job_id:id,name,status:'Planned'})});await reload();draw();});
    document.querySelectorAll('[data-save-task]').forEach(b=>b.onclick=async()=>{const id=b.dataset.saveTask;const status=document.querySelector(`[data-task-status="${CSS.escape(id)}"]`).value;await api('tasks/'+id,{method:'PUT',body:JSON.stringify({status})});await reload();draw();});
    document.querySelectorAll('[data-schedule-job]').forEach(b=>b.onclick=async()=>{const id=b.dataset.scheduleJob;const job=jobs.find(j=>String(j.id)===String(id));const asset=document.querySelector(`[data-asset="${CSS.escape(id)}"]`).value;const staffVal=document.querySelector(`[data-staff="${CSS.escape(id)}"]`).value;const day=document.querySelector(`[data-day="${CSS.escape(id)}"]`).value;const task=(document.querySelector(`[data-new-task="${CSS.escape(id)}"]`).value||job.current_phase||'Job Activity').trim();await api('schedules',{method:'POST',body:JSON.stringify({job_id:id,site:job.site,task,day,status:'Planned',staff:staffVal?[staffVal]:[],assets:asset?[asset]:[]})});alert('Scheduled activity created');await reload();draw();});
  }
  document.getElementById('jobSearch').oninput=draw;
  document.getElementById('jobPhase').onchange=draw;
  document.getElementById('assetType').onchange=draw;
  draw();
}

const modulePageBeforeJobAssetVisuals = modulePage;
modulePage = function(name){
  if(name==='jobs') return visualJobsTracker();
  return modulePageBeforeJobAssetVisuals(name);
};
