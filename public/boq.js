// BOQ override
const originalModulePage = modulePage;

modulePage = async function(name){
  if(name==='materials') return boqPage();
  return originalModulePage(name);
}

async function boqPage(){
  const c=document.getElementById('content');
  let items = await api('rate-library');

  c.innerHTML = `
    <div class="page">
      <div class="pageHead">
        <h2>BOQ / Materials Library</h2>
        <div>
          <button id="addItem">+ Add Item</button>
          <button onclick="location.href='/api/exports/rate-library'">Export CSV</button>
        </div>
      </div>
      <input id="search" placeholder="Search library..." />
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Description</th>
            <th>Unit</th>
            <th>Rate</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
  `;

  function draw(filter=''){
    const f = filter.toLowerCase();
    const filtered = items.filter(i => (i.description||'').toLowerCase().includes(f) || (i.code||'').toLowerCase().includes(f));
    document.getElementById('rows').innerHTML = filtered.map(i => `
      <tr>
        <td>${i.code}</td>
        <td><input data-k="description" data-id="${i.code}" value="${i.description||''}" /></td>
        <td><input data-k="unit" data-id="${i.code}" value="${i.unit||''}" /></td>
        <td><input type="number" step="0.01" data-k="benchmarkDirectCostPerUnit" data-id="${i.code}" value="${i.rate||0}" /></td>
        <td>
          <button data-save="${i.code}">Save</button>
          <button data-del="${i.code}" class="dangerBtn">Delete</button>
        </td>
      </tr>
    `).join('');

    document.querySelectorAll('[data-save]').forEach(b=>b.onclick=saveRow);
    document.querySelectorAll('[data-del]').forEach(b=>b.onclick=deleteRow);
  }

  async function saveRow(e){
    const code = e.target.dataset.save;
    const row = {};
    document.querySelectorAll(`[data-id="${code}"]`).forEach(inp=>{
      row[inp.dataset.k] = inp.type==='number'?Number(inp.value):inp.value;
    });
    await api('rate-library/'+encodeURIComponent(code),{method:'PUT',body:JSON.stringify(row)});
    items = await api('rate-library');
    draw(document.getElementById('search').value);
  }

  async function deleteRow(e){
    const code = e.target.dataset.del;
    if(!confirm('Delete item?')) return;
    await api('rate-library/'+encodeURIComponent(code),{method:'DELETE'});
    items = await api('rate-library');
    draw(document.getElementById('search').value);
  }

  document.getElementById('search').oninput = (e)=>draw(e.target.value);

  document.getElementById('addItem').onclick = async ()=>{
    const code = prompt('Code?');
    if(!code) return;
    await api('rate-library',{method:'POST',body:JSON.stringify({code,description:'',unit:'ea',benchmarkDirectCostPerUnit:0})});
    items = await api('rate-library');
    draw();
  };

  draw();
}
