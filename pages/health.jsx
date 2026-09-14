import Head from 'next/head';
import {useCallback,useEffect,useState} from 'react';

const emptyReport={version:'',buildId:'',ok:false,checks:[]};

export default function HealthPage(){
  const [report,setReport]=useState(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [checkedAt,setCheckedAt]=useState(null);
  const refresh=useCallback(async()=>{
    setLoading(true);
    try{
      const response=await fetch(`/api/health/public?t=${Date.now()}`,{cache:'no-store',credentials:'same-origin'});
      const data=await response.json();
      setReport({...emptyReport,...data});
      setCheckedAt(data.checkedAt||new Date().toISOString());
      setError('');
    }catch(e){
      setError(e?.message||'Health check could not be reached.');
    }finally{
      setLoading(false);
    }
  },[]);
  useEffect(()=>{
    let alive=true;
    let timer;
    const poll=async()=>{await refresh();if(alive)timer=setTimeout(poll,6000)};
    poll();
    return()=>{alive=false;clearTimeout(timer)};
  },[refresh]);
  const checks=report?.checks||[];
  const healthy=Boolean(report?.ok);
  return <>
    <Head>
      <title>Health · Appbit</title>
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta name="description" content="Appbit deployment health check." />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="/css/app.css" />
    </Head>
    <main className="health-shell">
      <section className="health-card" aria-live="polite">
        <div className="health-brand">
          <img className="health-brand-logo" src="/logo.svg" alt="Appbit" />
          <div><div className="health-brand-title">Appbit</div><div className="health-brand-sub">Deployment health</div></div>
        </div>
        <div className={`health-banner ${healthy?'is-healthy':'is-waiting'}`}>
          <span className="health-banner-dot"></span>
          <div><b>{loading&&!report?'Checking deployment…':healthy?'Appbit is ready':'Action required'}</b><span>{healthy?'Database and application checks are passing.':'The deployment is online, but one or more checks are not ready yet.'}</span></div>
        </div>
        <div className="health-heading"><div><h1>System health</h1><p>This page is safe to open after every Hostinger deployment. It never shows credentials.</p></div><span className="health-version">V{report?.version||'—'}</span></div>
        {error?<div className="error-box">{error}</div>:null}
        <div className="health-checks">
          {checks.length?checks.map(check=><div className="health-check" key={check.name}>
            <span className={`health-check-icon ${check.status==='pass'?'pass':check.status==='pending'?'pending':'fail'}`}>{check.status==='pass'?'✓':check.status==='pending'?'…':'!'}</span>
            <div><b>{check.name}</b><span>{check.detail}</span></div>
          </div>):<div className="health-empty">Waiting for the first health response…</div>}
        </div>
        <div className="health-actions"><button className="btn btn-primary" type="button" onClick={refresh}>{loading?'Checking…':'Check again'}</button><a className="btn" href="/login?next=%2F">Open sign in</a>{healthy?<a className="btn" href="/">Open Appbit</a>:null}</div>
        <div className="health-foot"><span>{checkedAt?`Last checked ${new Date(checkedAt).toLocaleTimeString()}`:'Automatic check every 6 seconds'}</span><span>{report?.buildId||'Hostinger native Next.js runtime'}</span></div>
      </section>
    </main>
  </>;
}
