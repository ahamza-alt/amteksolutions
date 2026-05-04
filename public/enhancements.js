// AMTEK Integrated Enhancements
// BOQ + Quote Register + Jobs Tracker with Tasks and Schedule Linkage

async function boqManager(){
  const c=document.getElementById('content');
  let rows=await api('rate-library');
  c.innerHTML=`<div class="page"><div class="pageHead"><h2>BOQ / Materials Library</h2><div><button id="addBoq">+ Add Item</button><button onclick="location.href='/api/exports/rate-library'">Export CSV</button></div></div><input id="boqSearch" placeholder="Search code, description, category, unit..." /><div id="boqTable"></div></div>`;
  function draw(){
    const q=(document.getElementById('boqSearch').value||'').toLowerCase();
    const list=rows.filter(r=>[r.code,r.description,r.category,r.unit].join(' ').toLowerCase().includes(q));
    document.getElementById('boqTable').innerHTML=`<table><thead><tr><th>Code</th><th>Description</th><th>Category</th><th>Unit</th><th>Rate</th><th>Actions</th></tr></thead><tbody>${list.map(r=>`<tr><td><b>${safe(r.code)}</b></td><td><input data-code="${safe(r.code)}" data-field="description" value="${safe(r.description||'')}"></td><td><input data-code="${safe(r.code)}" data-field="category" value="${safe(r.category||'')}"></td><td><input data-code="${safe(r.code)}" data-field="unit" value="${safe(r.unit||'')}"></td><td><input type="number" step="0.01" data-code="${safe(r.code)}" data-field="benchmarkDirectCostPerUnit" value="${Number(r.benchmarkDirectCostPerUnit||r.rate||0)}"></td><td><button data-save-boq="${safe(r.code)}">Save</button><button data-del-boq="${safe(r.code)}" class="dangerBtn">Delete</button></td></tr>`).join('')}</tbody></table>${!list.length?'<div class="empty">No BOQ items found.</div>':''}`;
    document.querySelectorAll('[data-save-boq]').forEach(b=>b.onclick=saveRow);
    document.querySelectorAll('[data-del-boq]').forEach(b=>b.onclick=deleteRow);
  }
  async function saveRow(e){
    const code=e.target.dataset.saveBoq, body={};
    document.querySelectorAll(`[data-code="${code}"]`).forEach(i=>body[i.dataset.field]=i.type==='number'?Number(i.value):i.value);
    await api('rate-library/'+encodeURIComponent(code),{method:'PUT',body:JSON.stringify(body)});
    rows=await api('rate-library'); draw();
  }
  async function deleteRow(e){
    const code=e.target.dataset.delBoq; if(!confirm('Delete item?')) return;
    await api('rate-library/'+encodeURIComponent(code),{method:'DELETE'});
    rows=await api('rate-library'); draw();
  }
  document.getElementById('addBoq').onclick=async()=>{
    const code=prompt('Code?'); if(!code) return;
    await api('rate-library',{method:'POST',body:JSON.stringify({code,description:'',category:'Other',unit:'ea',labourHoursPerUnit:0,materialPerUnit:0,benchmarkDirectCostPerUnit:0,notes:''})});
    rows=await api('rate-library'); draw();
  };
  document.getElementById('boqSearch').oninput=draw; draw();
}

