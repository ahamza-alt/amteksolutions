// AMTEK Integrated Enhancements
// BOQ + Quote Register + Jobs Tracker (clean override)

// ---------- BOQ ----------
async function boqManager(){
  const c=document.getElementById('content');
  let rows=await api('rate-library');

  c.innerHTML=`
    <div class="page">
      <div class="pageHead">
        <h2>BOQ / Materials Library</h2>
        <button id="addBoq">+ Add Item</button>
      </div>
      <input id="boqSearch" placeholder="Search..." />
      <div id="boqTable"></div>
    </div>
  `;

  function draw(){
    const q=(document.getElementById('boqSearch').value||'').toLowerCase();
    const list=rows.filter(r=>
      [r.code,r.description].join(' ').toLowerCase().includes(q)
    );

    document.getElementById('boqTable').innerHTML=`
      <table>
        <thead>
          <tr>
            <th>Code</th><th>Description</th><th>Rate</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(r=>`
            <tr>
              <td>${r.code}</td>
              <td><input data-code="${r.code}" data-field="description" value="${r.description||''}"></td>
              <td><input type="number" data-code="${r.code}" data-field="benchmarkDirectCostPerUnit" value="${r.rate||0}"></td>
              <td>
                <button data-save="${r.code}">Save</button>
                <button data-del="${r.code}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    document.querySelectorAll('[data-save]').forEach(b=>b.onclick=saveRow);
    document.querySelectorAll('[data-del]').forEach(b=>b.onclick=deleteRow);
  }

  async function saveRow(e){
    const code=e.target.dataset.save;
    const body={};
    document.querySelectorAll(`[data-code="${code}"]`).forEach(i=>{
      body[i.dataset.field]=i.type==='number'?Number(i.value):i.value;
    });
    await api('rate-library/'+code,{method:'PUT',body:JSON.stringify(body)});
    rows=await api('rate-library');
    draw();
  }

  async function deleteRow(e){
    const code=e.target.dataset.del;
    await api('rate-library/'+code,{method:'DELETE'});
    rows=await api('rate-library');
    draw();
  }

  document.getElementById('addBoq').onclick=async()=>{
    const code=prompt('Code?');
    if(!code) return;
    await api('rate-library',{method:'POST',body:JSON.stringify({code,description:'',benchmarkDirectCostPerUnit:0})});
    rows=await api('rate-library');
    draw();
  };

  document.getElementById('boqSearch').oninput=draw;
  draw();
}

// ---------- QUOTES ----------
quotes = async function(){
  const c=document.getElementById('content');
  let rows=await api('quotes');

  c.innerHTML=`
    <div class="page">
      <div class="pageHead">
        <h2>Quote Register</h2>
        <button id="newQuote">+ New Quote</button>
      </div>

      <input id="search" placeholder="Search..." />
      <select id="filter">
        <option value="">All</option>
        <option>Draft</option>
        <option>Sent</option>
        <option>Awarded</option>
        <option>Rejected</option>
      </select>

      <div id="form"></div>
      <div id="table"></div>
    </div>
  `;

  function draw(){
    const q=(document.getElementById('search').value||'').toLowerCase();
    const st=document.getElementById('filter').value;

    const list=rows.filter(r=>
      (!st||r.status===st) &&
      [r.client,r.site,r.scope].join(' ').toLowerCase().includes(q)
    );

    document.getElementById('table').innerHTML=`
      <table>
        <thead>
          <tr>
            <th>Client</th><th>Site</th><th>Status</th><th>Value</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(r=>`
            <tr>
              <td>${r.client}</td>
              <td>${r.site}</td>
              <td>${r.status||'Draft'}</td>
              <td>${money(r.total||0)}</td>
              <td>
                <button data-edit="${r.id}">Edit</button>
                <button data-del="${r.id}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{
      const q=rows.find(r=>r.id===b.dataset.edit);
      quoteForm(q);
    });

    document.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{
      await api('quotes/'+b.dataset.del,{method:'DELETE'});
      rows=await api('quotes');
      draw();
    });
  }

  // ✅ FIXED NEW QUOTE BUTTON
  document.getElementById('newQuote').onclick=()=>{
    quoteForm({
      quote_number:'',
      client:'',
      site:'',
      status:'Draft',
      scope:'',
      items:[]
    });
  };

  document.getElementById('search').oninput=draw;
  document.getElementById('filter').onchange=draw;
  draw();
}

// ---------- JOBS ----------
async function jobsTracker(){
  const c=document.getElementById('content');
  let rows=await api('jobs');

  c.innerHTML=`
    <div class="page">
      <h2>Jobs Tracker</h2>
      <div id="jobs"></div>
    </div>
  `;

  function draw(){
    document.getElementById('jobs').innerHTML=rows.map(j=>`
      <div class="record">
        <h3>${j.job_number}</h3>
        <p>${j.client} - ${j.site}</p>

        <select data-phase="${j.id}">
          <option ${j.current_phase==='Pre Install'?'selected':''}>Pre Install</option>
          <option ${j.current_phase==='Install'?'selected':''}>Install</option>
          <option ${j.current_phase==='Complete'?'selected':''}>Complete</option>
        </select>

        <input type="range" min="0" max="100" value="${j.progress||0}" data-progress="${j.id}">
        ${j.progress||0}%

        <button data-save="${j.id}">Save</button>
      </div>
    `).join('');

    document.querySelectorAll('[data-save]').forEach(b=>b.onclick=async()=>{
      const id=b.dataset.save;
      const phase=document.querySelector(`[data-phase="${id}"]`).value;
      const progress=document.querySelector(`[data-progress="${id}"]`).value;

      await api('jobs/'+id,{
        method:'PUT',
        body:JSON.stringify({current_phase:phase,progress:Number(progress)})
      });

      rows=await api('jobs');
      draw();
    });
  }

  draw();
}

// ---------- HOOK ----------
const originalModulePage = modulePage;

modulePage = function(name){
  if(name==='materials') return boqManager();
  if(name==='jobs') return jobsTracker();
  return originalModulePage(name);
};