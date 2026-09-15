import Head from 'next/head';
import {useCallback,useEffect,useState} from 'react';
const emptyReport={version:'',buildId:'',ok:false,checks:[]};
export default function HealthPage(){
  const[report,setReport]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[checkedAt,setCheckedAt]=useState(null);
  const refresh=useCallback(async()=>{setLoading(true);try{const response=await fetch(`/api/health/public?t=${Date.now()}`,{cache:'no-store',credentials:'same-origin'});const data=await response.json();setReport({...emptyReport,...data});setCheckedAt(data.checkedAt||new Date().toISOString());setError('')}catch(e){setError(e?.message||'Health check could not be reached.')}finally{setLoading(false)}},[]);
  useEffect(()=>{let alive=true,timer;const poll=async()=>{await refresh();if(alive)timer=setTimeout(poll,6000)};poll();return()=>{alive=false;clearTimeout(timer)}},[refresh]);
  const checks=report?.checks||[],healthy=Boolean(report?.ok),passed=checks.filter(x=>x.status==='pass').length;
  return <><Head><title>System health · Appbit</title><meta name="viewport" content="width=device-width,initial-scale=1"/><link rel="icon" href="/favicon.svg?v=252" type="image/svg+xml"/><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/><link rel="stylesheet" href="/css/app.css?v=252"/></Head>
  <main className="health-split-page">
    <section className="health-visual-panel">
      <div className="auth-brand"><img src="/studio-logo.svg?v=252" alt="Appbit"/><div><b>APPBIT</b><span>Studio Manager</span></div></div>
      <div className="health-visual-copy"><span className="auth-eyebrow">DEPLOYMENT STATUS</span><h1>{healthy?'Everything is ready.':'Checking your studio.'}</h1><p>Private deployment diagnostics for Appbit on Hostinger. This page verifies runtime, database, schema, and the public download gateway without exposing credentials.</p><div className={`health-live-badge ${healthy?'ok':''}`}><i></i><span>{healthy?'All core systems operational':'Health checks running…'}</span></div></div>
      <div className="health-visual-stats"><div><b>{checks.length||'—'}</b><span>Total checks</span></div><div><b>{passed}</b><span>Passing</span></div><div><b>V{report?.version||'—'}</b><span>Studio version</span></div></div>
      <div className="health-visual-art" aria-hidden="true"><span></span><span></span><span></span></div>
    </section>
    <section className="health-panel-wrap"><div className="health-panel-card">
      <div className="health-panel-head"><div><span className="auth-eyebrow">SYSTEM HEALTH</span><h2>Deployment checks</h2><p>Updated automatically every six seconds.</p></div><span className={`health-status-chip ${healthy?'ok':''}`}>{healthy?'Ready':'Checking'}</span></div>
      {error?<div className="error-box">{error}</div>:null}
      <div className="health-check-list">{checks.length?checks.map(check=><div className="health-check-line" key={check.name}><span className={`health-check-icon ${check.status==='pass'?'pass':check.status==='pending'?'pending':'fail'}`}>{check.status==='pass'?'✓':check.status==='pending'?'…':'!'}</span><div><b>{check.name}</b><span>{check.detail}</span></div></div>):<div className="health-empty">Waiting for the first health response…</div>}</div>
      <div className="health-actions"><button className="btn btn-primary" type="button" onClick={refresh}>{loading?'Checking…':'Check again'}</button><a className="btn health-secondary" href="/login?next=%2F">Open sign in</a>{healthy?<a className="btn health-secondary" href="/">Open Appbit</a>:null}</div>
      <div className="health-foot"><span>{checkedAt?`Last checked ${new Date(checkedAt).toLocaleTimeString()}`:'Automatic check every 6 seconds'}</span><span>{report?.buildId||'Hostinger native Next.js runtime'}</span></div>
    </div></section>
  </main></>;
}
