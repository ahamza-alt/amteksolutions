// Quote register enhancement
// Keeps the existing quote builder/output functions, but gives Quotes a proper register workflow.

quotes = async function(){
  const c = document.getElementById('content');
  let rows = await api('quotes');

  c.innerHTML = `
    <div class="page quoteRegisterPage">
      <div class="pageHead">
        <h2>Quote Register</h2>
        <div>
          <button id="newQuote">+ New Quote</button>
          <button onclick="location.href='/api/exports/quotes'">Export Register CSV</button>
        </div>
      </div>

      <section class="stats quoteStats" id="quoteStats"></section>

      <div class="quoteToolbar">
        <input id="quoteSearch" placeholder="Search quote number, client, site, scope...">
        <select id="quoteFilter">
          <option value="">All Statuses</option>
          <option>Draft</option>
          <option>Sent</option>
          <option>Awarded</option>
          <option>Accepted</option>
          <option>Rejected</option>
        </select>
      </div>

      <div id="form"></div>
      <div id="quoteRegister"></div>
    </div>
  `;

  function totalValue(list){
    return list.reduce((sum,q)=>sum+Number(q.total ?? qtotal(q)),0);
  }

  function statusCount(status){
    return rows.filter(q=>String(q.status||'Draft')===status).length;
  }

  function drawStats(){
    document.getElementById('quoteStats').innerHTML = `
      ${stat('Total Quotes', rows.length, money(totalValue(rows)))}
      ${stat('Draft', statusCount('Draft'), 'not issued')}
      ${stat('Sent', statusCount('Sent'), 'awaiting response')}
      ${stat('Awarded', statusCount('Awarded') + statusCount('Accepted'), 'ready / converted')}
      ${stat('Rejected', statusCount('Rejected'), 'closed', 'danger')}
    `;
  }

  function rowStatus(q){
    return String(q.status || 'Draft');
  }

  function filteredRows(){
    const qstr = (document.getElementById('quoteSearch')?.value || '').toLowerCase();
    const st = document.getElementById('quoteFilter')?.value || '';
    return rows.filter(q => {
      const hay = [q.quote_number,q.client,q.site,q.scope,q.status,q.id].join(' ').toLowerCase();
      return (!st || rowStatus(q)===st) && hay.includes(qstr);
    });
  }

  function draw(){
    drawStats();
    const list = filteredRows();
    document.getElementById('quoteRegister').innerHTML = `
      <table class="quoteRegisterTable">
        <thead>
          <tr>
            <th>Quote</th>
            <th>Client / Site</th>
            <th>Status</th>
            <th>Value</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(q=>`
            <tr>
              <td><b>${safe(q.quote_number || q.id)}</b><br><small>${safe(q.id || '')}</small></td>
              <td><b>${safe(q.client || '')}</b><br>${safe(q.site || '')}<br><small>${safe(q.scope || '')}</small></td>
              <td><span class="tag">${safe(rowStatus(q))}</span></td>
              <td><b>${money(q.total ?? qtotal(q))}</b></td>
              <td><small>${safe(q.updated_at ? new Date(q.updated_at).toLocaleString() : '')}</small></td>
              <td>
                <div class="actions stackedActions">
                  <button data-edit="${q.id}">Open / Edit</button>
                  <button data-print="${q.id}">Print / PDF</button>
                  <button data-status="Sent" data-id="${q.id}">Mark Sent</button>
                  <button data-status="Accepted" data-id="${q.id}">Accept</button>
                  <button data-status="Rejected" data-id="${q.id}">Reject</button>
                  <button data-convert="${q.id}">Convert to Job</button>
                  <button class="dangerBtn" data-del="${q.id}">Delete</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${!list.length ? '<div class="empty">No quotes match this register view.</div>' : ''}
    `;

    document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>quoteForm(rows.find(r=>String(r.id)===String(b.dataset.edit))));
    document.querySelectorAll('[data-print]').forEach(b=>b.onclick=()=>printQuote(rows.find(r=>String(r.id)===String(b.dataset.print))));
    document.querySelectorAll('[data-status]').forEach(b=>b.onclick=async()=>{
      const id = b.dataset.id;
      await api('quotes/'+id,{method:'PUT',body:JSON.stringify({status:b.dataset.status})});
      rows = await api('quotes');
      draw();
    });
    document.querySelectorAll('[data-convert]').forEach(b=>b.onclick=async()=>{
      await api('quotes/'+b.dataset.convert+'/convert-to-job',{method:'POST'});
      rows = await api('quotes');
      alert('Quote converted to job');
      draw();
    });
    document.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{
      if(!confirm('Delete quote?')) return;
      await api('quotes/'+b.dataset.del,{method:'DELETE'});
      rows = await api('quotes');
      draw();
    });
  }

  document.getElementById('newQuote').onclick = ()=>quoteForm({quote_number:'',client:'',site:'',status:'Draft',scope:'',items:[]});
  document.getElementById('quoteSearch').oninput = draw;
  document.getElementById('quoteFilter').onchange = draw;
  draw();
}
