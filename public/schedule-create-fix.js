// AMTEK Schedule Create Fix
// Restores add/edit daily activity workflow while keeping live field status on the scheduling board.

(function(){
  const previousModulePage = modulePage;
  const safeApi = async (p, fallback=[]) => { try { return await api(p); } catch(e) { console.warn('fallback', p, e.message); return fallback; } };
  const esc = v => typeof safe === 'function' ? safe(v) : String(v ?? '');
  const tag = (t,d=false) => `<span class="tag ${d?'danger':''}">${esc(t)}</span>`;
  const days = ['Mon','Tue','Wed','Thu','Fri','Mon+','Tue+','Wed+','Thu+','Fri+'];

  function isToday(day){ return String(day) === ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()]; }
  function stage(job){ return job?.current_phase || job?.stage || 'Pre-construction'; }
  function assetByCode(assets, code){ return assets.find(a => String(a.asset_code||a.code) === String(code)); }
  function actionFor(actions, scheduleId, type, ref){
    return actions.find(a => String(a.schedule_id) === String(scheduleId) && String(a.workflow_type) === String(type) && (!ref || String(a.asset_code||a.staff_code||'') === String(ref)));
  }

  async function scheduleBoard(){
    const c = document.getElementById('content');
    let [jobs, schedules, staff, assets, actions] = await Promise.all([safeApi('jobs'), safeApi('schedules'), safeApi('staff'), safeApi('assets'), safeApi('actions')]);
    c.innerHTML = `<div class="page"><div class="pageHead"><h2>Scheduling Board</h2><div><button id="newScheduleActivity">+ Add Activity</button><button id="refreshScheduleBoard">Refresh</button></div></div><section class="stats" id="schedStats"></section><div class="quoteToolbar"><select id="schedDay"><option value="">Full Week</option>${days.map(d=>`<option>${d}</option>`).join('')}</select><input id="schedSearch" placeholder="Search job, site, crew, plant..."></div><div id="scheduleForm"></div><div id="scheduleBoardBody"></div></div>`;

    async function reload(){ [jobs, schedules, staff, assets, actions] = await Promise.all([safeApi('jobs'), safeApi('schedules'), safeApi('staff'), safeApi('assets'), safeApi('actions')]); }
    function jobById(id){ return jobs.find(j => String(j.id) === String(id)); }
    function jobOptions(selected=''){ return jobs.map(j=>`<option value="${esc(j.id)}" ${String(j.id)===String(selected)?'selected':''}>${esc(j.job_number||j.id)} - ${esc(j.site||j.client||'')}</option>`).join(''); }
    function staffOptions(selected=[]){ return staff.map(s=>`<option value="${esc(s.short_name||s.id)}" ${selected.includes(s.short_name||s.id)?'selected':''}>${esc(s.short_name||s.full_name)} - ${esc(s.trade||s.role||'')}</option>`).join(''); }
    function assetOptions(selected=[]){ return assets.map(a=>`<option value="${esc(a.asset_code||a.code)}" ${selected.includes(a.asset_code||a.code)?'selected':''}>${esc(a.asset_code||a.code)} - ${esc(a.name||a.display_name||'')}</option>`).join(''); }

    function statusFor(s){
      const assetCodes = s.assets || [];
      const done = assetCodes.filter(code => actionFor(actions, s.id, 'Pre-start', code));
      const onsite = actionFor(actions, s.id, 'On Site Commencement');
      const overdue = isToday(s.day) && new Date().getHours() >= 10 && done.length < assetCodes.length;
      return { done, onsite, overdue, required: assetCodes.length };
    }

    function showForm(existing={day:'Mon',status:'Planned',staff:[],assets:[]}){
      document.getElementById('scheduleForm').innerHTML = `<div class="form"><h3>${existing.id?'Edit Activity':'Add Daily Activity'}</h3><div class="formGrid"><label>Day<select id="sfDay">${days.map(d=>`<option ${existing.day===d?'selected':''}>${d}</option>`).join('')}</select></label><label>Job / Project<select id="sfJob"><option value="">No job selected</option>${jobOptions(existing.job_id||'')}</select></label><label>Task / Activity<input id="sfTask" value="${esc(existing.task||'Site works')}"></label><label>Status<select id="sfStatus"><option ${existing.status==='Planned'?'selected':''}>Planned</option><option ${existing.status==='In Progress'?'selected':''}>In Progress</option><option ${existing.status==='Complete'?'selected':''}>Complete</option></select></label><label>Crew<select id="sfStaff" multiple size="6">${staffOptions(existing.staff||[])}</select></label><label>Fleet / Plant<select id="sfAssets" multiple size="6">${assetOptions(existing.assets||[])}</select></label></div><div class="actions"><button id="saveScheduleActivity">Save Activity</button><button id="cancelScheduleActivity">Cancel</button></div></div>`;
      document.getElementById('cancelScheduleActivity').onclick = () => document.getElementById('scheduleForm').innerHTML='';
      document.getElementById('saveScheduleActivity').onclick = async () => {
        const job = jobById(document.getElementById('sfJob').value) || {};
        const body = {
          day: document.getElementById('sfDay').value,
          job_id: document.getElementById('sfJob').value,
          site: job.site || existing.site || '',
          task: document.getElementById('sfTask').value || 'Site works',
          status: document.getElementById('sfStatus').value,
          staff: Array.from(document.getElementById('sfStaff').selectedOptions).map(o=>o.value),
          assets: Array.from(document.getElementById('sfAssets').selectedOptions).map(o=>o.value)
        };
        const bad = body.assets.map(code=>assetByCode(assets,code)).filter(a=>a && a.status === 'Out of Service');
        if (bad.length && !confirm('One or more selected assets are out of service. Save anyway?')) return;
        if (existing.id) await api('schedules/'+existing.id,{method:'PUT',body:JSON.stringify(body)});
        else await api('schedules',{method:'POST',body:JSON.stringify(body)});
        document.getElementById('scheduleForm').innerHTML=''; await reload(); draw();
      };
    }

    async function logField(s,type,extra={}){
      const j = jobById(s.job_id) || {};
      await api('actions',{method:'POST',body:JSON.stringify({workflow_type:type,title:extra.title||type,schedule_id:s.id,job_id:s.job_id||'',job_number:j.job_number||'',site:s.site||j.site||'',asset_code:extra.asset_code||'',staff_code:extra.staff_code||'',status:extra.status||'Complete',priority:'Normal',created_at:new Date().toISOString(),live_feed:true})});
    }

    function draw(){
      const filterDay = document.getElementById('schedDay').value;
      const q = (document.getElementById('schedSearch').value||'').toLowerCase();
      const visible = schedules.filter(s=>{ const j=jobById(s.job_id)||{}; const st=statusFor(s); return (!filterDay||s.day===filterDay) && [s.day,s.site,s.task,s.status,(s.staff||[]).join(' '),(s.assets||[]).join(' '),j.job_number,j.client,stage(j),st.onsite?'onsite':'',st.overdue?'overdue':''].join(' ').toLowerCase().includes(q); });
      const overdue = visible.filter(s=>statusFor(s).overdue).length;
      const onsite = visible.filter(s=>statusFor(s).onsite).length;
      const done = visible.reduce((n,s)=>n+statusFor(s).done.length,0);
      const req = visible.reduce((n,s)=>n+statusFor(s).required,0);
      document.getElementById('schedStats').innerHTML = `${stat('Activities',visible.length,'scheduled')}${stat('On Site',onsite,'commenced')}${stat('Pre-starts',done+'/'+req,'fleet checks')}${stat('Overdue',overdue,'after 10am',overdue?'danger':'')}`;
      document.getElementById('scheduleBoardBody').innerHTML = days.filter(d=>!filterDay||d===filterDay).map(day=>{ const rows=visible.filter(s=>s.day===day); return `<div class="record"><div class="pageHead"><h3>${day}</h3><button data-add-day="${day}">+ Add</button></div>${rows.map(s=>{ const j=jobById(s.job_id)||{}; const st=statusFor(s); return `<div class="record" style="margin:10px 0;background:#fafafa"><div class="pageHead"><div><h3>${esc(j.job_number||s.job_id||'Activity')} - ${esc(s.site||j.site||'')}</h3><p>${esc(stage(j))} - ${esc(s.task||'')}</p></div><div>${st.onsite?tag('ON SITE'):tag('NOT STARTED',st.overdue)} ${st.overdue?tag('PRE-START OVERDUE',true):''}</div></div><div class="miniRow"><span><b>Crew:</b> ${esc((s.staff||[]).join(', ')||'None')}<br><b>Fleet:</b> ${esc((s.assets||[]).join(', ')||'None')}</span><span><button data-edit-schedule="${esc(s.id)}">Edit</button><button data-delete-schedule="${esc(s.id)}" class="dangerBtn">Delete</button></span></div><h4>Fleet Pre-starts</h4>${(s.assets||[]).map(code=>{ const ok=actionFor(actions,s.id,'Pre-start',code); return `<div class="miniRow"><span>${esc(code)} ${ok?tag('Complete'):tag('Missing',st.overdue)}</span><button data-prestart="${esc(s.id)}" data-asset="${esc(code)}">Complete Pre-start</button></div>`; }).join('') || '<div class="emptySmall">No fleet assigned.</div>'}<div class="actions"><button data-onsite="${esc(s.id)}">Commence Work On Site</button><button data-workdone="${esc(s.id)}">Complete Work</button></div></div>`; }).join('') || '<div class="emptySmall">No works scheduled.</div>'}</div>`; }).join('');
      document.querySelectorAll('[data-add-day]').forEach(b=>b.onclick=()=>showForm({day:b.dataset.addDay,status:'Planned',staff:[],assets:[]}));
      document.querySelectorAll('[data-edit-schedule]').forEach(b=>b.onclick=()=>showForm(schedules.find(s=>String(s.id)===String(b.dataset.editSchedule))));
      document.querySelectorAll('[data-delete-schedule]').forEach(b=>b.onclick=async()=>{ if(confirm('Delete scheduled activity?')){ await api('schedules/'+b.dataset.deleteSchedule,{method:'DELETE'}); await reload(); draw(); } });
      document.querySelectorAll('[data-prestart]').forEach(b=>b.onclick=async()=>{ const s=schedules.find(x=>String(x.id)===String(b.dataset.prestart)); await logField(s,'Pre-start',{asset_code:b.dataset.asset,title:'Pre-start complete - '+b.dataset.asset}); await reload(); draw(); });
      document.querySelectorAll('[data-onsite]').forEach(b=>b.onclick=async()=>{ const s=schedules.find(x=>String(x.id)===String(b.dataset.onsite)); await logField(s,'On Site Commencement',{title:'Crew commenced work on site',status:'In Progress'}); await api('schedules/'+s.id,{method:'PUT',body:JSON.stringify({status:'In Progress',commenced_at:new Date().toISOString()})}); await reload(); draw(); });
      document.querySelectorAll('[data-workdone]').forEach(b=>b.onclick=async()=>{ const s=schedules.find(x=>String(x.id)===String(b.dataset.workdone)); await logField(s,'Work Complete',{title:'Scheduled works completed'}); await api('schedules/'+s.id,{method:'PUT',body:JSON.stringify({status:'Complete',completed_at:new Date().toISOString()})}); await reload(); draw(); });
    }

    document.getElementById('newScheduleActivity').onclick=()=>showForm({day:'Mon',status:'Planned',staff:[],assets:[]});
    document.getElementById('refreshScheduleBoard').onclick=async()=>{await reload();draw();};
    document.getElementById('schedDay').onchange=draw;
    document.getElementById('schedSearch').oninput=draw;
    draw();
  }

  modulePage = function(name){ if(name==='schedules') return scheduleBoard(); return previousModulePage(name); };
})();
