// AMTEK Project Delivery Profiles
// Upgrades Projects into delivery containers: stages, scheduling, documents, permits, field records, photos and tasks.

const modulePageBeforeProjectDelivery = modulePage;

function pdArr(x){ return Array.isArray(x) ? x : (x ? [x] : []); }
function pdStage(job){ return job?.current_phase || job?.stage || 'Pre-construction'; }
function pdToday(){ return new Date().toISOString().slice(0,10); }
function pdDonePct(tasks, jobId){ const jt=tasks.filter(t=>String(t.job_id)===String(jobId)); if(!jt.length)return 0; return Math.round(jt.filter(t=>['Done','Complete','Completed'].includes(String(t.status))).length/jt.length*100); }
function pdAsset(assets, code){ return assets.find(a=>String(a.asset_code||a.code)===String(code)); }

async function projectDelivery(){
  const c=document.getElementById('content');
  let [jobs,tasks,schedules,assets,staff,documents,permits,actions,photos]=await Promise.all([api('jobs'),api('tasks'),api('schedules'),api('assets'),api('staff'),api('documents'),api('permits'),api('actions'),api('photos')]);
  const stages=['Pre-construction','Civil','Electrical','ITS / Signals','Testing','Commissioning','Defects','Complete'];

  c.innerHTML=`<div class="page"><div class="pageHead"><h2>Projects</h2><button onclick="active='quotes';render()">Create / Convert from Quote</button></div><section class="stats" id="pdStats"></section><div class="quoteToolbar"><input id="pdSearch" placeholder="Search project, client, site, authority, stage..."><select id="pdStage"><option value="">All Stages</option>${stages.map(s=>`<option>${s}</option>`).join('')}</select></div><div id="pdBody"></div></div>`;

  async function reload(){[jobs,tasks,schedules,assets,staff,documents,permits,actions,photos]=await Promise.all([api('jobs'),api('tasks'),api('schedules'),api('assets'),api('staff'),api('documents'),api('permits'),api('actions'),api('photos')]);}
  function jobTasks(id){return tasks.filter(t=>String(t.job_id)===String(id));}
  function jobSchedules(id){return schedules.filter(s=>String(s.job_id)===String(id));}
  function jobDocs(id){return documents.filter(d=>String(d.job_id)===String(id));}
  function jobPermits(id){return permits.filter(p=>String(p.job_id)===String(id));}
  function jobActions(id){return actions.filter(a=>String(a.job_id)===String(id));}
  function jobPhotos(id){return photos.filter(p=>String(p.job_id)===String(id));}

  function drawList(){
    const q=(document.getElementById('pdSearch').value||'').toLowerCase();
    const st=document.getElementById('pdStage').value;
    const list=jobs.filter(j=>(!st||pdStage(j)===st)&&[j.job_number,j.client,j.site,j.scope,j.authority,j.status,pdStage(j)].join(' ').toLowerCase().includes(q));
    document.getElementById('pdStats').innerHTML=`${stat('Projects',jobs.length,'delivery records')}${stat('Scheduled',jobs.filter(j=>jobSchedules(j.id).length).length,'with allocations')}${stat('Open Tasks',tasks.filter(t=>!['Done','Complete','Completed'].includes(String(t.status))).length,'remaining')}${stat('Documents',documents.length,'records')}${stat('Permits',permits.length,'authority items')}`;
    document.getElementById('pdBody').innerHTML=`<div class="cards">${list.map(j=>{const sched=jobSchedules(j.id), pct=Number(j.progress||pdDonePct(tasks,j.id)||0); const plant=[...new Set(sched.flatMap(s=>s.assets||[]))]; return `<div class="record"><div class="pageHead"><h3>${safe(j.job_number||j.id)}</h3><span class="tag">${safe(pdStage(j))}</span></div><p><b>${safe(j.client||'')}</b><br>${safe(j.site||'')}</p><p><b>Progress:</b> ${pct}% <b>Value:</b> ${money(j.quote_value||j.total||0)}</p><p><b>Scheduled:</b> ${sched.length} allocation(s)<br><b>Plant:</b> ${safe(plant.join(', ')||'None assigned')}</p><div class="actions"><button data-open-project="${safe(j.id)}">Open Project Profile</button><button data-schedule-project="${safe(j.id)}">Schedule</button></div></div>`;}).join('')}</div>`;
    document.querySelectorAll('[data-open-project]').forEach(b=>b.onclick=()=>drawProfile(jobs.find(j=>String(j.id)===String(b.dataset.openProject))));
    document.querySelectorAll('[data-schedule-project]').forEach(b=>b.onclick=()=>{active='schedules';render();});
  }

  function drawProfile(j){
    const jt=jobTasks(j.id), js=jobSchedules(j.id), jd=jobDocs(j.id), jp=jobPermits(j.id), ja=jobActions(j.id), ph=jobPhotos(j.id);
    const pct=Number(j.progress||pdDonePct(tasks,j.id)||0);
    const crew=[...new Set(js.flatMap(s=>s.staff||[]))];
    const plant=[...new Set(js.flatMap(s=>s.assets||[]))];
    document.getElementById('pdBody').innerHTML=`<button id="pdBack">← Back to Projects</button><div class="record"><div class="pageHead"><h2>${safe(j.job_number||j.id)} - ${safe(j.site||'')}</h2><span class="tag">${safe(pdStage(j))}</span></div><p><b>Client:</b> ${safe(j.client||'')}<br><b>Scope:</b> ${safe(j.scope||'')}<br><b>Status:</b> ${safe(j.status||'Active')} <b>Progress:</b> ${pct}%</p><div class="formGrid"><label>Stage<select id="pdProfileStage">${stages.map(s=>`<option ${pdStage(j)===s?'selected':''}>${s}</option>`).join('')}</select></label><label>Progress<input id="pdProfileProgress" type="range" min="0" max="100" value="${pct}"></label></div><div class="actions"><button id="pdSaveProject">Save Project Stage</button><button onclick="active='schedules';render()">Open Scheduling Board</button></div></div><section class="stats">${stat('Tasks',jt.length,'project tasks')}${stat('Allocations',js.length,'scheduled')}${stat('Crew',crew.length,'assigned')}${stat('Plant',plant.length,'assigned')}${stat('Docs',jd.length,'records')}${stat('Permits',jp.length,'authority')}</section><div class="cards"><div class="record"><h3>Schedule / Resources</h3>${js.map(s=>`<div class="miniRow"><span><b>${safe(s.day)}</b> ${safe(s.task||'')}<br><small>${safe(s.site||j.site||'')}</small></span><span>${safe((s.staff||[]).join(', '))}<br><small>${safe((s.assets||[]).join(', '))}</small></span></div>`).join('')||'<div class="emptySmall">No schedule allocations.</div>'}<h4>Plant Images</h4>${plant.map(code=>{const a=pdAsset(assets,code);return a?`<img src="${safe(a.image||'/logo.png')}" title="${safe(code)}" style="width:92px;height:68px;object-fit:cover;border-radius:10px;margin:3px;border:1px solid #e5e7eb">`:''}).join('')}</div><div class="record"><h3>Tasks / Stage Actions</h3>${jt.map(t=>`<div class="miniRow"><span>${safe(t.name||t.title||t.task||'Task')}</span><span>${safe(t.status||'Planned')}</span></div>`).join('')||'<div class="emptySmall">No tasks.</div>'}<input id="pdNewTask" placeholder="New stage/task"><button id="pdAddTask">Add Task</button></div><div class="record"><h3>Documents</h3>${jd.map(d=>`<div class="miniRow"><span>${safe(d.title||d.name||'Document')}</span><span>${safe(d.status||'')}</span></div>`).join('')||'<div class="emptySmall">No documents.</div>'}<input id="pdDocTitle" placeholder="Document title"><select id="pdDocType"><option>Drawing</option><option>SWMS</option><option>ITP</option><option>As-built</option><option>Commissioning Record</option><option>Authority Approval</option></select><button id="pdAddDoc">Add Document Record</button></div><div class="record"><h3>Permits / Authorities</h3>${jp.map(p=>`<div class="miniRow"><span>${safe(p.title||p.permit||'Permit')}</span><span>${safe(p.status||'')}</span></div>`).join('')||'<div class="emptySmall">No permits.</div>'}<input id="pdPermitTitle" placeholder="Permit / authority item"><select id="pdPermitStatus"><option>Required</option><option>Submitted</option><option>Approved</option><option>Closed</option></select><button id="pdAddPermit">Add Permit</button></div><div class="record"><h3>Field Records / Defects</h3>${ja.map(a=>`<div class="miniRow"><span>${safe(a.workflow_type||'Record')} - ${safe(a.title||'')}</span><span>${safe(a.status||'')}</span></div>`).join('')||'<div class="emptySmall">No field records.</div>'}</div><div class="record"><h3>Photos</h3>${ph.map(p=>`<img src="${safe(p.url||p.photo_url||'/logo.png')}" style="width:125px;height:90px;object-fit:cover;border-radius:10px;margin:4px;border:1px solid #e5e7eb">`).join('')||'<div class="emptySmall">No photos.</div>'}<input id="pdPhotoUrl" placeholder="Photo URL/reference"><button id="pdAddPhoto">Add Photo</button></div></div>`;
    document.getElementById('pdBack').onclick=drawList;
    document.getElementById('pdSaveProject').onclick=async()=>{await api('jobs/'+j.id,{method:'PUT',body:JSON.stringify({current_phase:document.getElementById('pdProfileStage').value,progress:Number(document.getElementById('pdProfileProgress').value)})});await reload();drawProfile(jobs.find(x=>String(x.id)===String(j.id))||j);};
    document.getElementById('pdAddTask').onclick=async()=>{const name=document.getElementById('pdNewTask').value.trim(); if(!name)return; await api('tasks',{method:'POST',body:JSON.stringify({job_id:j.id,phase:pdStage(j),name,status:'Planned',created_at:new Date().toISOString()})});await reload();drawProfile(jobs.find(x=>String(x.id)===String(j.id))||j);};
    document.getElementById('pdAddDoc').onclick=async()=>{const title=document.getElementById('pdDocTitle').value.trim(); if(!title)return; await api('documents',{method:'POST',body:JSON.stringify({job_id:j.id,title,type:document.getElementById('pdDocType').value,status:'Required',created_at:pdToday()})});await reload();drawProfile(j);};
    document.getElementById('pdAddPermit').onclick=async()=>{const title=document.getElementById('pdPermitTitle').value.trim(); if(!title)return; await api('permits',{method:'POST',body:JSON.stringify({job_id:j.id,title,status:document.getElementById('pdPermitStatus').value,created_at:pdToday()})});await reload();drawProfile(j);};
    document.getElementById('pdAddPhoto').onclick=async()=>{const url=document.getElementById('pdPhotoUrl').value.trim(); if(!url)return; await api('photos',{method:'POST',body:JSON.stringify({job_id:j.id,title:'Project photo',url,status:'Filed',day:pdToday()})});await reload();drawProfile(j);};
  }

  document.getElementById('pdSearch').oninput=drawList;
  document.getElementById('pdStage').onchange=drawList;
  drawList();
}

modulePage=function(name){ if(name==='jobs') return projectDelivery(); return modulePageBeforeProjectDelivery(name); };
