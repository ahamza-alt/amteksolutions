// AMTEK Quote / BOQ to Project Delivery Engine
// Tightens commercial to delivery handover: quote register, BOQ assumptions, project creation and initial delivery pack.

const modulePageBeforeQuoteProjectEngine = modulePage;

function qpeTotal(q){
  if(typeof qtotal === 'function') return Number(q.total ?? qtotal(q) ?? 0);
  return Number(q.total || 0);
}
function qpeStageFromScope(scope=''){
  const s=String(scope).toLowerCase();
  if(s.includes('commission')) return 'Commissioning';
  if(s.includes('test')) return 'Testing';
  if(s.includes('signal') || s.includes('its') || s.includes('cctv')) return 'ITS / Signals';
  if(s.includes('electrical') || s.includes('lighting') || s.includes('public light')) return 'Electrical';
  if(s.includes('civil') || s.includes('trench') || s.includes('pit')) return 'Civil';
  return 'Pre-construction';
}
function qpeNeeds(scope=''){
  const s=String(scope).toLowerCase();
  const needs=[];
  if(s.includes('vedn') || s.includes('supply authority') || s.includes('citipower') || s.includes('jemena')) needs.push('VEDN');
  if(s.includes('signal') || s.includes('intersection') || s.includes('pedestrian')) needs.push('STS1');
  if(s.includes('commission')) needs.push('STCE');
  if(s.includes('cctv')) needs.push('STCV');
  return needs;
}
function qpeItems(q){ return Array.isArray(q.items) ? q.items : []; }
function qpeMoney(v){ return typeof money==='function' ? money(v) : '$'+Number(v||0).toFixed(2); }

