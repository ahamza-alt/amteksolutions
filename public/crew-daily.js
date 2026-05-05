// AMTEK Crew Daily Execution
const crewDailyModule = modules.find(m => m[0] === 'client-updates');
if (crewDailyModule) crewDailyModule[1] = 'Crew Daily';
const modulePageBeforeCrewDaily = modulePage;

async function crewDaily(){
  const c = document.getElementById('content');
  let [jobs, schedules, staff, assets, tasks] = await Promise.all([api('jobs'), api('schedules'), api('staff'), api('assets'), api('tasks')]);
  const days = ['Mon','Tue','Wed','Thu','Fri','Mon+','Tue+','Wed+','Thu+','Fri+'];
  c.innerHTML = `<div class="page"><div class="pageHead"><h2>Crew Daily Run Sheet</h2><button id="refreshCrewDaily">Refresh</button></div><section class="stats" id="crewStats"></section><div class="quoteToolbar"><select id="crewDay">${days.map(d=>`<option>${d}</option>`).join('')}</select><select id="crewPerson"><option value="">All Staff</option>${staff.map(s=>`<option value="${safe(s.short_name||s.id)}">${safe(s.short_name||s.full_name)} - ${safe(s.trade||s.role||'')}</option>`).join('')}</select><input id="crewSearch" placeholder="Search site, task, staff, asset..."></div><div id="crewBoard"></div></div>`;
  function jobById(id){return jobs.find(j=>String(j.id)===String(id));}
  function assetByCode(code){return assets.find(a=>String(a.asset_code||a.code)===String(code));}
  function jobTasks(jobId){return tasks.filter(t=>String(t.job_id)===String(jobId));}
  async function reload(){[jobs, schedules, staff, assets, tasks] = await Promise.all([api('jobs'), api('schedules'), api('staff'), api('assets'), api('tasks')]);}
  function draw(){
    const day=document.getElementById('crewDay').value, person=document.getElementById('crewPerson').value, q=(document.getElementById('crewSearch').value||'').toLowerCase();
    const dayRows=schedules.filter(s=>String(s.day)===day);
    const rows=dayRows.filter(s=>(!person||(s.staff||[]).includes(person))&&[s.site,s.task,s.status,(s.staff||[]).join(' '),(s.assets||[]).join(' ')].join(' ').toLowerCase().includes(q));
    document.getElementById('crewStats').innerHTML=`${stat('Activities',rows.length,day)}${stat('Staff',new Set(dayRows.flatMap(s=>s.staff||[])).size,'scheduled')}${stat('Assets',new Set(dayRows.flatMap(s=>s.assets||[])).size,'allocated')}${stat('Open Tasks',tasks.filter(t=>!['Done','Complete','Completed'].includes(String(t.status))).length,'remaining')}`;
    document.getElementById('crewBoard').innerHTML=rows.map(s=>{const j=jobById(s.job_id), linkedTasks=jobTasks(s.job_id);return `<div class="record"><h3>${safe(s.task||'Scheduled Activity')}</h3><p><b>Site:</b> ${safe(s.site||j?.site||'')}<br><b>Job:</b> ${safe(j?.job_number||s.job_id||'')}</p><p><b>Status:</b> <span class="tag">${safe(s.status||'Planned')}</span></p><h4>Staff</h4><div>${(s.staff||[]).length?(s.staff||[]).map(x=>`<span class="bubble">${safe(x)}</span>`).join(''):'<span class="muted">No staff assigned</span>'}</div><h4>Assets</h4><div>${(s.assets||[]).map(code=>{const a=assetByCode(code);return `<div class="miniRow"><img src="${safe(a?.image||'/logo.png')}" style="width:64px;height:48px;object-fit:cover;border-radius:10px"><span>${safe(code)} ${a?'- '+safe(a.name||a.display_name):''}</span></div>`;}).join('')||'<span class="muted">No assets assigned</span>'}</div><h4>Job Tasks</h4><div>${linkedTasks.length?linkedTasks.map(t=>`<div class="miniRow"><span>${safe(t.name||t.title||t.task||'Task')}</span><select data-task-status="${safe(t.id)}"><option ${t.status==='Planned'?'selected':''}>Planned</option><option ${t.status==='In Progress'?'selected':''}>In Progress</option><option ${t.status==='Done'?'selected':''}>Done</option></select><button data-save-task="${safe(t.id)}">Save</button></div>`).join(''):'<div class="emptySmall">No linked tasks.</div>'}</div><div class="actions"><button data-start="${safe(s.id)}">Start</button><button data-complete="${safe(s.id)}">Complete</button></div></div>`;}).join('')||'<div class="empty">No scheduled work for this view.</div>';
    document.querySelectorAll('[data-start]').forEach(b=>b.onclick=async()=>{await api('schedules/'+b.dataset.start,{method:'PUT',body:JSON.stringify({status:'In Progress'})});await reload();draw();});
    document.querySelectorAll('[data-complete]').forEach(b=>b.onclick=async()=>{await api('schedules/'+b.dataset.complete,{method:'PUT',body:JSON.stringify({status:'Complete'})});await reload();draw();});
    document.querySelectorAll('[data-save-task]').forEach(b=>b.onclick=async()=>{const id=b.dataset.saveTask,status=document.querySelector(`[data-task-status="${CSS.escape(id)}"]`).value;await api('tasks/'+id,{method:'PUT',body:JSON.stringify({status})});await reload();draw();});
  }
  document.getElementById('crewDay').onchange=draw;document.getElementById('crewPerson').onchange=draw;document.getElementById('crewSearch').oninput=draw;document.getElementById('refreshCrewDaily').onclick=async()=>{await reload();draw();};draw();
}
modulePage=function(name){if(name==='client-updates')return crewDaily();return modulePageBeforeCrewDaily(name);};
