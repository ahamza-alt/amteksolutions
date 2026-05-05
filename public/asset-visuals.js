// AMTEK visual asset register
const modulePageBeforeAssetVisuals = modulePage;

async function assetVisualRegister(){
  const c = document.getElementById('content');
  let assets = await api('assets');

  c.innerHTML = `
    <div class="page">
      <div class="pageHead"><h2>Assets / Equipment</h2><button onclick="location.href='/api/exports/assets'">Export CSV</button></div>
      <section class="stats" id="assetStats"></section>
      <div class="quoteToolbar"><input id="assetSearch" placeholder="Search assets..."><select id="assetStatus"><option value="">All Statuses</option><option>Active</option><option>Out of Service</option><option>In Service</option><option>Retired</option></select></div>
      <div id="assetCards" class="cards"></div>
    </div>`;

  function draw(){
    const q = (document.getElementById('assetSearch').value || '').toLowerCase();
    const status = document.getElementById('assetStatus').value;
    const list = assets.filter(a => (!status || String(a.status||'') === status) && [a.asset_code,a.code,a.display_name,a.name,a.asset_type,a.type,a.location,a.site,a.registration,a.equipment_code].join(' ').toLowerCase().includes(q));

    document.getElementById('assetStats').innerHTML = `${stat('Assets', assets.length, 'records')}${stat('Active', assets.filter(a=>a.status==='Active').length, 'available')}${stat('Out of Service', assets.filter(a=>a.status==='Out of Service').length, 'attention', 'danger')}${stat('Images', assets.filter(a=>a.image).length, 'linked')}`;

    document.getElementById('assetCards').innerHTML = list.map(a => `
      <div class="record assetCard">
        <div style="display:flex;gap:14px;align-items:flex-start">
          <img src="${safe(a.image || '/logo.png')}" alt="asset image" style="width:140px;height:105px;object-fit:cover;border-radius:14px;border:1px solid #e5e7eb;background:#f3f4f6">
          <div>
            <h3>${safe(a.asset_code || a.code || a.id)} - ${safe(a.display_name || a.name || '')}</h3>
            <p><b>Type:</b> ${safe(a.asset_type || a.type || '')}</p>
            <p><b>Status:</b> <span class="tag">${safe(a.status || '')}</span></p>
            <p><b>Location:</b> ${safe(a.location || a.site || '')}</p>
            <p><b>Equipment Code:</b> ${safe(a.equipment_code || '')}</p>
          </div>
        </div>
      </div>`).join('') || '<div class="empty">No assets found.</div>';
  }

  document.getElementById('assetSearch').oninput = draw;
  document.getElementById('assetStatus').onchange = draw;
  draw();
}

modulePage = function(name){
  if(name === 'assets') return assetVisualRegister();
  return modulePageBeforeAssetVisuals(name);
};
