import Head from 'next/head';
const APP_VERSION='2.19';

export default function AppbitShell({appVersion}) {
  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <meta name="description" content="Appbit Android APK publishing workspace." />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href={`/ui/app.css?v=${encodeURIComponent(appVersion)}`} />
        <title>Appbit — APK Publishing Workspace</title>
      </Head>
      <div id="app"><div className="boot">Loading Appbit…</div></div>
      <script src={`/ui/app.js?v=${encodeURIComponent(appVersion)}`} defer></script>
    </>
  );
}

function downloadDisposition(name){
  const safe=String(name||'download').replace(/["\\\r\n]/g,'_');
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(String(name||'download'))}`;
}

async function streamDownloadResponse(context,key){
  const {Readable}=require('node:stream');
  const r2=require('../src/services/r2');
  const {initializeDatabase}=require('../src/init');
  const state=require('../src/state');
  if(!state.dbReady)await initializeDatabase();
  const out=await r2.streamByPath(key,{range:context.req.headers.range||'',head:context.req.method==='HEAD'});
  const upstream=out.response;
  context.res.statusCode=upstream.status;
  for(const h of ['content-length','content-range','accept-ranges','etag','last-modified','cache-control']){
    const v=upstream.headers.get(h);if(v)context.res.setHeader(h,v);
  }
  context.res.setHeader('Content-Type',out.contentType||'application/octet-stream');
  context.res.setHeader('Content-Disposition',downloadDisposition(out.filename));
  context.res.setHeader('X-Content-Type-Options','nosniff');
  if(context.req.method==='HEAD'||!upstream.body){context.res.end();return;}
  await new Promise((resolve,reject)=>{
    const stream=Readable.fromWeb(upstream.body);
    stream.on('error',reject);
    context.res.on('finish',resolve);
    context.res.on('close',resolve);
    stream.pipe(context.res);
  });
}

// Hostinger runs the native Next.js Pages runtime. The catch-all page therefore
// also acts as the public filename gateway. Current copied links are filename-only
// (for example /tiktok.apk); legacy folder/path links are still accepted by the
// R2 service for backward compatibility.
export async function getServerSideProps(context){
  const parts=Array.isArray(context.params?.path)?context.params.path:[];
  const key=parts.map(part=>String(part)).join('/');
  if(key){
    const host=String(context.req.headers.host||'').replace(/:\d+$/,'').toLowerCase();
    let dedicated=false;
    try{
      const r2=require('../src/services/r2');
      const {initializeDatabase}=require('../src/init');
      const state=require('../src/state');
      if(!state.dbReady)await initializeDatabase();
      dedicated=await r2.isActiveDownloadHost(host);
      const filenameLike=/\.[a-z0-9]{1,16}$/i.test(parts[parts.length-1]||'');
      if(dedicated||filenameLike){
        await streamDownloadResponse(context,key);
        return {props:{appVersion:APP_VERSION}};
      }
    }catch(error){
      if(dedicated){
        context.res.statusCode=Number(error?.status||404);
        context.res.setHeader('Content-Type','text/plain; charset=utf-8');
        context.res.end(error?.status===404?'File not found.':'Download failed.');
        return {props:{appVersion:APP_VERSION}};
      }
      if(Number(error?.status||0)!==404)console.error('[Appbit] Direct download lookup failed:',error);
    }
  }
  return {props:{appVersion:APP_VERSION}};
}
