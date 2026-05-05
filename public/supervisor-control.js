// AMTEK Supervisor Control Centre
// Turns Reports into a management view for today's risks, crew issues, asset downtime and overdue work.

const supervisorModule = modules.find(m => m[0] === 'reports');
if (supervisorModule) supervisorModule[1] = 'Supervisor Control';

const modulePageBeforeSupervisor = modulePage;

async function supervisorControl(){
  const c = document.getElementById('content');
  let [jobs, schedules, staff, assets, tasks, actions, risks] = await Promise.all([api('jobs'), api('schedules'), api('staff'), api('assets'), api('tasks'), api('actions'), api('risks')]);
  const days = ['Mon','Tue','Wed','Thu','Fri','Mon+','Tue+','Wed+','Thu+','Fri+'];

  c.innerHTML = `<div class="page"><div class="pageHead"><h2>Supervisor Control Centre</h2><button id="refreshSupervisor">Refresh</button></div><section class="stats" id="supervisorStats"></section><div class="quoteToolbar"><select id="supDay">${days.map(d=>`<option>${d}</option>`).join('')}</select><select id="supFilter"><option value="">All Issues</option><option>Asset</option><option>Staff</option><option>Task</option><option>Defect</option><option>Risk</option></select><input id="supSearch" placeholder="Search job, asset, staff, risk..."></div><div id="supervisorBoard"></div></div>`;

  function jobById(id){return jobs.find(j=>String(j.id)===String(id));}
  function assetByCode(code){return assets.find(a=>String(a.asset_code||a.code)===String(code));}
  function openTasks(){return tasks.filter(t=>!['Done','Complete','Completed'].includes(String(t.status)));}
  function openDefects(){return actions.filter(a=>String(a.workflow_type)==='Defect' && String(a.status)!=='Closed' && String(a.status)!=='Resolved');}
  function openRisks(){return risks.filter(r=>String(r.status||'Open')!=='Closed');}
  async function reload(){[jobs, schedules, staff, assets, tasks, actions, risks] = await Promise.all([api('jobs'), api('schedules'), api('staff'), api('assets'), api('tasks'), api('actions'), api('risks')]);}

  function buildIssues(day){
    const issues = [];
    const dayRows = schedules.filter(s=>String(s.day)===day);
    const assetBookings = {};
    const staffBookings = {};
    dayRows.forEach(s=>{
      (s.assets||[]).forEach(a=>{assetBookings[a]=(assetBookings[a]||[]).concat(s)});
      (s.staff||[]).forEach(x=>{staffBookings[x]=(staffBookings[x]||[]).concat(s)});
    });
    Object.entries(assetBookings).filter(([,v])=>v.length>1).forEach(([code,rows])=>issues.push({type:'Asset',severity:'High',title:`Asset double booked: ${code}`,detail:rows.map(r=>r.site||r.task).join(' / '),asset:assetByCode(code)}));
    Object.entries(staffBookings).filter(([,v])=>v.length>1).forEach(([person,rows])=>issues.push({type:'Staff',severity:'High',title:`Staff double booked: ${person}`,detail:rows.map(r=>r.site||r.task).join(' / ')}));
    assets.filter(a=>a.status==='Out of Service').forEach(a=>issues.push({type:'Asset',severity:'Critical',title:`Asset out of service: ${a.asset_code||a.code}`,detail:a.name||a.display_name,asset:a}));
    openDefects().forEach(a=>issues.push({type:'Defect',severity:a.priority||'Medium',title:a.title||'Open defect',detail:a.notes||a.asset_code||'',action:a}));
    openTasks().filter(t=>String(t.status)==='Planned').forEach(t=>issues.push({type:'Task',severity:'Medium',title:`Open task: ${t.name||t.title||t.task||'Task'}`,detail:`Job ${t.job_id||''} - ${t.status||''}`,task:t}));
    openRisks().forEach(r=>issues.push({type:'Risk',severity:r.severity||'Medium',title:r.risk||r.title||'Open risk',detail:r.job_id||r.status||'',risk:r}));
    return issues;
  }

  function draw(){
    const day = document.getElementById('supDay').value;
    const filter = document.getElementById('supFilter').value;
    const q = (document.getElementById('supSearch').value||'').toLowerCase();
    let issues = buildIssues(day);
    if(filter) issues = issues.filter(i=>i.type===filter);
    issues = issues.filter(i=>[i.type,i.severity,i.title,i.detail,i.asset?.asset_code,i.asset?.name].join(' ').toLowerCase().includes(q));
    const critical = issues.filter(i=>i.severity==='Critical').length;
    const high = issues.filter(i=>i.severity==='High').length;
    document.getElementById('supervisorStats').innerHTML = `${stat('Issues',issues.length,day,issues.length?'danger':'')}${stat('Critical',critical,'urgent',critical?'danger':'')}${stat('High',high,'priority',high?'danger':'')}${stat('Open Defects',openDefects().length,'field')}${stat('Out of Service',assets.filter(a=>a.status==='Out of Service').length,'assets','danger')}`;
    document.getElementById('supervisorBoard').innerHTML = issues.map(i=>`<div class="record"><div style="display:flex;gap:14px;align-items:flex-start">${i.asset?`<img src="${safe(i.asset.image||'/logo.png')}" style="width:120px;height:86px;object-fit:cover;border-radius:12px;border:1px solid #e5e7eb">`:''}<div><h3>${safe(i.title)}</h3><p><b>Type:</b> ${safe(i.type)} <b>Severity:</b> <span class="tag ${i.severity==='Critical'?'danger':''}">${safe(i.severity)}</span></p><p>${safe(i.detail||'')}</p></div></div></div>`).join('') || '<div class="empty">No supervisor issues for this view.</div>';
  }

  document.getElementById('supDay').onchange = draw;
  document.getElementById('supFilter').onchange = draw;
  document.getElementById('supSearch').oninput = draw;
  document.getElementById('refreshSupervisor').onclick = async()=>{await reload();draw();};
  draw();
}

modulePage = function(name){
  if(name === 'reports') return supervisorControl();
  return modulePageBeforeSupervisor(name);
};
