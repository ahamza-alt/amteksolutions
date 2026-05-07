// AMTEK Projects Conflict Fix
(function(){
  if (Array.isArray(modules)) { const m = modules.find(x => x[0] === 'jobs'); if (m) m[1] = 'Projects'; }
  const previousModulePage = modulePage;
  const apiSafe = async (path, fallback=[]) => { try { return await api(path); } catch(e) { console.warn('safe api fallback', path); return fallback; } };
  const esc = v => typeof safe === 'function' ? safe(v) : String(v ?? '');
  const moneySafe = v => typeof money === 'function' ? money(v) : '$' + Number(v||0).toFixed(2);

  async function projectsStable(){
    const c = document.getElementById('content');
    c.innerHTML = '<div class="page">Loading projects...</div>';
    let [jobs, quotes, boqItems, purchaseOrders, claims, variations, timesheets, schedules] = await Promise.all([
      apiSafe('jobs'), apiSafe('quotes'), apiSafe('boq-items'), apiSafe('purchase-orders'), apiSafe('claims'), apiSafe('variations'), apiSafe('timesheets'), apiSafe('schedules')
    ]);
    function quoteFor(job){ return quotes.find(q => String(q.id) === String(job.quote_id || job.source_quote_id)); }
    function jobBoq(job){
      const direct = boqItems.filter(x => String(x.job_id) === String(job.id));
      if (direct.length) return direct;
      const q = quoteFor(job);
      return (q?.items || []).map((it,i)=>({id:'quote-item-'+i, code:it.code||'', description:it.description||it.item||'Quote item', qty:it.qty||0, unit:it.unit||'', total:it.total||(Number(it.qty||0)*Number(it.rate||0))}));
    }
    async function reload(){ [jobs, quotes, boqItems, purchaseOrders, claims, variations, timesheets, schedules] = await Promise.all([apiSafe('jobs'), apiSafe('quotes'), apiSafe('boq-items'), apiSafe('purchase-orders'), apiSafe('claims'), apiSafe('variations'), apiSafe('timesheets'), apiSafe('schedules')]); }
    function drawList(){
      c.innerHTML = `<div class="page"><div class="pageHead"><h2>Projects</h2><div><button onclick="active='quotes';render()">Quotes / BOQ</button><button onclick="active='purchase-orders';render()">All Purchase Orders</button><button onclick="active='claims';render()">All Claims</button></div></div><section class="stats">${stat('Projects',jobs.length,'delivery dashboards')}${stat('Open POs',purchaseOrders.filter(p=>String(p.status||'Open')!=='Closed').length,'all jobs')}${stat('Claims',claims.length,'all jobs')}${stat('Variations',variations.length,'all jobs')}</section><div class="quoteToolbar"><input id="projectFixSearch" placeholder="Search project, client, site, quote..."></div><div id="projectFixBody"></div></div>`;
      document.getElementById('projectFixSearch').oninput = drawCards; drawCards();
    }
    function drawCards(){
      const q=(document.getElementById('projectFixSearch')?.value||'').toLowerCase();
      const list=jobs.filter(j=>[j.job_number,j.client,j.site,j.scope,j.quote_number,j.id].join(' ').toLowerCase().includes(q));
      document.getElementById('projectFixBody').innerHTML = `<div class="cards">${list.map(job=>{const boq=jobBoq(job), po=purchaseOrders.filter(x=>String(x.job_id)===String(job.id)), cl=claims.filter(x=>String(x.job_id)===String(job.id)), vr=variations.filter(x=>String(x.job_id)===String(job.id)), ts=timesheets.filter(x=>String(x.job_id)===String(job.id)); return `<div class="record"><div class="pageHead"><h3>${esc(job.job_number||job.id)}</h3><span class="tag">${esc(job.current_phase||'Project')}</span></div><p><b>${esc(job.client||'')}</b><br>${esc(job.site||'')}</p><p><b>BOQ:</b> ${boq.length} item(s)<br><b>POs:</b> ${po.length}<br><b>Claims:</b> ${cl.length}<br><b>Variations:</b> ${vr.length}<br><b>Timesheets:</b> ${ts.length}</p><div class="actions"><button data-open-project-fix="${esc(job.id)}">Open Job Dashboard</button></div></div>`;}).join('')}</div>`;
      document.querySelectorAll('[data-open-project-fix]').forEach(b=>b.onclick=()=>openJob(jobs.find(j=>String(j.id)===String(b.dataset.openProjectFix))));
    }
    function openJob(job){
      const q=quoteFor(job), boq=jobBoq(job), po=purchaseOrders.filter(x=>String(x.job_id)===String(job.id)), cl=claims.filter(x=>String(x.job_id)===String(job.id)), vr=variations.filter(x=>String(x.job_id)===String(job.id)), ts=timesheets.filter(x=>String(x.job_id)===String(job.id)), sched=schedules.filter(x=>String(x.job_id)===String(job.id));
      c.innerHTML = `<div class="page"><button id="projectsBack">← Back to Projects</button><div class="record"><div class="pageHead"><h2>${esc(job.job_number||job.id)} - ${esc(job.site||'')}</h2><span class="tag">Job Dashboard</span></div><p><b>Client:</b> ${esc(job.client||'')}<br><b>Quote:</b> ${esc(q?.quote_number||job.quote_id||'')}<br><b>Value:</b> ${moneySafe(job.quote_value||q?.total||0)}</p></div><section class="stats">${stat('BOQ',boq.length,'job items')}${stat('POs',po.length,'job orders')}${stat('Claims',cl.length,'job claims')}${stat('Variations',vr.length,'job variations')}${stat('Timesheets',ts.length,'job labour')}</section><div class="cards"><div class="record"><h3>Job BOQ / Materials</h3><small>Main BOQ/Materials is the global master library. These are this job's delivery items from the awarded quote.</small>${boq.map(i=>`<div class="miniRow"><span>${esc(i.code||'')} ${esc(i.description||'')}</span><span>${esc(i.qty||0)} ${esc(i.unit||'')}<br>${moneySafe(i.total||0)}</span></div>`).join('')||'<div class="emptySmall">No job BOQ items yet.</div>'}</div><div class="record"><h3>Purchase Orders</h3>${po.map(p=>`<div class="miniRow"><span>${esc(p.po_number||p.id)}<br><small>${esc(p.supplier||'Pending Supplier')}</small></span><span>${esc(p.status||'Open')}<br>${moneySafe(p.total||p.value||0)}</span></div>`).join('')||'<div class="emptySmall">No job purchase orders.</div>'}<button id="createJobPO">Create PO from BOQ</button></div><div class="record"><h3>Claims</h3>${cl.map(x=>`<div class="miniRow"><span>${esc(x.claim_number||x.id)}</span><span>${esc(x.status||'Draft')}<br>${moneySafe(x.total||x.value||0)}</span></div>`).join('')||'<div class="emptySmall">No job claims.</div>'}</div><div class="record"><h3>Variations</h3>${vr.map(x=>`<div class="miniRow"><span>${esc(x.title||x.description||'Variation')}</span><span>${esc(x.status||'Draft')}<br>${moneySafe(x.value||0)}</span></div>`).join('')||'<div class="emptySmall">No variations.</div>'}</div><div class="record"><h3>Timesheets</h3>${ts.map(x=>`<div class="miniRow"><span>${esc(x.employee||x.staff||x.staff_name||'Crew')}</span><span>${esc(x.hours||0)} hrs</span></div>`).join('')||'<div class="emptySmall">No labour captured.</div>'}</div><div class="record"><h3>Schedule / Field Actualisation</h3>${sched.map(x=>`<div class="miniRow"><span>${esc(x.day)} - ${esc(x.task||'')}</span><span>${esc((x.staff||[]).join(', '))}<br><small>${esc((x.assets||[]).join(', '))}</small></span></div>`).join('')||'<div class="emptySmall">No schedule allocations.</div>'}</div></div></div>`;
      document.getElementById('projectsBack').onclick=drawList;
      document.getElementById('createJobPO').onclick=async()=>{const item=boq[0]; if(!item) return alert('No BOQ/material items available for this job yet.'); await api('purchase-orders',{method:'POST',body:JSON.stringify({job_id:job.id,job_number:job.job_number,po_number:'PO-'+Date.now(),supplier:'Pending Supplier',description:item.description,status:'Draft',value:Number(item.total||0),total:Number(item.total||0),items:[item],created_at:new Date().toISOString()})}); await reload(); openJob(jobs.find(j=>String(j.id)===String(job.id))||job);};
    }
    drawList();
  }
  modulePage = function(name){ if (Array.isArray(modules)) { const m=modules.find(x=>x[0]==='jobs'); if(m)m[1]='Projects'; } if(name==='jobs') return projectsStable(); return previousModulePage(name); };
})();
