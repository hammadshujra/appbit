import Head from 'next/head';
import {useEffect,useState} from 'react';

export default function Login(){
  const [csrf,setCsrf]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{
    document.body.classList.add('standalone');
    const code=new URLSearchParams(window.location.search).get('error');
    if(code==='invalid')setError('Invalid email or password.');
    else if(code==='db')setError('Appbit is waiting for the database. Check the Hostinger database environment variables and retry.');
    fetch('/api/session/csrf',{credentials:'same-origin'})
      .then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d?.error||'Unable to start sign-in.');return d})
      .then(d=>setCsrf(d.csrfToken||''))
      .catch(e=>setError(e.message));
    return()=>document.body.classList.remove('standalone');
  },[]);
  const next=typeof window==='undefined'?'/':(new URLSearchParams(window.location.search).get('next')||'/');
  return <>
    <Head>
      <title>Sign in · Appbit</title>
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="/css/app.css" />
    </Head>
    <main className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <img className="login-logo" src="/logo.svg" alt="Appbit"/>
          <div className="login-kicker">Private Studio Manager</div>
        </div>
        <div className="login-heading"><h1>Welcome back</h1><p>Sign in to manage your apps, releases, storage, accounts, and team.</p></div>
        {error?<div className="error-box">{error}</div>:null}
        <form method="post" action="/api/auth/login" className="stack-form">
          <input type="hidden" name="_csrf" value={csrf}/>
          <input type="hidden" name="next" value={next}/>
          <label>Email<input name="email" type="email" required autoComplete="username"/></label>
          <label>Password<input name="password" type="password" required autoComplete="current-password"/></label>
          <button className="btn btn-primary btn-block" type="submit" disabled={!csrf}>Sign in</button>
        </form>
        <div className="login-help"><span>Admin + Partner access</span><a href="/health">System health</a></div>
      </div>
    </main>
  </>;
}
