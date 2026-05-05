// AMTEK Performance Control
// Turns Risks into a performance / profitability / downtime view.

const performanceModule = modules.find(m => m[0] === 'risks');
if (performanceModule) performanceModule[1] = 'Performance';

const modulePageBeforePerformance = modulePage;

async function performanceControl(){
  const c = document.getElementById('content');
  let [jobs, tasks, schedules, assets, actions, timesheets, variations, claims] = await Promise.all([
    api('jobs'), api('tasks'), api('schedules'), api('assets'), api('actions'), api('timesheets'), api('variations'), api('claims')
  ]);

  c.innerHTML = `<div class="page"><div class="pageHead"><h2>Performance Control</h2><button id="refreshPerformance">Refresh</button></div><section class="stats" id="perfStats"></section><div class="quoteToolbar"><input id="perfSearch" placeholder="Search job, site, asset, issue..."><select id="perfFilter"><option value="">All Signals</option><option>Job Risk</option><option>Asset Downtime</option><option>Open Defect</option><option>Commercial</option></select></div><div id="perfBoard"></div></div>`;

  function jobTasks(id){return tasks.filter(t=>String(t.job_id)===String(id));}
  function jobSchedules(id){return schedules.filter(s=>String(s.job_id)===String(id));}
  function openDefects(){return actions.filter(a=>a.workflow_type==='Defect' && !['Closed','Resolved'].includes(String(a.status)));}
  function assetByCode(code){return assets.find(a=>String(a.asset_code||a.code)===String(code));}
  async function reload(){[jobs,tasks,schedules,assets,actions,timesheets,variations,claims]=await Promise.all([api('jobs'),api('tasks'),api('schedules'),api('assets'),api('actions'),api('timesheets'),api('variations'),api('claims')]);}

  function buildSignals(){
    const signals=[];
    jobs.forEach(j=>{
      const jt=jobTasks(j.id);
      const js=jobSchedules(j.id);
      const open=jt.filter(t=>!['Done','Complete','Completed'].includes(String(t.status))).length;
      const assetCodes=[...new Set(js.flatMap(s=>s.assets||[]).concat(j.asset_code?[j.asset_code]:[]).filter(Boolean))];
      const badAsset=assetCodes.map(assetByCode).find(a=>a&&a.status==='Out of Service');
      if(!js.length) signals.push({type:'Job Risk',severity:'High',title:`No schedule linked: ${j.job_number||j.id}`,detail:j.site||j.client||'',job:j});
      if(open>=3) signals.push({type:'Job Risk',severity:'Medium',title:`Open tasks building: ${j.job_number||j.id}`,detail:`${open} open tasks`,job:j});
      if(!assetCodes.length) signals.push({type:'Job Risk',severity:'Medium',title:`No asset assigned: ${j.job_number||j.id}`,detail:j.site||'',job:j});
      if(badAsset) signals.push({type:'Asset Downtime',severity:'Critical',title:`Job blocked by asset: ${badAsset.asset_code||badAsset.code}`,detail:`${j.job_number||j.id} - ${j.site||''}`,asset:badAsset,job:j});
    });
    assets.filter(a=>a.status==='Out of Service').forEach(a=>signals.push({type:'Asset Downtime',severity:'Critical',title:`Asset downtime: ${a.asset_code||a.code}`,detail:a.name||a.display_name||'',asset:a}));
    openDefects().forEach(d=>signals.push({type:'Open Defect',severity:d.priority||'Medium',title:d.title||'Open defect',detail:d.notes||d.asset_code||'',defect:d,asset:assetByCode(d.asset_code)}));
    variations.filter(v=>!['Approved','Rejected','Closed'].includes(String(v.status))).forEach(v=>signals.push({type:'Commercial',severity:'Medium',title:`Open variation: ${v.description||v.id}`,detail:`${v.job_id||''} ${money(v.value||0)}`,variation:v}));
    claims.filter(cl=>!['Approved','Rejected','Closed'].includes(String(cl.status))).forEach(cl=>signals.push({type:'Commercial',severity:'High',title:`Open claim: ${cl.description||cl.id}`,detail:`${cl.job_id||''} ${money(cl.value||0)}`,claim:cl}));
    return signals;
  }

  function draw(){
    const q=(document.getElementById('perfSearch').value||'').toLowerCase();
    const f=document.getElementById('perfFilter').value;
    let signals=buildSignals();
    if(f) signals=signals.filter(s=>s.type===f);
    signals=signals.filter(s=>[s.type,s.severity,s.title,s.detail,s.asset?.asset_code,s.job?.job_number].join(' ').toLowerCase().includes(q));
    document.getElementById('perfStats').innerHTML=`${stat('Signals',signals.length,'active',signals.length?'danger':'')}${stat('Critical',signals.filter(s=>s.severity==='Critical').length,'urgent','danger')}${stat('Jobs',jobs.length,'tracked')}${stat('Downtime',assets.filter(a=>a.status==='Out of Service').length,'assets','danger')}${stat('Open Defects',openDefects().length,'field')}`;
    document.getElementById('perfBoard').innerHTML=signals.map(s=>`<div class="record"><div style="display:flex;gap:14px;align-items:flex-start">${s.asset?`<img src="${safe(s.asset.image||'/logo.png')}" style="width:120px;height:86px;object-fit:cover;border-radius:12px;border:1px solid #e5e7eb">`:''}<div><h3>${safe(s.title)}</h3><p><b>${safe(s.type)}</b> <span class="tag ${s.severity==='Critical'?'danger':''}">${safe(s.severity)}</span></p><p>${safe(s.detail||'')}</p><div class="actions">${s.asset?`<button data-return-asset="${safe(s.asset.id)}">Return Asset Active</button>`:''}${s.defect?`<button data-close-defect="${safe(s.defect.id)}">Resolve Defect</button>`:''}</div></div></div></div>`).join('')||'<div class="empty">No performance signals for this view.</div>';
    document.querySelectorAll('[data-return-asset]').forEach(b=>b.onclick=async()=>{await api('assets/'+b.dataset.returnAsset,{method:'PUT',body:JSON.stringify({status:'Active'})});await reload();draw();});
    document.querySelectorAll('[data-close-defect]').forEach(b=>b.onclick=async()=>{await api('actions/'+b.dataset.closeDefect,{method:'PUT',body:JSON.stringify({status:'Resolved'})});await reload();draw();});
  }
  document.getElementById('perfSearch').oninput=draw;
  document.getElementById('perfFilter').onchange=draw;
  document.getElementById('refreshPerformance').onclick=async()=>{await reload();draw();};
  draw();
}

modulePage=function(name){if(name==='risks')return performanceControl();return modulePageBeforePerformance(name);};
