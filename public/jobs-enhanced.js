// Enhanced Job Tracking

jobs = async function(){
  const c = document.getElementById('content');
  let rows = await api('jobs');

  c.innerHTML = `
    <div class="page">
      <div class="pageHead">
        <h2>Jobs Tracker</h2>
      </div>
      <div id="jobList"></div>
    </div>
  `;

  function phaseOptions(current){
    const phases = ['Pre Install','Install','Complete'];
    return `<select data-phase="${current}">${phases.map(p=>`<option ${p===current?'selected':''}>${p}</option>`).join('')}</select>`;
  }

  function draw(){
    document.getElementById('jobList').innerHTML = rows.map(j=>`
      <div class="record">
        <h3>${j.job_number}</h3>
        <p>${j.client} - ${j.site}</p>
        <p><b>Phase:</b> ${phaseOptions(j.current_phase)}</p>
        <p><b>Progress:</b> <input type="range" min="0" max="100" value="${j.progress||0}" data-progress="${j.id}"> ${j.progress||0}%</p>
        <p><b>Quote Value:</b> ${money(j.quote_value)}</p>
        <div class="actions">
          <button data-save="${j.id}">Save</button>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('[data-save]').forEach(btn=>btn.onclick=save);
  }

  async function save(e){
    const id = e.target.dataset.save;
    const container = e.target.closest('.record');
    const phase = container.querySelector('select').value;
    const progress = container.querySelector('[data-progress]').value;

    await api('jobs/'+id,{method:'PUT',body:JSON.stringify({current_phase:phase,progress:Number(progress)})});
    rows = await api('jobs');
    draw();
  }

  draw();
}