quotes = async function(){
  const c=document.getElementById('content'); let rows=await api('quotes');
  c.innerHTML=`<div class="page"><div class="pageHead"><h2>Quote Register</h2><div><button id="newQuote">+ New Quote</button><button onclick="location.href='/api/exports/quotes'">Export CSV</button></div></div><section class="stats" id="quoteStats"></section><div class="quoteToolbar"><input id="search" placeholder="Search quote, client, site, scope..." /><select id="filter"><option value="">All Statuses</option><option>Draft</option><option>Sent</option><option>Awarded</option><option>Accepted</option><option>Rejected</option></select></div><div id="form"></div><div id="table"></div></div>`;
  function count(status){return rows.filter(q=>String(q.status||'Draft')===status).length;}
  function totalValue(list){return list.reduce((s,q)=>s+Number(q.total??qtotal(q)),0);}
  function draw(){
    document.getElementById('quoteStats').innerHTML=`${stat('Total Quotes',rows.length,money(totalValue(rows)))}${stat('Draft',count('Draft'),'not issued')}${stat('Sent',count('Sent'),'awaiting response')}${stat('Awarded',count('Awarded')+count('Accepted'),'won / ready')}${stat('Rejected',count('Rejected'),'closed','danger')}`;
    const q=(document.getElementById('search').value||'').toLowerCase(), st=document.getElementById('filter').value;
    const list=rows.filter(r=>(!st||String(r.status||'Draft')===st)&&[r.quote_number,r.client,r.site,r.scope,r.id].join(' ').toLowerCase().includes(q));
    document.getElementById('table').innerHTML=`<table><thead><tr><th>Quote</th><th>Client / Site</th><th>Status</th><th>Value</th><th>Actions</th></tr></thead><tbody>${list.map(r=>`<tr><td><b>${safe(r.quote_number||r.id)}</b><br><small>${safe(r.id||'')}</small></td><td><b>${safe(r.client||'')}</b><br>${safe(r.site||'')}<br><small>${safe(r.scope||'')}</small></td><td><span class="tag">${safe(r.status||'Draft')}</span></td><td><b>${money(r.total??qtotal(r))}</b></td><td><div class="actions"><button data-edit="${r.id}">Edit</button><button data-print="${r.id}">Print / PDF</button><button data-status="Sent" data-id="${r.id}">Mark Sent</button><button data-status="Awarded" data-id="${r.id}">Accept</button><button data-convert="${r.id}">Convert to Job</button><button class="dangerBtn" data-del="${r.id}">Delete</button></div></td></tr>`).join('')}</tbody></table>${!list.length?'<div class="empty">No quotes found.</div>':''}`;
    document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>quoteForm(rows.find(r=>String(r.id)===String(b.dataset.edit))));
    document.querySelectorAll('[data-print]').forEach(b=>b.onclick=()=>printQuote(rows.find(r=>String(r.id)===String(b.dataset.print))));
    document.querySelectorAll('[data-status]').forEach(b=>b.onclick=async()=>{await api('quotes/'+b.dataset.id,{method:'PUT',body:JSON.stringify({status:b.dataset.status})});rows=await api('quotes');draw();});
    document.querySelectorAll('[data-convert]').forEach(b=>b.onclick=async()=>{await api('quotes/'+b.dataset.convert+'/convert-to-job',{method:'POST'});rows=await api('quotes');alert('Quote converted to job');draw();});
    document.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(confirm('Delete quote?')){await api('quotes/'+b.dataset.del,{method:'DELETE'});rows=await api('quotes');draw();}});
  }
  document.getElementById('newQuote').onclick=()=>quoteForm({quote_number:'',client:'',site:'',status:'Draft',scope:'',items:[]});
  document.getElementById('search').oninput=draw; document.getElementById('filter').onchange=draw; draw();
}

