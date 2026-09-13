const BASE = 'https://liteapks.com';
const MAX_BYTES = 4 * 1024 * 1024;
const TIMEOUT = 20000;
const DIRECT_UA = 'Appbit/1.0 (public metadata request)';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';
let lastRequestAt = 0;
let browserPreferredUntil = 0;
let browserSessionPromise = null;
let browserQueue = Promise.resolve();

class SourceError extends Error {
  constructor(message, status = 502, code = 'SOURCE_ERROR', retryable = false) {
    super(message); this.name='SourceError'; this.status=status; this.code=code; this.retryable=retryable;
  }
}
function sourceUrl(value, base=BASE) {
  try {
    if(value==null||!String(value).trim())return null;
    const u=new URL(value,base);
    if(u.protocol!=='https:' || !/(^|\.)liteapks\.com$/i.test(u.hostname) || u.username || u.password || u.port && u.port!=='443')return null;
    u.hash='';return u.toString();
  }catch{return null}
}
function wait(ms, signal) {
  return new Promise((resolve,reject)=>{
    if(signal?.aborted)return reject(signal.reason || new Error('Request stopped.'));
    const timer=setTimeout(done,ms);
    function done(){signal?.removeEventListener('abort',abort);resolve()}
    function abort(){clearTimeout(timer);signal.removeEventListener('abort',abort);reject(signal.reason || new Error('Request stopped.'))}
    signal?.addEventListener('abort',abort,{once:true});
  });
}
function retryDelay(header,attempt){
  const numeric=Number(header);let ms=Number.isFinite(numeric)?numeric*1000:Date.parse(header||'')-Date.now();
  if(!Number.isFinite(ms)||ms<0)ms=1500*(attempt+1);
  return Math.min(30000,Math.max(1000,ms));
}
function challengePage(text){
  const value=String(text||'');
  return /<title[^>]*>[^<]*(?:just a moment|attention required|access denied|verify you are human)/i.test(value)
    || /(?:id=["'](?:challenge-form|cf-challenge-running)["']|cf-turnstile|cf-chl-|challenge-platform|checking your browser|enable javascript and cookies)/i.test(value);
}
async function browserSession(){
  if(!browserSessionPromise){
    browserSessionPromise=(async()=>{
      const {chromium}=require('playwright');
      const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
      const context=await browser.newContext({userAgent:BROWSER_UA,locale:'en-US',viewport:{width:1440,height:1000},extraHTTPHeaders:{'accept-language':'en-US,en;q=0.8'}});
      browser.on('disconnected',()=>{browserSessionPromise=null});
      return {browser,context};
    })().catch(err=>{browserSessionPromise=null;throw err});
  }
  return browserSessionPromise;
}
async function browserFetchText(input,{accept='text/html,application/xhtml+xml',signal,maxBytes=MAX_BYTES}={}){
  const safe=sourceUrl(input);
  if(!safe)throw new SourceError('Only public HTTPS LiteAPKs URLs are supported.',400,'INVALID_SOURCE_URL');
  const run=browserQueue.catch(()=>{}).then(async()=>{
    if(signal?.aborted)throw new SourceError('Request stopped.',499,'SOURCE_STOPPED');
    let page;
    try{
      const {context}=await browserSession();
      page=await context.newPage();
      await page.setExtraHTTPHeaders({'accept':accept,'accept-language':'en-US,en;q=0.8'});
      const abort=()=>page?.close().catch(()=>{});
      signal?.addEventListener('abort',abort,{once:true});
      let response;
      try{response=await page.goto(safe,{waitUntil:'domcontentloaded',timeout:TIMEOUT});}
      finally{signal?.removeEventListener('abort',abort)}
      if(signal?.aborted)throw new SourceError('Request stopped.',499,'SOURCE_STOPPED');
      const status=response?.status?.()||0;
      const finalUrl=sourceUrl(page.url())||safe;
      if(status===401||status===403)throw new SourceError(`LiteAPKs returned HTTP ${status} to the browser fallback.`,status,'SOURCE_ACCESS_DENIED');
      if(status===429)throw new SourceError('LiteAPKs rate-limited the browser fallback. Retry later.',429,'SOURCE_RATE_LIMITED',true);
      if(status>=500)throw new SourceError(`LiteAPKs returned HTTP ${status} to the browser fallback.`,status,'SOURCE_UNAVAILABLE',true);
      if(status<200||status>=400)throw new SourceError(`LiteAPKs returned HTTP ${status||'unknown'} to the browser fallback.`,status||502,'SOURCE_HTTP_ERROR');
      const headers=await response.allHeaders().catch(()=>({}));
      const contentType=headers['content-type']||'';
      let text='';
      if(/(?:xml|text\/plain)/i.test(contentType)){
        const body=await response.body();
        if(body.length>maxBytes)throw new SourceError('Source response exceeds the metadata size limit.',413,'SOURCE_TOO_LARGE');
        text=body.toString('utf8');
      }else{
        await page.waitForLoadState('networkidle',{timeout:3500}).catch(()=>{});
        await page.waitForTimeout(350);
        text=await page.content();
      }
      if(Buffer.byteLength(text,'utf8')>maxBytes)throw new SourceError('Source response exceeds the metadata size limit.',413,'SOURCE_TOO_LARGE');
      if(challengePage(text))throw new SourceError('LiteAPKs returned a verification page to the browser fallback.',403,'SOURCE_CHALLENGE');
      browserPreferredUntil=Date.now()+10*60*1000;
      return {text,url:finalUrl,contentType};
    }catch(err){
      if(signal?.aborted||err?.code==='SOURCE_STOPPED')throw new SourceError('Request stopped.',499,'SOURCE_STOPPED');
      if(err instanceof SourceError)throw err;
      throw new SourceError(`LiteAPKs browser fallback failed: ${err.message||err}`,502,'SOURCE_BROWSER_FAILED',true);
    }finally{try{await page?.close()}catch{}}
  });
  browserQueue=run.catch(()=>{});
  return run;
}
async function fetchText(input,{accept='text/html,application/xhtml+xml',signal,gapMs=1400,fetchImpl=fetch,maxBytes=MAX_BYTES,browserFallbackImpl=browserFetchText}={}){
  const initial=sourceUrl(input);
  if(!initial)throw new SourceError('Only public HTTPS LiteAPKs URLs are supported.',400,'INVALID_SOURCE_URL');

  // Once the normal browser path proves necessary, keep using it briefly so an
  // import batch does not hammer the same rejected raw endpoint over and over.
  if(Date.now()<browserPreferredUntil&&browserFallbackImpl){
    try{return await browserFallbackImpl(initial,{accept,signal,maxBytes});}
    catch(err){if(err?.code==='SOURCE_STOPPED')throw err;browserPreferredUntil=0;}
  }

  attemptLoop: for(let attempt=0;attempt<3;attempt++){
    const controller=new AbortController();
    const abort=()=>controller.abort(signal?.reason);
    if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(()=>controller.abort(new Error('Request timed out.')),TIMEOUT);
    try{
      const gap=Math.max(700,Number(gapMs)||1400);
      await wait(Math.max(0,lastRequestAt+gap-Date.now()),controller.signal);
      let current=initial;
      for(let redirects=0;redirects<5;redirects++){
        const res=await fetchImpl(current,{redirect:'manual',signal:controller.signal,headers:{'user-agent':DIRECT_UA,'accept':accept,'accept-language':'en-US,en;q=0.8'}});
        lastRequestAt=Date.now();
        if([301,302,303,307,308].includes(res.status)){
          const next=sourceUrl(res.headers.get('location'),current);
          if(!next)throw new SourceError('Source redirected outside LiteAPKs.',502,'SOURCE_REDIRECT');
          current=next;continue;
        }
        if(res.status===401||res.status===403){
          if(browserFallbackImpl){
            try{return await browserFallbackImpl(current,{accept,signal:controller.signal,maxBytes});}
            catch(browserErr){
              if(browserErr?.code==='SOURCE_STOPPED')throw browserErr;
              if(browserErr instanceof SourceError)throw browserErr;
            }
          }
          throw new SourceError(`LiteAPKs returned HTTP ${res.status} to both metadata fetch paths.`,res.status,'SOURCE_ACCESS_DENIED');
        }
        if(res.status===429||res.status>=500){
          if(attempt<2){await wait(retryDelay(res.headers.get('retry-after'),attempt),controller.signal);continue attemptLoop;}
          throw new SourceError(`LiteAPKs returned HTTP ${res.status}. The import can be retried later.`,res.status,res.status===429?'SOURCE_RATE_LIMITED':'SOURCE_UNAVAILABLE',true);
        }
        if(!res.ok)throw new SourceError(`LiteAPKs returned HTTP ${res.status}.`,res.status,'SOURCE_HTTP_ERROR');
        const length=Number(res.headers.get('content-length')||0);
        if(length>maxBytes)throw new SourceError('Source response exceeds the metadata size limit.',413,'SOURCE_TOO_LARGE');
        const reader=res.body?.getReader();let total=0;const chunks=[];
        if(reader){while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes){await reader.cancel();throw new SourceError('Source response exceeds the metadata size limit.',413,'SOURCE_TOO_LARGE')}chunks.push(Buffer.from(value));}}
        else{const b=Buffer.from(await res.arrayBuffer());total=b.length;chunks.push(b);if(total>maxBytes)throw new SourceError('Source response exceeds the metadata size limit.',413,'SOURCE_TOO_LARGE')}
        const text=Buffer.concat(chunks).toString('utf8');
        if(challengePage(text)){
          if(browserFallbackImpl){
            try{return await browserFallbackImpl(current,{accept,signal:controller.signal,maxBytes});}
            catch(browserErr){if(browserErr?.code==='SOURCE_STOPPED')throw browserErr;if(browserErr instanceof SourceError)throw browserErr;}
          }
          throw new SourceError('LiteAPKs returned a verification page instead of app metadata.',403,'SOURCE_CHALLENGE');
        }
        return{text,url:current,contentType:res.headers.get('content-type')||''};
      }
      throw new SourceError('Too many source redirects.',502,'SOURCE_REDIRECT');
    }catch(err){
      if(controller.signal.aborted){if(signal?.aborted)throw new SourceError('Request stopped.',499,'SOURCE_STOPPED');throw new SourceError('LiteAPKs request timed out.',504,'SOURCE_TIMEOUT',true)}
      if(err instanceof SourceError)throw err;
      if(attempt===2)throw new SourceError(`LiteAPKs request failed: ${err.message||err}`,502,'SOURCE_NETWORK',true);
      await wait(1500*(attempt+1),signal);
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
  }
  throw new SourceError('LiteAPKs is temporarily unavailable.',503,'SOURCE_UNAVAILABLE',true);
}
module.exports={SourceError,sourceUrl,fetchText,browserFetchText,wait,DIRECT_UA,BROWSER_UA};
