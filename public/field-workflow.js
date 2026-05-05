// AMTEK Field Workflow
// Turns Actions into a field workflow for pre-starts, defects, photos and site updates.

const fieldModule = modules.find(m => m[0] === 'actions');
if(fieldModule) fieldModule[1] = 'Field Workflow';

const modulePageBeforeFieldWorkflow = modulePage;

async function fieldWorkflow(){
  const c = document.getElementById('content');
  let [jobs, assets, staff, actions, photos] = await Promise.all([api('jobs'), api('assets'), api('staff'), api('actions'), api('photos')]);

  c.innerHTML = `
    <div class="page">
      <div class="pageHead">
        <h2>Field Workflow</h2>
        <button onclick="location.href='/api/exports/actions'">Export Field Log CSV</button>
      </div>

      <section class="stats" id="fieldStats"></section>

      <div class="form fieldWorkflowForm">
        <h3>New Field Record</h3>
        <div class="formGrid">
          <label>Workflow Type
            <select id="fwType">
              <option>Pre-start</option>
              <option>Defect</option>
              <option>Site Photo</option>
              <option>Client Update</option>
              <option>Safety Observation</option>
            </select>
          </label>
          <label>Job
            <select id="fwJob"><option value="">No job / depot</option>${jobs.map(j=>`<option value="${safe(j.id)}">${safe(j.job_number||j.id)} - ${safe(j.site||j.client||'')}</option>`).join('')}</select>
          </label>
          <label>Asset
            <select id="fwAsset"><option value="">No asset</option>${assets.map(a=>`<option value="${safe(a.id)}">${safe(a.asset_code||a.code)} - ${safe(a.name||a.display_name||'')}</option>`).join('')}</select>
          </label>
          <label>Completed By
            <select id="fwStaff"><option value="">Select staff</option>${staff.map(s=>`<option value="${safe(s.short_name||s.id)}">${safe(s.short_name||s.full_name)} - ${safe(s.trade||s.role||'')}</option>`).join('')}</select>
          </label>
          <label>Severity
            <select id="fwSeverity"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select>
          </label>
          <label>Status
            <select id="fwStatus"><option>Open</option><option>Action Required</option><option>Closed</option></select>
          </label>
        </div>

        <div class="checkGrid">
          <label><input type="checkbox" id="chkVisual"> Visual condition checked</label>
          <label><input type="checkbox" id="chkFluid"> Fluids / leaks checked</label>
          <label><input type="checkbox" id="chkLights"> Lights / beacons checked</label>
          <label><input type="checkbox" id="chkSafety"> Safety equipment checked</label>
        </div>

        <textarea id="fwNotes" placeholder="Notes, defect details, site update, or inspection comments..."></textarea>
        <input id="fwPhoto" placeholder="Photo URL or image reference (optional)">
        <div class="actions"><button id="saveFieldRecord">Save Field Record</button></div>
      </div>

      <div class="quoteToolbar">
        <input id="fieldSearch" placeholder="Search field logs...">
        <select id="fieldFilter"><option value="">All Types</option><option>Pre-start</option><option>Defect</option><option>Site Photo</option><option>Client Update</option><option>Safety Observation</option></select>
      </div>
      <div id="fieldLog"></div>
    </div>
  `;

  function assetById(id){return assets.find(a=>String(a.id)===String(id));}
  function jobById(id){return jobs.find(j=>String(j.id)===String(id));}
  async function reload(){[jobs, assets, staff, actions, photos] = await Promise.all([api('jobs'), api('assets'), api('staff'), api('actions'), api('photos')]);}

  function draw(){
    document.getElementById('fieldStats').innerHTML = `
      ${stat('Field Logs', actions.length, 'records')}
      ${stat('Pre-starts', actions.filter(a=>a.workflow_type==='Pre-start').length, 'checks')}
      ${stat('Defects', actions.filter(a=>a.workflow_type==='Defect').length, 'reported', actions.some(a=>a.workflow_type==='Defect' && a.status!=='Closed')?'danger':'')}
      ${stat('Photos', photos.length, 'site records')}
    `;

    const q = (document.getElementById('fieldSearch').value || '').toLowerCase();
    const type = document.getElementById('fieldFilter').value;
    const list = actions.filter(a => {
      const hay = [a.workflow_type,a.title,a.owner,a.status,a.priority,a.asset_code,a.job_number,a.site,a.notes].join(' ').toLowerCase();
      return (!type || a.workflow_type === type) && hay.includes(q);
    });

    document.getElementById('fieldLog').innerHTML = list.map(a => `
      <div class="record">
        <h3>${safe(a.workflow_type || 'Field Record')} - ${safe(a.title || '')}</h3>
        <p><b>Status:</b> <span class="tag">${safe(a.status || '')}</span> <b>Severity:</b> ${safe(a.priority || '')}</p>
        <p><b>Job:</b> ${safe(a.job_number || a.job_id || 'Depot / none')}<br><b>Asset:</b> ${safe(a.asset_code || 'None')}<br><b>By:</b> ${safe(a.owner || '')}</p>
        <p>${safe(a.notes || '')}</p>
        ${a.photo_url ? `<img src="${safe(a.photo_url)}" style="width:170px;height:120px;object-fit:cover;border-radius:14px;border:1px solid #e5e7eb">` : ''}
        <div class="actions"><button data-close-action="${safe(a.id)}">Close</button><button class="dangerBtn" data-delete-action="${safe(a.id)}">Delete</button></div>
      </div>
    `).join('') || '<div class="empty">No field records yet.</div>';

    document.querySelectorAll('[data-close-action]').forEach(b=>b.onclick=async()=>{await api('actions/'+b.dataset.closeAction,{method:'PUT',body:JSON.stringify({status:'Closed'})}); await reload(); draw();});
    document.querySelectorAll('[data-delete-action]').forEach(b=>b.onclick=async()=>{if(confirm('Delete field record?')){await api('actions/'+b.dataset.deleteAction,{method:'DELETE'}); await reload(); draw();}});
  }

  document.getElementById('saveFieldRecord').onclick = async()=>{
    const asset = assetById(document.getElementById('fwAsset').value);
    const job = jobById(document.getElementById('fwJob').value);
    const workflowType = document.getElementById('fwType').value;
    const photoUrl = document.getElementById('fwPhoto').value.trim();
    const notes = document.getElementById('fwNotes').value.trim();
    const priority = document.getElementById('fwSeverity').value;
    const status = document.getElementById('fwStatus').value;
    const checks = {
      visual: document.getElementById('chkVisual').checked,
      fluids: document.getElementById('chkFluid').checked,
      lights: document.getElementById('chkLights').checked,
      safety: document.getElementById('chkSafety').checked
    };

    const title = `${workflowType}${asset ? ' - ' + (asset.asset_code || asset.code) : ''}`;
    await api('actions',{method:'POST',body:JSON.stringify({
      workflow_type: workflowType,
      title,
      owner: document.getElementById('fwStaff').value,
      priority,
      status,
      job_id: job?.id || '',
      job_number: job?.job_number || '',
      site: job?.site || asset?.site || '',
      asset_id: asset?.id || '',
      asset_code: asset?.asset_code || asset?.code || '',
      notes,
      checks,
      photo_url: photoUrl,
      created_at: new Date().toISOString()
    })});

    if(photoUrl){
      await api('photos',{method:'POST',body:JSON.stringify({job_id:job?.id||'',title, url:photoUrl,status:'Filed', asset_code:asset?.asset_code||asset?.code||'', day:new Date().toISOString().slice(0,10)})});
    }

    if(asset && workflowType === 'Defect'){
      const defects = asset.profile?.defects || [];
      const profile = {...(asset.profile||{}), defects:[{title, date:new Date().toISOString().slice(0,10), status, severity:priority, notes}, ...defects]};
      const nextStatus = priority === 'Critical' ? 'Out of Service' : asset.status;
      await api('assets/'+asset.id,{method:'PUT',body:JSON.stringify({profile,status:nextStatus})});
    }

    document.getElementById('fwNotes').value='';
    document.getElementById('fwPhoto').value='';
    await reload();
    draw();
  };

  document.getElementById('fieldSearch').oninput = draw;
  document.getElementById('fieldFilter').onchange = draw;
  draw();
}

modulePage = function(name){
  if(name === 'actions') return fieldWorkflow();
  return modulePageBeforeFieldWorkflow(name);
};
