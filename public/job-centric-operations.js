// AMTEK Job Centric Operations Layer
// Separates global operational registers from job specific delivery data.

const modulePageBeforeJobCentric = modulePage;

function jcoMoney(v){ return typeof money==='function' ? money(v) : '$'+Number(v||0).toFixed(2); }
function jcoArr(x){ return Array.isArray(x)?x:(x?[x]:[]); }

async function jobCentricProjects(){
  const c=document.getElementById('content');
  let [jobs,quotes,boqItems,purchaseOrders,claims,variations,timesheets,schedules,tasks,suppliers]=await Promise.all([
    api('jobs'),api('quotes'),api('boq-items'),api('purchase-orders'),api('claims'),api('variations'),api('timesheets'),api('schedules'),api('tasks'),api('suppliers')
  ]);

  c.innerHTML=`<div class="page"><div class="pageHead"><h2>Projects</h2><div><button onclick="active='quotes';render()">Quotes</button><button onclick="active='purchase-orders';render()">Global PO Register</button><button onclick="active='claims';render()">Global Claims</button></div></div><section class="stats" id="jcoStats"></section><div id="jcoProjects"></div></div>`;

  function quoteFor(job){ return quotes.find(q=>String(q.id)===String(job.quote_id||job.source_quote_id)); }
  function draw(){
    document.getElementById('jcoStats').innerHTML=`${stat('Projects',jobs.length,'delivery')}${stat('Open POs',purchaseOrders.filter(p=>p.status!=='Closed').length,'global')}${stat('Claims',claims.length,'global')}${stat('Variations',variations.length,'global')}`;
    document.getElementById('jcoProjects').innerHTML=`<div class="cards">${jobs.map(job=>{const po=purchaseOrders.filter(x=>String(x.job_id)===String(job.id));const cl=claims.filter(x=>String(x.job_id)===String(job.id));const vr=variations.filter(x=>String(x.job_id)===String(job.id));const ts=timesheets.filter(x=>String(x.job_id)===String(job.id));const boq=boqItems.filter(x=>String(x.job_id)===String(job.id));return `<div class="record"><div class="pageHead"><h3>${safe(job.job_number||job.id)}</h3><span class="tag">${safe(job.current_phase||'')}</span></div><p><b>${safe(job.client||'')}</b><br>${safe(job.site||'')}</p><p><b>BOQ:</b> ${boq.length} item(s)<br><b>POs:</b> ${po.length}<br><b>Claims:</b> ${cl.length}<br><b>Variations:</b> ${vr.length}<br><b>Timesheets:</b> ${ts.length}</p><div class="actions"><button data-jobdash="${safe(job.id)}">Open Job Dashboard</button></div></div>`;}).join('')}</div>`;
    document.querySelectorAll('[data-jobdash]').forEach(b=>b.onclick=()=>jobDashboard(jobs.find(j=>String(j.id)===String(b.dataset.jobdash))));
  }

  function jobDashboard(job){
    const q=quoteFor(job);
    const boq=boqItems.filter(x=>String(x.job_id)===String(job.id));
    const po=purchaseOrders.filter(x=>String(x.job_id)===String(job.id));
    const cl=claims.filter(x=>String(x.job_id)===String(job.id));
    const vr=variations.filter(x=>String(x.job_id)===String(job.id));
    const ts=timesheets.filter(x=>String(x.job_id)===String(job.id));
    const sched=schedules.filter(x=>String(x.job_id)===String(job.id));
    const tk=tasks.filter(x=>String(x.job_id)===String(job.id));

    document.getElementById('jcoProjects').innerHTML=`<button id="jcoBack">← Back to Projects</button><div class="record"><div class="pageHead"><h2>${safe(job.job_number||job.id)} - ${safe(job.site||'')}</h2><span class="tag">JOB DELIVERY DASHBOARD</span></div><p><b>Client:</b> ${safe(job.client||'')}<br><b>Quote:</b> ${safe(q?.quote_number||job.quote_id||'')}<br><b>Value:</b> ${jcoMoney(job.quote_value||q?.total||0)}</p></div><section class="stats">${stat('BOQ',boq.length,'job items')}${stat('POs',po.length,'job orders')}${stat('Claims',cl.length,'job claims')}${stat('Variations',vr.length,'job variations')}${stat('Timesheets',ts.length,'job labour')}</section><div class="cards"><div class="record"><h3>Job BOQ / Materials</h3><p><small>Main menu BOQ/Materials is the global master library. These are the actual job delivery items generated from the awarded quote.</small></p>${boq.map(i=>`<div class="miniRow"><span>${safe(i.code||'')} ${safe(i.description||'')}</span><span>${safe(i.qty||0)} ${safe(i.unit||'')}<br>${jcoMoney(i.total||0)}</span></div>`).join('')||'<div class="emptySmall">No BOQ items yet.</div>'}</div><div class="record"><h3>Purchase Orders (Job Specific)</h3>${po.map(p=>`<div class="miniRow"><span>${safe(p.po_number||p.id)}<br><small>${safe((suppliers.find(s=>String(s.id)===String(p.supplier_id))||{}).name||p.supplier||'')}</small></span><span>${safe(p.status||'Open')}<br>${jcoMoney(p.total||0)}</span></div>`).join('')||'<div class="emptySmall">No purchase orders.</div>'}<button id="jcoCreatePO">Create PO</button></div><div class="record"><h3>Claims (Job Specific)</h3>${cl.map(x=>`<div class="miniRow"><span>${safe(x.claim_number||x.id)}</span><span>${safe(x.status||'Draft')}<br>${jcoMoney(x.total||0)}</span></div>`).join('')||'<div class="emptySmall">No claims.</div>'}</div><div class="record"><h3>Variations</h3>${vr.map(x=>`<div class="miniRow"><span>${safe(x.title||x.description||'Variation')}</span><span>${safe(x.status||'Draft')}<br>${jcoMoney(x.value||0)}</span></div>`).join('')||'<div class="emptySmall">No variations.</div>'}</div><div class="record"><h3>Timesheets</h3>${ts.map(x=>`<div class="miniRow"><span>${safe(x.employee||x.staff_name||'Crew')}</span><span>${safe(x.hours||0)} hrs</span></div>`).join('')||'<div class="emptySmall">No labour captured.</div>'}</div><div class="record"><h3>Scheduling / Delivery</h3>${sched.map(x=>`<div class="miniRow"><span>${safe(x.day)} - ${safe(x.task||'')}</span><span>${safe((x.staff||[]).join(', '))}</span></div>`).join('')||'<div class="emptySmall">No allocations.</div>'}<h4>Delivery Logic</h4><small>Quote → BOQ → Scheduling → Actualised Works → Claims</small></div></div>`;

    document.getElementById('jcoBack').onclick=draw;
    document.getElementById('jcoCreatePO').onclick=async()=>{
      const material=boq[0];
      if(!material) return alert('No BOQ items available for this job yet.');
      const poRec={job_id:job.id,job_number:job.job_number,po_number:'PO-'+Date.now(),supplier:'Pending Supplier',status:'Draft',total:Number(material.total||0),items:[material],created_at:new Date().toISOString()};
      await api('purchase-orders',{method:'POST',body:JSON.stringify(poRec)});
      [jobs,quotes,boqItems,purchaseOrders,claims,variations,timesheets,schedules,tasks,suppliers]=await Promise.all([api('jobs'),api('quotes'),api('boq-items'),api('purchase-orders'),api('claims'),api('variations'),api('timesheets'),api('schedules'),api('tasks'),api('suppliers')]);
      jobDashboard(jobs.find(j=>String(j.id)===String(job.id))||job);
    };
  }

  draw();
}

modulePage=function(name){ if(name==='jobs') return jobCentricProjects(); return modulePageBeforeJobCentric(name); };
