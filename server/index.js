import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = 3001;
const ROOT = path.resolve('.');
const DATA_DIR = path.join(ROOT, 'server', 'data');
const PUBLIC_DIR = path.join(ROOT, 'public');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
const modules = { quotes:'Q', jobs:'J', tasks:'T', staff:'S', assets:'A', schedules:'SCH', crews:'C', materials:'M', suppliers:'SUP', purchaseOrders:'PO', variations:'VAR', timesheets:'TS', claims:'CLM', diaries:'DIA', documents:'DOC', photos:'PHO', actions:'ACT', clientUpdates:'CU', rfis:'RFI', permits:'PER', risks:'RSK', reports:'REP' };
const apiToFile = Object.fromEntries(Object.keys(modules).map(k=>[k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), k]));
function ensure(name){ if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR,{recursive:true}); const f=path.join(DATA_DIR,`${name}.json`); if(!fs.existsSync(f)) fs.writeFileSync(f,'[]'); return f; }
function read(name){ try{return JSON.parse(fs.readFileSync(ensure(name),'utf8')||'[]')}catch{return[]} }
function write(name,data){ fs.writeFileSync(ensure(name),JSON.stringify(data,null,2)); }
function id(prefix){ return `${prefix}-${Date.now()}-${Math.floor(Math.random()*1000)}` }
function send(res, status, body, type='application/json'){ res.writeHead(status,{'Content-Type':type,'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'}); res.end(type==='application/json'?JSON.stringify(body):body); }
function body(req){ return new Promise(resolve=>{let data=''; req.on('data',c=>data+=c); req.on('end',()=>{try{resolve(data?JSON.parse(data):{})}catch{resolve({})}})}) }
function quoteTotal(q){return (q.items||[]).reduce((s,i)=>s+Number(i.total ?? (Number(i.qty||0)*Number(i.rate||0))),0)}
function librarySource(){
  const dataJson = path.join(DATA_DIR,'data.json');
  if(fs.existsSync(dataJson)){
    try{ const d=JSON.parse(fs.readFileSync(dataJson,'utf8')); return {controls:d.controls||{}, rows:(d.rateLibrary||[]).map(x=>({...x,id:x.code,rate:Number(x.benchmarkDirectCostPerUnit||0)}))}; }catch{}
  }
  return {controls:{defaultLabourRate:95,defaultMarginPct:0.15,defaultContingencyPct:0.05}, rows:read('rateLibrary')};
}