async function jobsTracker(){
  const c=document.getElementById('content');
  let [jobs,tasks,schedules,staff,assets]=await Promise.all([api('jobs'),api('tasks'),api('schedules'),api('staff'),api('assets')]);
  c.innerHTML=`<div class="page"><div class="pageHead"><h2>Jobs Tracker</h2><button onclick="location.href='/api/exports/jobs'">Export Jobs CSV</button></div><section class="stats" id="jobStats"></section><div class="quoteToolbar"><input id="jobSearch" placeholder="Search job, client, site..." /><select id="jobPhase"><option value="">All Phases</option><option>Pre Install</option><option>Install</option><option>Complete</option></select></div><div id="jobs"></div></div>`;
  function jobTasks(jobId){return tasks.filter(t=>String(t.job_id)===String(jobId));}
  function taskDonePercent(jobId){const jt=jobTasks(jobId); if(!jt.length) return 0; return Math.round((jt.filter(t=>['Done','Complete','Completed'].includes(String(t.status))).length/jt.length)*100);}
  function renderOptions(list,labelField,valueField){return list.map(x=>`<option value="${safe(x[valueField]||x.id||x.short_name||x.asset_code)}">${safe(x[labelField]||x.display_name||x.full_name||x.name||x.id)}</option>`).join('');}
  async function reload(){[jobs,tasks,schedules,staff,assets]=await Promise.all([api('jobs'),api('tasks'),api('schedules'),api('staff'),api('assets')]);}
  function draw(){
    const q=(document.getElementById('jobSearch').value||'').toLowerCase(), phase=document.getElementById('jobPhase').value;
    const list=jobs.filter(j=>(!phase||String(j.current_phase||'Pre Install')===phase)&&[j.job_number,j.client,j.site,j.status,j.manager,j.id].join(' ').toLowerCase().includes(q));
    const avg=jobs.length?Math.round(jobs.reduce((s,j)=>s+Number(j.progress||taskDonePercent(j.id)||0),0)/jobs.length):0;
    document.getElementById('jobStats').innerHTML=`${stat('Jobs',jobs.length,'records')}${stat('Average Progress',avg+'%','all jobs')}${stat('Pre Install',jobs.filter(j=>(j.current_phase||'Pre Install')==='Pre Install').length,'pending')}${stat('Install',jobs.filter(j=>j.current_phase==='Install').length,'in progress')}${stat('Complete',jobs.filter(j=>j.current_phase==='Complete').length,'finished')}`;
    document.getElementById('jobs').innerHTML=list.map(j=>{const jt=jobTasks(j.id), progress=Number(j.progress||taskDonePercent(j.id)||0); return `<div class="record jobCard"><h3>${safe(j.job_number||j.id)}</h3><p><b>${safe(j.client||'')}</b><br>${safe(j.site||'')}</p><p><b>Quote Value:</b> ${money(j.quote_value||0)} <span class="tag">${safe(j.status||'Planned')}</span></p><div class="formGrid"><label>Phase<select data-phase="${safe(j.id)}"><option ${j.current_phase==='Pre Install'?'selected':''}>Pre Install</option><option ${j.current_phase==='Install'?'selected':''}>Install</option><option ${j.current_phase==='Complete'?'selected':''}>Complete</option></select></label><label>Progress <span id="p-${safe(j.id)}">${progress}%</span><input type="range" min="0" max="100" value="${progress}" data-progress="${safe(j.id)}"></label><label>New Task<input data-new-task="${safe(j.id)}" placeholder="Task name"></label><label>Schedule Day<select data-day="${safe(j.id)}"><option>Mon</option><option>Tue</option><option>Wed</option><option>Thu</option><option>Fri</option><option>Mon+</option><option>Tue+</option><option>Wed+</option><option>Thu+</option><option>Fri+</option></select></label><label>Staff<select data-staff="${safe(j.id)}"><option value="">No staff</option>${renderOptions(staff,'short_name','short_name')}</select></label><label>Asset<select data-asset="${safe(j.id)}"><option value="">No asset</option>${renderOptions(assets,'asset_code','asset_code')}</select></label></div><div class="actions"><button data-save-job="${safe(j.id)}">Save Job</button><button data-add-task="${safe(j.id)}">Add Task</button><button data-schedule-job="${safe(j.id)}">Push To Schedule</button></div><h4>Linked Tasks</h4><div>${jt.length?jt.map(t=>`<div class="miniRow"><span>${safe(t.name||t.title||t.task||'Task')}</span><select data-task-status="${safe(t.id)}"><option ${t.status==='Planned'?'selected':''}>Planned</option><option ${t.status==='In Progress'?'selected':''}>In Progress</option><option ${t.status==='Done'?'selected':''}>Done</option></select><button data-save-task="${safe(t.id)}">Save</button></div>`).join(''):'<div class="emptySmall">No tasks yet.</div>'}</div></div>`;}).join('')||'<div class="empty">No jobs found.</div>';
    document.querySelectorAll('[data-progress]').forEach(i=>i.oninput=()=>{const l=document.getElementById('p-'+i.dataset.progress); if(l) l.textContent=i.value+'%';});
    document.querySelectorAll('[data-save-job]').forEach(b=>b.onclick=async()=>{const id=b.dataset.saveJob, phase=document.querySelector(`[data-phase="${id}"]`).value, progress=Number(document.querySelector(`[data-progress="${id}"]`).value); await api('jobs/'+id,{method:'PUT',body:JSON.stringify({current_phase:phase,progress,status:progress>=100?'Complete':'Active'})}); await reload(); draw();});
    document.querySelectorAll('[data-add-task]').forEach(b=>b.onclick=async()=>{const id=b.dataset.addTask, inp=document.querySelector(`[data-new-task="${id}"]`), name=(inp.value||'').trim(); if(!name)return alert('Enter task name'); await api('tasks',{method:'POST',body:JSON.stringify({job_id:id,phase:document.querySelector(`[data-phase="${id}"]`).value,name,status:'Planned'})}); await reload(); draw();});
    document.querySelectorAll('[data-save-task]').forEach(b=>b.onclick=async()=>{const id=b.dataset.saveTask, status=document.querySelector(`[data-task-status="${id}"]`).value; await api('tasks/'+id,{method:'PUT',body:JSON.stringify({status})}); await reload(); draw();});
    document.querySelectorAll('[data-schedule-job]').forEach(b=>b.onclick=async()=>{const id=b.dataset.scheduleJob, job=jobs.find(j=>String(j.id)===String(id)), day=document.querySelector(`[data-day="${id}"]`).value, staffVal=document.querySelector(`[data-staff="${id}"]`).value, assetVal=document.querySelector(`[data-asset="${id}"]`).value, task=(document.querySelector(`[data-new-task="${id}"]`).value||job.current_phase||'Job Activity').trim(); await api('schedules',{method:'POST',body:JSON.stringify({job_id:id,site:job.site,task,day,status:'Planned',staff:staffVal?[staffVal]:[],assets:assetVal?[assetVal]:[]})}); alert('Scheduled activity created'); await reload(); draw();});
  }
  document.getElementById('jobSearch').oninput=draw; document.getElementById('jobPhase').onchange=draw; draw();
}

const originalModulePage = modulePage;
modulePage = function(name){
  if(name==='materials') return boqManager();
  if(name==='jobs') return jobsTracker();
  return originalModulePage(name);
};
