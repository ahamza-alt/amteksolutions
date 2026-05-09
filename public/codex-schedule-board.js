// AMTEK Codex Style Schedule Board
// Replaces the basic schedule cards with a resource-sticker weekly planner while keeping existing data/actions.

(function(){
  const previousModulePage = modulePage;
  const apiSafe = async (p, fallback=[]) => { try { return await api(p); } catch(e) { console.warn('fallback', p, e.message); return fallback; } };
  const esc = v => typeof safe === 'function' ? safe(v) : String(v ?? '');
  const tag = (t,d=false) => `<span class="tag ${d?'danger':''}">${esc(t)}</span>`;
  const days = ['Mon','Tue','Wed','Thu','Fri'];
  const nextDays = ['Mon+','Tue+','Wed+','Thu+','Fri+'];
  const allDays = [...days, ...nextDays];
  const todayName = () => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
  const stage = j => j?.current_phase || j?.stage || 'Pre-construction';
  const initials = s => String(s||'').split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase() || '??';
  const assetCode = a => a.asset_code || a.code || a.id;
  const staffCode = s => s.short_name || s.employee_id || s.id;
  const actionFor = (actions,sid,type,ref) => actions.find(a => String(a.schedule_id)===String(sid) && String(a.workflow_type)===String(type) && (!ref || String(a.asset_code||a.staff_code||'')===String(ref)));

  async function codexSchedule(){
    const c = document.getElementById('content');
    let [jobs,schedules,staff,assets,actions,crews] = await Promise.all([apiSafe('jobs'),apiSafe('schedules'),apiSafe('staff'),apiSafe('assets'),apiSafe('actions'),apiSafe('crews')]);

    c.innerHTML = `<div class="codexPlanner"><div class="codexMain"><div class="codexToolbar"><div><h2>Master Schedule - 1 Week View</h2><small>Electrical infrastructure construction planner</small></div><div class="codexControls"><button id="prevWeek">‹</button><button id="nextWeek">›</button><button id="todayBtn">Today</button><select id="siteFilter"><option value="">All Sites</option>${jobs.map(j=>`<option value="${esc(j.id)}">${esc(j.site||j.job_number||j.id)}</option>`).join('')}</select><button id="newCodexActivity">+ New Activity</button></div></div><div class="resourceShelf"><div class="resourceHelp"><b>Resource stickers</b><span>Use the cards to quickly see plant, crews and staff available for scheduling.</span></div><div class="stickerRow" id="plantStickers"></div><div class="stickerRow" id="crewStickers"></div><div class="stickerRow" id="staffStickers"></div></div><div id="codexForm"></div><div id="codexGrid"></div></div><aside class="codexRail"><div class="railCard"><div class="railHead"><b>Live Tracking</b><button id="runSheets">Run sheets</button></div><div class="railStats" id="liveStats"></div><div id="liveFeed"></div></div><div class="railCard"><div class="railHead"><b>Exceptions & Alerts</b><button id="viewAllAlerts">View all</button></div><div id="exceptionList"></div></div></aside></div>`;

    async function reload(){ [jobs,schedules,staff,assets,actions,crews] = await Promise.all([apiSafe('jobs'),apiSafe('schedules'),apiSafe('staff'),apiSafe('assets'),apiSafe('actions'),apiSafe('crews')]); }
    const jobById = id => jobs.find(j=>String(j.id)===String(id));
    const staffByCode = code => staff.find(s=>String(staffCode(s))===String(code));
    const assetByCode = code => assets.find(a=>String(assetCode(a))===String(code));
    const scheduleStatus = s => {
      const assetList = s.assets || [];
      const preDone = assetList.filter(code => actionFor(actions,s.id,'Pre-start',code));
      const onsite = actionFor(actions,s.id,'On Site Commencement');
      const overdue = String(s.day)===todayName() && new Date().getHours()>=10 && preDone.length < assetList.length;
      return {preDone, onsite, overdue, required: assetList.length};
    };

    function renderStickers(){
      document.getElementById('plantStickers').innerHTML = assets.slice(0,12).map(a=>`<div class="assetSticker ${a.status==='Out of Service'?'unavailable':''}" title="${esc(a.status||'')}"><img src="${esc(a.image||'/logo.png')}"><b>${esc(assetCode(a))}</b></div>`).join('');
      document.getElementById('crewStickers').innerHTML = (crews.length?crews:[{name:'Civil Crew A',members:['AZ','BM','DE']},{name:'Electrical Crew B',members:['AI','AK','CC']},{name:'Mixed Works Crew C',members:['AZ','CC','DW']}]).slice(0,6).map(cr=>`<div class="crewSticker"><b>${esc(cr.name||cr.type||'Crew')}</b><span>${esc((cr.members||[]).join(', '))}</span></div>`).join('');
      document.getElementById('staffStickers').innerHTML = staff.slice(0,16).map(s=>`<div class="staffSticker ${['Sick','Leave','Unavailable','No Show'].includes(String(s.status))?'unavailable':''}"><span>${esc(initials(s.short_name||s.full_name))}</span><small>${esc(s.trade||s.role||'')}</small></div>`).join('');
    }

    function showForm(existing={day:'Mon',status:'Planned',staff:[],assets:[]}){
      document.getElementById('codexForm').innerHTML = `<div class="codexForm"><h3>${existing.id?'Edit Activity':'New Activity'}</h3><div class="formGrid"><label>Day<select id="cfDay">${allDays.map(d=>`<option ${existing.day===d?'selected':''}>${d}</option>`).join('')}</select></label><label>Job / Site<select id="cfJob"><option value="">No job</option>${jobs.map(j=>`<option value="${esc(j.id)}" ${String(j.id)===String(existing.job_id)?'selected':''}>${esc(j.job_number||j.id)} - ${esc(j.site||j.client||'')}</option>`).join('')}</select></label><label>Task<input id="cfTask" value="${esc(existing.task||'Site works')}"></label><label>Status<select id="cfStatus"><option ${existing.status==='Planned'?'selected':''}>Planned</option><option ${existing.status==='In Progress'?'selected':''}>In Progress</option><option ${existing.status==='Complete'?'selected':''}>Complete</option><option ${existing.status==='Confirmed'?'selected':''}>Confirmed</option></select></label><label>Crew / Staff<select id="cfStaff" multiple size="7">${staff.map(s=>`<option value="${esc(staffCode(s))}" ${(existing.staff||[]).includes(staffCode(s))?'selected':''}>${esc(staffCode(s))} - ${esc(s.full_name||s.role||'')}</option>`).join('')}</select></label><label>Plant / Fleet<select id="cfAssets" multiple size="7">${assets.map(a=>`<option value="${esc(assetCode(a))}" ${(existing.assets||[]).includes(assetCode(a))?'selected':''}>${esc(assetCode(a))} - ${esc(a.display_name||a.name||'')}</option>`).join('')}</select></label></div><div class="actions"><button id="saveCodexActivity">Save Activity</button><button id="cancelCodexForm">Cancel</button></div></div>`;
      document.getElementById('cancelCodexForm').onclick = () => document.getElementById('codexForm').innerHTML='';
      document.getElementById('saveCodexActivity').onclick = async () => {
        const job = jobById(document.getElementById('cfJob').value)||{};
        const body = {day:document.getElementById('cfDay').value,job_id:document.getElementById('cfJob').value,site:job.site||existing.site||'',task:document.getElementById('cfTask').value,status:document.getElementById('cfStatus').value,staff:Array.from(document.getElementById('cfStaff').selectedOptions).map(o=>o.value),assets:Array.from(document.getElementById('cfAssets').selectedOptions).map(o=>o.value)};
        if(existing.id) await api('schedules/'+existing.id,{method:'PUT',body:JSON.stringify(body)}); else await api('schedules',{method:'POST',body:JSON.stringify(body)});
        document.getElementById('codexForm').innerHTML=''; await reload(); draw();
      };
    }

    async function logAction(s,type,extra={}){
      const j=jobById(s.job_id)||{};
      await api('actions',{method:'POST',body:JSON.stringify({workflow_type:type,title:extra.title||type,schedule_id:s.id,job_id:s.job_id||'',job_number:j.job_number||'',site:s.site||j.site||'',asset_code:extra.asset_code||'',staff_code:extra.staff_code||'',status:extra.status||'Complete',priority:'Normal',created_at:new Date().toISOString(),live_feed:true})});
    }

    function draw(){
      renderStickers();
      const filter = document.getElementById('siteFilter').value;
      const shownJobs = jobs.filter(j => !filter || String(j.id)===String(filter));
      const visibleSchedules = schedules.filter(s => !filter || String(s.job_id)===String(filter));
      const clashes = [];
      allDays.forEach(day=>{
        const sc={}, ac={};
        visibleSchedules.filter(s=>s.day===day).forEach(s=>{(s.staff||[]).forEach(x=>sc[x]=(sc[x]||0)+1);(s.assets||[]).forEach(x=>ac[x]=(ac[x]||0)+1);});
        Object.entries(sc).filter(([,n])=>n>1).forEach(([x])=>clashes.push(`Staff double booked: ${x} on ${day}`));
        Object.entries(ac).filter(([,n])=>n>1).forEach(([x])=>clashes.push(`Asset double booked: ${x} on ${day}`));
      });
      const overdue = visibleSchedules.filter(s=>scheduleStatus(s).overdue);
      const onsite = visibleSchedules.filter(s=>scheduleStatus(s).onsite);
      const preDone = visibleSchedules.reduce((n,s)=>n+scheduleStatus(s).preDone.length,0);
      const preReq = visibleSchedules.reduce((n,s)=>n+scheduleStatus(s).required,0);
      document.getElementById('liveStats').innerHTML = `<div><b>${visibleSchedules.length}</b><span>Today</span></div><div><b>${onsite.length}</b><span>On site</span></div><div><b>${preDone}</b><span>Done</span></div><div><b>${preReq}</b><span>Required</span></div><div><b>${overdue.length}</b><span>Alerts</span></div>`;
      document.getElementById('liveFeed').innerHTML = overdue.length ? overdue.map(s=>`<div class="railAlert danger">Pre-start overdue: ${esc(s.site||jobById(s.job_id)?.site||s.task)}</div>`).join('') : '<p class="muted">No live pre-start exceptions.</p>';
      document.getElementById('exceptionList').innerHTML = `${staff.filter(s=>['Sick','Leave','Unavailable','No Show'].includes(String(s.status))).slice(0,3).map(s=>`<div class="railAlert danger"><b>Staff absent</b><br>${esc(s.full_name||staffCode(s))} <small>${esc(s.status)}</small></div>`).join('')}${assets.filter(a=>a.status==='Out of Service').slice(0,4).map(a=>`<div class="railAlert warn"><b>Asset offline</b><br>${esc(assetCode(a))} <small>${esc(a.location||'Workshop')}</small></div>`).join('')}${clashes.slice(0,4).map(x=>`<div class="railAlert danger"><b>Resource clash</b><br>${esc(x)}</div>`).join('') || '<p class="muted">No active alerts.</p>'}`;
      document.getElementById('codexGrid').innerHTML = `<div class="codexGrid"><div class="codexHead siteCol">Site / Job</div>${days.map(d=>`<div class="codexHead">${esc(d)}${d===todayName()?'<small>Today</small>':''}</div>`).join('')}${shownJobs.map(j=>`<div class="siteBlock"><h3>${esc(j.site||j.job_number||j.id)}</h3><p>${esc(stage(j))}</p><small>${esc(j.job_number||j.id)}</small></div>${days.map(d=>{const cards=visibleSchedules.filter(s=>String(s.job_id)===String(j.id)&&s.day===d);return `<div class="codexCell">${cards.map(s=>{const st=scheduleStatus(s);return `<div class="workCard ${st.overdue?'clash':''}"><div class="workStatus">${esc(s.status||'Planned')}${st.overdue?'<b>Clash</b>':''}</div><div class="taskBox"><small>Tasks</small><b>${esc(s.task||'Site works')}</b></div><div class="chipRow">${(s.assets||[]).map(code=>{const a=assetByCode(code);return `<span class="plantChip">${a?`<img src="${esc(a.image||'/logo.png')}">`:''}${esc(code)}<button data-prestart="${esc(s.id)}" data-asset="${esc(code)}">x</button></span>`;}).join('')}</div><div class="chipRow">${(s.staff||[]).map(code=>`<span class="personChip">${esc(initials(code))}<button data-staffon="${esc(s.id)}" data-staff="${esc(code)}">x</button></span>`).join('')}</div><div class="workControls"><button data-edit="${esc(s.id)}">Edit</button><button data-onsite="${esc(s.id)}">On site</button></div></div>`;}).join('')}</div>`;}).join('')}`).join('')}</div>`;
      document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>showForm(schedules.find(s=>String(s.id)===String(b.dataset.edit))));
      document.querySelectorAll('[data-onsite]').forEach(b=>b.onclick=async()=>{const s=schedules.find(x=>String(x.id)===String(b.dataset.onsite));await logAction(s,'On Site Commencement',{title:'Crew commenced work on site',status:'In Progress'});await api('schedules/'+s.id,{method:'PUT',body:JSON.stringify({status:'In Progress',commenced_at:new Date().toISOString()})});await reload();draw();});
      document.querySelectorAll('[data-prestart]').forEach(b=>b.onclick=async()=>{const s=schedules.find(x=>String(x.id)===String(b.dataset.prestart));await logAction(s,'Pre-start',{asset_code:b.dataset.asset,title:'Pre-start complete - '+b.dataset.asset});await reload();draw();});
      document.querySelectorAll('[data-staffon]').forEach(b=>b.onclick=async()=>{const s=schedules.find(x=>String(x.id)===String(b.dataset.staffon));await logAction(s,'Staff Onsite',{staff_code:b.dataset.staff,title:b.dataset.staff+' actualised onsite'});await reload();draw();});
    }

    document.getElementById('newCodexActivity').onclick=()=>showForm({day:'Mon',status:'Planned',staff:[],assets:[]});
    document.getElementById('siteFilter').onchange=draw;
    document.getElementById('todayBtn').onclick=draw;
    document.getElementById('prevWeek').onclick=draw;
    document.getElementById('nextWeek').onclick=draw;
    setInterval(async()=>{ if(active==='schedules'){ await reload(); draw(); } },30000);
    draw();
  }

  modulePage = function(name){ if(name==='schedules') return codexSchedule(); return previousModulePage(name); };
})();