async function handleApi(req,res,parts){
  if(req.method==='OPTIONS') return send(res,200,{});
  if(parts[0]==='health') return send(res,200,{ok:true,version:'AMTEK-WORKING-STABLE-APP'});
  if(parts[0]==='auth' && parts[1]==='login' && req.method==='POST'){
    const b=await body(req); const users=read('users'); const u=users.find(x=>String(x.email).toLowerCase()===String(b.email||'').trim().toLowerCase() && String(x.password)===String(b.password||'').trim());
    if(!u) return send(res,401,{error:'Invalid login'}); return send(res,200,{token:'demo-token',user:{id:u.id,email:u.email,name:u.name,role:u.role}});
  }
  if(parts[0]==='dashboard' && parts[1]==='board') return send(res,200,{jobs:read('jobs'),quotes:read('quotes'),tasks:read('tasks'),schedules:read('schedules'),staff:read('staff'),assets:read('assets')});
  if(parts[0]==='dashboard' && parts[1]==='exceptions'){
    const staff=read('staff'), assets=read('assets'), schedules=read('schedules'), ex=[];
    staff.filter(s=>['Sick','Leave','No Show','Unavailable'].includes(s.status)).forEach(s=>ex.push({message:`${s.short_name||s.full_name} is ${s.status}`}));
    assets.filter(a=>['Out of Service','In Service','Retired'].includes(a.status)).forEach(a=>ex.push({message:`${a.asset_code||a.display_name} is ${a.status}`}));
    const sc={}, ac={}; schedules.forEach(s=>{(s.staff||[]).forEach(x=>{const k=s.day+':'+x;sc[k]=(sc[k]||0)+1});(s.assets||[]).forEach(x=>{const k=s.day+':'+x;ac[k]=(ac[k]||0)+1})});
    Object.entries(sc).filter(([,c])=>c>1).forEach(([k])=>ex.push({message:`Staff double booked: ${k.split(':')[1]} on ${k.split(':')[0]}`}));
    Object.entries(ac).filter(([,c])=>c>1).forEach(([k])=>ex.push({message:`Asset double booked: ${k.split(':')[1]} on ${k.split(':')[0]}`}));
    return send(res,200,ex);
  }
  if(parts[0]==='rate-library') return send(res,200,librarySource().rows);
  if(parts[0]==='rate-controls') return send(res,200,librarySource().controls);
  if(parts[0]==='exports'){
    const name=apiToFile[parts[1]]||parts[1]; const rows=read(name); const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
    const csv=[keys.join(','),...rows.map(r=>keys.map(k=>`"${String(r[k]??'').replace(/"/g,'""')}"`).join(','))].join('\n');
    res.writeHead(200,{'Content-Type':'text/csv','Content-Disposition':`attachment; filename="${name}.csv"`}); return res.end(csv);
  }
  if(parts[0]==='quotes' && parts[2]==='convert-to-job' && req.method==='POST'){
    const quotes=read('quotes'), jobs=read('jobs'), tasks=read('tasks'); const q=quotes.find(x=>String(x.id)===String(parts[1])); if(!q) return send(res,404,{error:'Quote not found'});
    const existing=jobs.find(j=>j.quote_id===q.id); if(existing) return send(res,200,existing);
    const job={id:id('J'),job_number:id('JOB'),quote_id:q.id,client:q.client,site:q.site,status:'Planned',current_phase:'Pre Install',manager:'Unassigned',progress:0,quote_value:quoteTotal(q),created_at:new Date().toISOString()};
    jobs.unshift(job); write('jobs',jobs); (q.items||[]).forEach(item=>tasks.unshift({id:id('T'),job_id:job.id,phase:'Pre Install',name:String(item.description||'Task').slice(0,22).toUpperCase(),status:'Planned'})); write('tasks',tasks); q.status='Awarded'; q.converted_job_id=job.id; write('quotes',quotes); return send(res,200,job);
  }
  const name=apiToFile[parts[0]]; if(!name) return send(res,404,{error:'Route not found'});
  const rows=read(name); const recId=parts[1];
  if(req.method==='GET') return send(res,200,rows);
  if(req.method==='POST'){ const b=await body(req); const rec={id:b.id||id(modules[name]),...b,updated_at:new Date().toISOString()}; rows.unshift(rec); write(name,rows); return send(res,200,rec); }
  if(req.method==='PUT'){ const b=await body(req); const ix=rows.findIndex(r=>String(r.id)===String(recId)); if(ix<0) return send(res,404,{error:'Not found'}); rows[ix]={...rows[ix],...b,updated_at:new Date().toISOString()}; write(name,rows); return send(res,200,rows[ix]); }
  if(req.method==='DELETE'){ write(name, rows.filter(r=>String(r.id)!==String(recId))); return send(res,200,{ok:true}); }
  send(res,405,{error:'Method not allowed'});
}
function serve(req,res){ let url=decodeURI(req.url.split('?')[0]); if(url==='/'||url==='') url='/index.html'; const f=path.normalize(path.join(PUBLIC_DIR,url)); if(!f.startsWith(PUBLIC_DIR)) return send(res,403,'Forbidden','text/plain'); if(fs.existsSync(f)&&fs.statSync(f).isFile()){ const ext=path.extname(f); res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream'}); fs.createReadStream(f).pipe(res); } else { const index=path.join(PUBLIC_DIR,'index.html'); res.writeHead(200,{'Content-Type':'text/html'}); fs.createReadStream(index).pipe(res); } }
const server=http.createServer((req,res)=>{ const u=new URL(req.url,`http://${req.headers.host}`); if(u.pathname.startsWith('/api/')) return handleApi(req,res,u.pathname.slice(5).split('/')).catch(e=>send(res,500,{error:e.message})); serve(req,res); });
server.listen(PORT,()=>console.log(`AMTEK app running at http://localhost:${PORT}`));
