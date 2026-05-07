// AMTEK Job Commercial Flow
// Adds practical job-specific actions: create PO, variation, timesheet and claim from inside a job dashboard.

(function(){
  const previousModulePage = modulePage;
  const apiSafe = async (p, fallback=[]) => { try { return await api(p); } catch(e) { return fallback; } };
  const esc = v => typeof safe === 'function' ? safe(v) : String(v ?? '');
  const moneySafe = v => typeof money === 'function' ? money(v) : '$' + Number(v||0).toFixed(2);
  const today = () => new Date().toISOString().slice(0,10);

  async function jobCommercialProjects(){
    const c = document.getElementById('content');
    c.innerHTML = '<div class="page">Loading project commercial dashboards...</div>';
    let [jobs, quotes, purchaseOrders, claims, variations, timesheets, schedules, suppliers] = await Promise.all([
      apiSafe('jobs'), apiSafe('quotes'), apiSafe('purchase-orders'), apiSafe('claims'), apiSafe('variations'), apiSafe('timesheets'), apiSafe('schedules'), apiSafe('suppliers')
    ]);

    function quoteFor(job){ return quotes.find(q => String(q.id) === String(job.quote_id || job.source_quote_id)); }
    function jobItems(job){
      const q = quoteFor(job);
      return (q?.items || []).map((it,i)=>({id:'quote-item-'+i, code:it.code||'', description:it.description||it.item||'Quote item', qty:Number(it.qty||0), unit:it.unit||'', rate:Number(it.rate||0), total:Number(it.total || (Number(it.qty||0)*Number(it.rate||0)))}));
    }
    async function reload(){
      [jobs, quotes, purchaseOrders, claims, variations, timesheets, schedules, suppliers] = await Promise.all([apiSafe('jobs'), apiSafe('quotes'), apiSafe('purchase-orders'), apiSafe('claims'), apiSafe('variations'), apiSafe('timesheets'), apiSafe('schedules'), apiSafe('suppliers')]);
    }

    function drawList(){
      c.innerHTML = `<div class="page"><div class="pageHead"><h2>Projects</h2><div><button onclick="active='quotes';render()">Quotes / BOQ</button><button onclick="active='purchase-orders';render()">All POs</button><button onclick="active='claims';render()">All Claims</button></div></div><section class="stats">${stat('Projects',jobs.length,'job dashboards')}${stat('POs',purchaseOrders.length,'global register')}${stat('Claims',claims.length,'global register')}${stat('Variations',variations.length,'global register')}</section><div class="quoteToolbar"><input id="jcfSearch" placeholder="Search project, client, site..."></div><div id="jcfBody"></div></div>`;
      document.getElementById('jcfSearch').oninput = drawCards;
      drawCards();
    }
    function drawCards(){
      const q = (document.getElementById('jcfSearch')?.value || '').toLowerCase();
      const list = jobs.filter(j => [j.job_number,j.client,j.site,j.scope,j.id].join(' ').toLowerCase().includes(q));
      document.getElementById('jcfBody').innerHTML = `<div class="cards">${list.map(job=>{const po=purchaseOrders.filter(x=>String(x.job_id)===String(job.id));const cl=claims.filter(x=>String(x.job_id)===String(job.id));const vr=variations.filter(x=>String(x.job_id)===String(job.id));const ts=timesheets.filter(x=>String(x.job_id)===String(job.id));return `<div class="record"><div class="pageHead"><h3>${esc(job.job_number||job.id)}</h3><span class="tag">${esc(job.current_phase||'Project')}</span></div><p><b>${esc(job.client||'')}</b><br>${esc(job.site||'')}</p><p><b>POs:</b> ${po.length}<br><b>Claims:</b> ${cl.length}<br><b>Variations:</b> ${vr.length}<br><b>Timesheets:</b> ${ts.length}</p><button data-open-jcf="${esc(job.id)}">Open Job Dashboard</button></div>`;}).join('')}</div>`;
      document.querySelectorAll('[data-open-jcf]').forEach(b=>b.onclick=()=>openJob(jobs.find(j=>String(j.id)===String(b.dataset.openJcf))));
    }

    function openJob(job){
      const q = quoteFor(job);
      const items = jobItems(job);
      const po = purchaseOrders.filter(x=>String(x.job_id)===String(job.id));
      const cl = claims.filter(x=>String(x.job_id)===String(job.id));
      const vr = variations.filter(x=>String(x.job_id)===String(job.id));
      const ts = timesheets.filter(x=>String(x.job_id)===String(job.id));
      const sched = schedules.filter(x=>String(x.job_id)===String(job.id));
      const completedScheduleValue = sched.filter(s=>String(s.status)==='Complete').length * 1000;
      const timesheetValue = ts.reduce((sum,t)=>sum + (Number(t.hours||0) * Number(t.rate||95)),0);
      const poValue = po.reduce((sum,p)=>sum + Number(p.total||p.value||0),0);
      const varValue = vr.reduce((sum,v)=>sum + Number(v.value||0),0);
      const claimedValue = cl.reduce((sum,x)=>sum + Number(x.total||x.value||0),0);

      c.innerHTML = `<div class="page"><button id="jcfBack">← Back to Projects</button><div class="record"><div class="pageHead"><h2>${esc(job.job_number||job.id)} - ${esc(job.site||'')}</h2><span class="tag">Commercial Job Dashboard</span></div><p><b>Client:</b> ${esc(job.client||'')}<br><b>Quote:</b> ${esc(q?.quote_number||job.quote_id||'')}<br><b>Quote Value:</b> ${moneySafe(job.quote_value||q?.total||0)}</p></div><section class="stats">${stat('Job BOQ',items.length,'quote items')}${stat('PO Spend',moneySafe(poValue),'procurement')}${stat('Variations',moneySafe(varValue),'approved/pending')}${stat('Timesheets',moneySafe(timesheetValue),'labour')}${stat('Claimed',moneySafe(claimedValue),'to date')}</section><div class="cards"><div class="record"><h3>Job BOQ / Materials</h3>${items.map((i,idx)=>`<div class="miniRow"><span>${esc(i.code||'')} ${esc(i.description)}</span><span>${esc(i.qty)} ${esc(i.unit)}<br>${moneySafe(i.total)}</span></div>`).join('')||'<div class="emptySmall">No quote/BOQ items linked.</div>'}</div><div class="record"><h3>Purchase Orders</h3>${po.map(p=>`<div class="miniRow"><span>${esc(p.po_number||p.id)}<br><small>${esc(p.supplier||'Pending Supplier')}</small></span><span>${esc(p.status||'Draft')}<br>${moneySafe(p.total||p.value||0)}</span></div>`).join('')||'<div class="emptySmall">No POs for this job.</div>'}<h4>Create PO from BOQ</h4><select id="jcfPoItem">${items.map((i,idx)=>`<option value="${idx}">${esc(i.description)} - ${moneySafe(i.total)}</option>`).join('')}</select><select id="jcfPoSupplier"><option value="">Pending Supplier</option>${suppliers.map(s=>`<option value="${esc(s.name||s.id)}">${esc(s.name||s.id)}</option>`).join('')}</select><button id="jcfCreatePO">Create PO</button></div><div class="record"><h3>Variations</h3>${vr.map(v=>`<div class="miniRow"><span>${esc(v.description||v.title||'Variation')}</span><span>${esc(v.status||'Draft')}<br>${moneySafe(v.value||0)}</span></div>`).join('')||'<div class="emptySmall">No variations.</div>'}<input id="jcfVarDesc" placeholder="Variation description"><input id="jcfVarValue" type="number" placeholder="Value"><button id="jcfCreateVariation">Add Variation</button></div><div class="record"><h3>Timesheets</h3>${ts.map(t=>`<div class="miniRow"><span>${esc(t.staff||t.employee||'Crew')}<br><small>${esc(t.day||today())}</small></span><span>${esc(t.hours||0)} hrs<br>${moneySafe(Number(t.hours||0)*Number(t.rate||95))}</span></div>`).join('')||'<div class="emptySmall">No job timesheets.</div>'}<input id="jcfStaff" placeholder="Staff / crew"><input id="jcfHours" type="number" placeholder="Hours"><input id="jcfRate" type="number" placeholder="Rate" value="95"><button id="jcfAddTimesheet">Add Timesheet</button></div><div class="record"><h3>Claims</h3>${cl.map(x=>`<div class="miniRow"><span>${esc(x.claim_number||x.id)}<br><small>${esc(x.status||'Draft')}</small></span><span>${moneySafe(x.total||x.value||0)}</span></div>`).join('')||'<div class="emptySmall">No claims for this job.</div>'}<button id="jcfCreateClaim">Generate Monthly Claim Draft</button><small>Claim draft uses completed schedule allowance + timesheets + variations, less already claimed.</small></div></div></div>`;

      document.getElementById('jcfBack').onclick=drawList;
      document.getElementById('jcfCreatePO').onclick=async()=>{const item=items[Number(document.getElementById('jcfPoItem').value||0)]; if(!item)return alert('No BOQ item selected.'); const supplier=document.getElementById('jcfPoSupplier').value||'Pending Supplier'; await api('purchase-orders',{method:'POST',body:JSON.stringify({job_id:job.id,job_number:job.job_number,po_number:'PO-'+Date.now(),supplier,description:item.description,status:'Draft',value:item.total,total:item.total,items:[item],created_at:new Date().toISOString()})}); await reload(); openJob(jobs.find(j=>String(j.id)===String(job.id))||job);};
      document.getElementById('jcfCreateVariation').onclick=async()=>{const description=document.getElementById('jcfVarDesc').value.trim(); const value=Number(document.getElementById('jcfVarValue').value||0); if(!description)return alert('Enter variation description.'); await api('variations',{method:'POST',body:JSON.stringify({job_id:job.id,job_number:job.job_number,description,value,status:'Draft',created_at:new Date().toISOString()})}); await reload(); openJob(jobs.find(j=>String(j.id)===String(job.id))||job);};
      document.getElementById('jcfAddTimesheet').onclick=async()=>{const staff=document.getElementById('jcfStaff').value.trim(); const hours=Number(document.getElementById('jcfHours').value||0); const rate=Number(document.getElementById('jcfRate').value||95); if(!staff||!hours)return alert('Enter staff and hours.'); await api('timesheets',{method:'POST',body:JSON.stringify({job_id:job.id,job_number:job.job_number,staff,hours,rate,day:today(),status:'Draft',created_at:new Date().toISOString()})}); await reload(); openJob(jobs.find(j=>String(j.id)===String(job.id))||job);};
      document.getElementById('jcfCreateClaim').onclick=async()=>{const total=Math.max(0, completedScheduleValue + timesheetValue + varValue - claimedValue); await api('claims',{method:'POST',body:JSON.stringify({job_id:job.id,job_number:job.job_number,claim_number:'CLM-'+Date.now(),description:'Monthly claim draft generated from completed works, timesheets and variations',status:'Draft',value:total,total,created_at:new Date().toISOString()})}); await reload(); openJob(jobs.find(j=>String(j.id)===String(job.id))||job);};
    }
    drawList();
  }

  modulePage=function(name){ if(Array.isArray(modules)){const m=modules.find(x=>x[0]==='jobs'); if(m)m[1]='Projects';} if(name==='jobs')return jobCommercialProjects(); return previousModulePage(name); };
})();
