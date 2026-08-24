const EDGE='https://genevieve-budget-app.positivity864.workers.dev';

export default async function handler(req,res){
  const action=String(req.query?.action||'health');
  const paths={
    health:'/_edge/health',
    audit:'/_edge/audit',
    publicKey:'/_bootstrap/public-key',
    status:'/api/status'
  };
  if(!paths[action]) return res.status(400).json({error:'Unsupported action'});
  try{
    const r=await fetch(EDGE+paths[action],{cache:'no-store'});
    const text=await r.text();
    res.status(r.status);
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type',r.headers.get('content-type')||'text/plain; charset=utf-8');
    res.send(text);
  }catch(e){
    res.status(502).json({error:'Cloudflare edge bridge failed',detail:e.message});
  }
}
