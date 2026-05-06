// AMTEK Operational Core Workspace
// Consolidates the app around AMTEK electrical infrastructure delivery: dashboard, projects, scheduling, fleet and staff competency.

(function(){
  const labels = {
    dashboard:'Ops Dashboard',
    quotes:'Quotes / BOQ',
    jobs:'Projects',
    schedules:'Scheduling Board',
    assets:'Fleet / Plant',
    staff:'Staff / Training Matrix',
    actions:'Field Records',
    documents:'Documents',
    permits:'Permits / Authorities'
  };
  if (Array.isArray(modules)) modules.forEach(m=>{ if(labels[m[0]]) m[1]=labels[m[0]]; });

  const previousModulePage = modulePage;

  function competencyFlags(person){
    const text=[person.role,person.trade,person.group,(person.training||[]).join(' '),(person.licences||[]).join(' '),(person.tickets||[]).join(' ')].join(' ').toLowerCase();
    return {
      STS1:text.includes('sts1'), STS2:text.includes('sts2'), STCE:text.includes('stce'), STCV:text.includes('stcv'), VEDN:text.includes('vedn'), Electrical:text.includes('electrical'), Civil:text.includes('civil')
    };
  }
  function competencyBadges(person){
    const c=competencyFlags(person);
    return Object.entries(c).filter(([,v])=>v).map(([k])=>`<span class="tag">${k}</span>`).join('') || '<span class="tag danger">Needs matrix update</span>';
  }
  function stageFor(job){return job.current_phase || job.stage || 'Pre-construction';}
  function jobTasks(tasks,id){return tasks.filter(t=>String(t.job_id)===String(id));}
  function donePct(tasks,id){const jt=jobTasks(tasks,id); if(!jt.length) return 0; return Math.round(jt.filter(t=>['Done','Complete','Completed'].includes(String(t.status))).length/jt.length*100);}
  function assetByCode(assets,code){return assets.find(a=>String(a.asset_code||a.code)===String(code));}

  async function opsDashboard(){
    const c=document.getElementById('content');
    const [jobs,schedules,assets,staff,tasks,quotes,actions]=await Promise.all([api('jobs'),api('schedules'),api('assets'),api('staff'),api('tasks'),api('quotes'),api('actions')]);
    const activeProjects=jobs.filter(j=>!['Complete','Closed'].includes(String(j.status)));
    const planned=schedules.filter(s=>['Mon','Tue','Wed','Thu','Fri'].includes(String(s.day)));
    const out=assets.filter(a=>a.status==='Out of Service');
    const openDefects=actions.filter(a=>a.workflow_type==='Defect'&&!['Closed','Resolved'].includes(String(a.status)));
    c.innerHTML=`<div class="page"><div class="pageHead"><h2>AMTEK Operational Dashboard</h2><div><button onclick="active='schedules';render()">Open Scheduling Board</button><button onclick="active='quotes';render()">New Quote / BOQ</button></div></div><section class="stats">${stat('Projects',activeProjects.length,'active delivery')}${stat('Scheduled Works',planned.length,'this week')}${stat('Fleet',assets.length,'plant / vehicles')}${stat('Staff',staff.length,'records')}${stat('Out of Service',out.length,'fleet blocks',out.length?'danger':'')}${stat('Open Defects',openDefects.length,'field records',openDefects.length?'danger':'')}</section><div class="cards"><div class="record"><h3>Core Workflow</h3><p><b>Quote / BOQ → Project → Stage → Schedule → Crew + Plant → Field Records → Completion</b></p><p>This version recentres the app around AMTEK electrical infrastructure construction, in-house civil/electrical crews, fleet allocation and authority-grade delivery.</p></div><div class="record"><h3>This Week</h3>${planned.slice(0,8).map(s=>`<div class="miniRow"><span><b>${safe(s.day)}</b> ${safe(s.site||'')} - ${safe(s.task||'')}</span><span>${safe((s.staff||[]).join(', '))}</span></div>`).join('')||'<div class="emptySmall">No scheduled works.</div>'}</div><div class="record"><h3>Fleet Blocks</h3>${out.map(a=>`<div class="miniRow"><img src="${safe(a.image||'/logo.png')}" style="width:54px;height:40px;object-fit:cover;border-radius:8px"><span>${safe(a.asset_code||a.code)} - ${safe(a.name||a.display_name)}</span></div>`).join('')||'<div class="emptySmall">No fleet blocks.</div>'}</div></div></div>`;
  }

  async function projectWorkspace(){
    const c=document.getElementById('content');
    let [jobs,tasks,schedules,assets,staff,quotes]=await Promise.all([api('jobs'),api('tasks'),api('schedules'),api('assets'),api('staff'),api('quotes')]);
    c.innerHTML=`<div class="page"><div class="pageHead"><h2>Projects</h2><button onclick="active='quotes';render()">Create / Convert from Quote</button></div><section class="stats" id="projectStats"></section><div class="quoteToolbar"><input id="projectSearch" placeholder="Search project, client, site, stage..."><select id="projectStage"><option value="">All Stages</option><option>Pre-construction</option><option>Civil</option><option>Electrical</option><option>ITS / Signals</option><option>Testing</option><option>Commissioning</option><option>Defects</option><option>Complete</option></select></div><div id="projectBoard"></div></div>`;
    async function reload(){[jobs,tasks,schedules,assets,staff,quotes]=await Promise.all([api('jobs'),api('tasks'),api('schedules'),api('assets'),api('staff'),api('quotes')]);}
    function draw(){
      const q=(document.getElementById('projectSearch').value||'').toLowerCase(), st=document.getElementById('projectStage').value;
      const list=jobs.filter(j=>(!st||stageFor(j)===st)&&[j.job_number,j.client,j.site,j.scope,j.status,stageFor(j)].join(' ').toLowerCase().includes(q));
      document.getElementById('projectStats').innerHTML=`${stat('Projects',jobs.length,'total')}${stat('Civil Stage',jobs.filter(j=>stageFor(j)==='Civil').length,'works')}${stat('Electrical',jobs.filter(j=>stageFor(j)==='Electrical').length,'works')}${stat('Commissioning',jobs.filter(j=>stageFor(j)==='Commissioning').length,'works')}${stat('Complete',jobs.filter(j=>stageFor(j)==='Complete').length,'closed')}`;
      document.getElementById('projectBoard').innerHTML=list.map(j=>{const pct=Number(j.progress||donePct(tasks,j.id)||0); const linked=schedules.filter(s=>String(s.job_id)===String(j.id)); return `<div class="record"><div class="pageHead"><h3>${safe(j.job_number||j.id)} - ${safe(j.site||j.client||'')}</h3><span class="tag">${safe(stageFor(j))}</span></div><p><b>Client:</b> ${safe(j.client||'')}<br><b>Value:</b> ${money(j.quote_value||j.total||0)} <b>Progress:</b> ${pct}%</p><div class="formGrid"><label>Stage<select data-stage="${safe(j.id)}"><option ${stageFor(j)==='Pre-construction'?'selected':''}>Pre-construction</option><option ${stageFor(j)==='Civil'?'selected':''}>Civil</option><option ${stageFor(j)==='Electrical'?'selected':''}>Electrical</option><option ${stageFor(j)==='ITS / Signals'?'selected':''}>ITS / Signals</option><option ${stageFor(j)==='Testing'?'selected':''}>Testing</option><option ${stageFor(j)==='Commissioning'?'selected':''}>Commissioning</option><option ${stageFor(j)==='Defects'?'selected':''}>Defects</option><option ${stageFor(j)==='Complete'?'selected':''}>Complete</option></select></label><label>Progress<input type="range" min="0" max="100" value="${pct}" data-project-progress="${safe(j.id)}"></label></div><h4>Scheduled Allocations</h4>${linked.map(s=>`<div class="miniRow"><span>${safe(s.day)} - ${safe(s.task||'')}</span><span>${safe((s.staff||[]).join(', '))} / ${safe((s.assets||[]).join(', '))}</span></div>`).join('')||'<div class="emptySmall">No scheduled allocations.</div>'}<div class="actions"><button data-save-project="${safe(j.id)}">Save Project</button><button data-open-schedule="${safe(j.id)}">Open Scheduling</button></div></div>`;}).join('')||'<div class="empty">No projects found.</div>';
      document.querySelectorAll('[data-save-project]').forEach(b=>b.onclick=async()=>{const id=b.dataset.saveProject;await api('jobs/'+id,{method:'PUT',body:JSON.stringify({current_phase:document.querySelector(`[data-stage="${CSS.escape(id)}"]`).value,progress:Number(document.querySelector(`[data-project-progress="${CSS.escape(id)}"]`).value)})});await reload();draw();});
      document.querySelectorAll('[data-open-schedule]').forEach(b=>b.onclick=()=>{active='schedules';render();});
    }
    document.getElementById('projectSearch').oninput=draw; document.getElementById('projectStage').onchange=draw; draw();
  }

  async function scheduleBoard(){
    const c=document.getElementById('content');
    let [jobs,schedules,staff,assets]=await Promise.all([api('jobs'),api('schedules'),api('staff'),api('assets')]);
    const days=['Mon','Tue','Wed','Thu','Fri','Mon+','Tue+','Wed+','Thu+','Fri+'];
    c.innerHTML=`<div class="page"><div class="pageHead"><h2>Weekly Scheduling Board</h2><button onclick="active='jobs';render()">Open Projects</button></div><section class="stats" id="scheduleStats"></section><div class="quoteToolbar"><select id="scheduleDay"><option value="">Full Week</option>${days.map(d=>`<option>${d}</option>`).join('')}</select><select id="scheduleStage"><option value="">All Stages</option><option>Civil</option><option>Electrical</option><option>ITS / Signals</option><option>Testing</option><option>Commissioning</option></select><input id="scheduleSearch" placeholder="Search project, site, crew, plant..."></div><div id="scheduleBoard"></div></div>`;
    function jobById(id){return jobs.find(j=>String(j.id)===String(id));}
    function draw(){
      const day=document.getElementById('scheduleDay').value, stage=document.getElementById('scheduleStage').value, q=(document.getElementById('scheduleSearch').value||'').toLowerCase();
      const filtered=schedules.filter(s=>{const j=jobById(s.job_id)||{}; return (!day||s.day===day)&&(!stage||stageFor(j)===stage)&&[s.day,s.site,s.task,(s.staff||[]).join(' '),(s.assets||[]).join(' '),j.job_number,j.client,stageFor(j)].join(' ').toLowerCase().includes(q);});
      const assetBookings={}; filtered.forEach(s=>(s.assets||[]).forEach(a=>assetBookings[a]=(assetBookings[a]||0)+1));
      const staffBookings={}; filtered.forEach(s=>(s.staff||[]).forEach(x=>staffBookings[x]=(staffBookings[x]||0)+1));
      document.getElementById('scheduleStats').innerHTML=`${stat('Allocations',filtered.length,'visible')}${stat('Crew Used',Object.keys(staffBookings).length,'people')}${stat('Plant Used',Object.keys(assetBookings).length,'assets')}${stat('Plant Clashes',Object.values(assetBookings).filter(n=>n>1).length,'double booked',Object.values(assetBookings).some(n=>n>1)?'danger':'')}${stat('Crew Clashes',Object.values(staffBookings).filter(n=>n>1).length,'double booked',Object.values(staffBookings).some(n=>n>1)?'danger':'')}`;
      document.getElementById('scheduleBoard').innerHTML=days.filter(d=>!day||d===day).map(d=>{const rows=filtered.filter(s=>s.day===d);return `<div class="record"><h3>${d}</h3>${rows.map(s=>{const j=jobById(s.job_id)||{};return `<div class="miniRow"><span><b>${safe(j.job_number||s.job_id||'')}</b> ${safe(s.site||j.site||'')}<br><small>${safe(stageFor(j))} - ${safe(s.task||'')}</small></span><span>${safe((s.staff||[]).join(', '))}<br><small>${safe((s.assets||[]).join(', '))}</small></span></div>`;}).join('')||'<div class="emptySmall">No works scheduled.</div>'}</div>`;}).join('');
    }
    document.getElementById('scheduleDay').onchange=draw;document.getElementById('scheduleStage').onchange=draw;document.getElementById('scheduleSearch').oninput=draw;draw();
  }

  async function staffMatrix(){
    const c=document.getElementById('content');
    let staff=await api('staff');
    c.innerHTML=`<div class="page"><div class="pageHead"><h2>Staff / Training Matrix</h2><button onclick="location.href='/api/exports/staff'">Export CSV</button></div><section class="stats">${stat('Staff',staff.length,'records')}${stat('Electrical',staff.filter(s=>String(s.trade).includes('Electrical')).length,'crew')}${stat('Civil',staff.filter(s=>String(s.trade).includes('Civil')).length,'crew')}${stat('Matrix Gaps',staff.filter(s=>!String((s.training||[]).join(' ')+(s.licences||[]).join(' ')+(s.tickets||[]).join(' ')).match(/STS|VEDN|STCE|STCV/i)).length,'need update','danger')}</section><div class="quoteToolbar"><input id="staffSearch" placeholder="Search staff, trade, role, licence..."></div><div id="staffMatrix"></div></div>`;
    function draw(){const q=(document.getElementById('staffSearch').value||'').toLowerCase();const list=staff.filter(s=>[s.full_name,s.short_name,s.role,s.trade,s.group,(s.training||[]).join(' '),(s.licences||[]).join(' '),(s.tickets||[]).join(' ')].join(' ').toLowerCase().includes(q));document.getElementById('staffMatrix').innerHTML=`<table><thead><tr><th>Staff</th><th>Role / Trade</th><th>Competencies</th><th>Status</th></tr></thead><tbody>${list.map(s=>`<tr><td><b>${safe(s.full_name)}</b><br><small>${safe(s.email||'')}</small></td><td>${safe(s.role||'')}<br><small>${safe(s.trade||'')}</small></td><td>${competencyBadges(s)}</td><td><span class="tag">${safe(s.status||'')}</span></td></tr>`).join('')}</tbody></table>`;}
    document.getElementById('staffSearch').oninput=draw;draw();
  }

  modulePage=function(name){
    if(name==='dashboard') return opsDashboard();
    if(name==='jobs') return projectWorkspace();
    if(name==='schedules') return scheduleBoard();
    if(name==='staff') return staffMatrix();
    return previousModulePage(name);
  };
})();