async function quoteProjectEngine(){
  const c=document.getElementById('content');
  let [quotes, rateLibrary, jobs, schedules, tasks, documents, permits]=await Promise.all([api('quotes'),api('rate-library'),api('jobs'),api('schedules'),api('tasks'),api('documents'),api('permits')]);

  c.innerHTML=`<div class="page"><div class="pageHead"><h2>Quotes / BOQ</h2><div><button id="qpeNewQuote">+ New Quote</button><button onclick="location.href='/api/exports/quotes'">Export Quotes CSV</button></div></div><section class="stats" id="qpeStats"></section><div class="quoteToolbar"><input id="qpeSearch" placeholder="Search quote, client, site, scope..."><select id="qpeStatus"><option value="">All Statuses</option><option>Draft</option><option>Sent</option><option>Awarded</option><option>Accepted</option><option>Rejected</option></select></div><div id="form"></div><div id="qpeBody"></div></div>`;

  async function reload(){[quotes, rateLibrary, jobs, schedules, tasks, documents, permits]=await Promise.all([api('quotes'),api('rate-library'),api('jobs'),api('schedules'),api('tasks'),api('documents'),api('permits')]);}
  function linkedProject(q){return jobs.find(j=>String(j.quote_id)===String(q.id)||String(j.source_quote_id)===String(q.id));}
  function count(st){return quotes.filter(q=>String(q.status||'Draft')===st).length;}

  async function convertToProject(q){
    const existing=linkedProject(q);
    if(existing){ active='jobs'; render(); return; }
    const stage=qpeStageFromScope(q.scope||q.description||'');
    const needs=qpeNeeds([q.scope,q.description,q.client,q.site].join(' '));
    const project={
      job_number:`PRJ-${q.quote_number||q.id}`,
      client:q.client||'',
      site:q.site||'',
      scope:q.scope||q.description||'',
      status:'Active',
      current_phase:stage,
      progress:0,
      quote_id:q.id,
      source_quote_id:q.id,
      quote_number:q.quote_number||'',
      quote_value:qpeTotal(q),
      authority:q.authority||'',
      required_competencies:needs,
      commercial:{quote_id:q.id,quote_number:q.quote_number||'',value:qpeTotal(q),items:qpeItems(q)}
    };
    const created=await api('jobs',{method:'POST',body:JSON.stringify(project)});
    const jobId=created.id||created.job?.id||project.id||`job_${Date.now()}`;
    const starterTasks=[
      `${stage} planning / methodology`,
      'Confirm permits, drawings and authority requirements',
      'Allocate crew and fleet on scheduling board',
      'Prepare delivery documents / SWMS / ITP',
      'Complete field records and photos during works'
    ];
    for(const name of starterTasks){ await api('tasks',{method:'POST',body:JSON.stringify({job_id:jobId,phase:stage,name,status:'Planned',created_at:new Date().toISOString()})}); }
    await api('documents',{method:'POST',body:JSON.stringify({job_id:jobId,title:'Delivery Pack',type:'Project Pack',status:'Required',created_at:new Date().toISOString().slice(0,10)})});
    if(needs.length){ await api('permits',{method:'POST',body:JSON.stringify({job_id:jobId,title:`Competency / authority requirements: ${needs.join(', ')}`,status:'Required',created_at:new Date().toISOString().slice(0,10)})}); }
    await api('quotes/'+q.id,{method:'PUT',body:JSON.stringify({status:'Awarded',converted_to_project:jobId})});
    await reload();
    active='jobs'; render();
  }

  function draw(){
    const q=(document.getElementById('qpeSearch').value||'').toLowerCase();
    const st=document.getElementById('qpeStatus').value;
    const list=quotes.filter(r=>(!st||String(r.status||'Draft')===st)&&[r.quote_number,r.client,r.site,r.scope,r.description,r.id].join(' ').toLowerCase().includes(q));
    document.getElementById('qpeStats').innerHTML=`${stat('Quotes',quotes.length,qpeMoney(quotes.reduce((s,q)=>s+qpeTotal(q),0)))}${stat('Draft',count('Draft'),'estimating')}${stat('Sent',count('Sent'),'awaiting')}${stat('Awarded',count('Awarded')+count('Accepted'),'delivery')}${stat('Rate Library',rateLibrary.length,'BOQ items')}`;
    document.getElementById('qpeBody').innerHTML=`<table><thead><tr><th>Quote</th><th>Client / Site</th><th>Delivery Assumption</th><th>Value</th><th>Status</th><th>Actions</th></tr></thead><tbody>${list.map(r=>{const project=linkedProject(r); const stage=qpeStageFromScope(r.scope||r.description||''); const needs=qpeNeeds([r.scope,r.description,r.client,r.site].join(' ')); return `<tr><td><b>${safe(r.quote_number||r.id)}</b><br><small>${safe(r.id||'')}</small></td><td><b>${safe(r.client||'')}</b><br>${safe(r.site||'')}<br><small>${safe(r.scope||r.description||'')}</small></td><td><span class="tag">${safe(stage)}</span><br>${needs.map(n=>`<span class="tag">${safe(n)}</span>`).join('')||'<small>No authority competency flagged yet</small>'}</td><td><b>${qpeMoney(qpeTotal(r))}</b><br><small>${qpeItems(r).length} BOQ line(s)</small></td><td><span class="tag">${safe(r.status||'Draft')}</span>${project?'<br><span class="tag">Project Created</span>':''}</td><td><div class="actions"><button data-qpe-edit="${safe(r.id)}">Edit Quote</button><button data-qpe-print="${safe(r.id)}">Print / PDF</button><button data-qpe-status="Sent" data-id="${safe(r.id)}">Mark Sent</button><button data-qpe-convert="${safe(r.id)}">${project?'Open Project':'Convert to Project'}</button><button class="dangerBtn" data-qpe-del="${safe(r.id)}">Delete</button></div></td></tr>`;}).join('')}</tbody></table>`;
    document.querySelectorAll('[data-qpe-edit]').forEach(b=>b.onclick=()=>quoteForm(quotes.find(x=>String(x.id)===String(b.dataset.qpeEdit))));
    document.querySelectorAll('[data-qpe-print]').forEach(b=>b.onclick=()=>printQuote(quotes.find(x=>String(x.id)===String(b.dataset.qpePrint))));
    document.querySelectorAll('[data-qpe-status]').forEach(b=>b.onclick=async()=>{await api('quotes/'+b.dataset.id,{method:'PUT',body:JSON.stringify({status:b.dataset.qpeStatus})});await reload();draw();});
    document.querySelectorAll('[data-qpe-convert]').forEach(b=>b.onclick=()=>convertToProject(quotes.find(x=>String(x.id)===String(b.dataset.qpeConvert))));
    document.querySelectorAll('[data-qpe-del]').forEach(b=>b.onclick=async()=>{if(confirm('Delete quote?')){await api('quotes/'+b.dataset.qpeDel,{method:'DELETE'});await reload();draw();}});
  }

  document.getElementById('qpeNewQuote').onclick=()=>quoteForm({quote_number:'',client:'',site:'',status:'Draft',scope:'',items:[]});
  document.getElementById('qpeSearch').oninput=draw;
  document.getElementById('qpeStatus').onchange=draw;
  draw();
}

modulePage=function(name){ if(name==='quotes') return quoteProjectEngine(); return modulePageBeforeQuoteProjectEngine(name); };
