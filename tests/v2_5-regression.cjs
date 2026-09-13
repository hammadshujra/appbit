'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const sourceCode=fs.readFileSync(path.join(root,'src/services/apk-source.js'),'utf8');
const resolverCode=fs.readFileSync(path.join(root,'src/services/apk-resolver.js'),'utf8');
const updatesCode=fs.readFileSync(path.join(root,'src/services/apk-updates.js'),'utf8');
const {fetchText,DIRECT_UA}=require('../src/services/apk-source');

function response(body,status=200,headers={}){
  return new Response(body,{status,headers:{'content-type':'text/html; charset=utf-8',...headers}});
}

test('V2.5+ keeps the requested two-part visible version format',()=>{
  const v=fs.readFileSync(path.join(root,'VERSION'),'utf8').trim();
  assert.match(v,/^2\.\d+$/);
  assert.ok(Number(v.split('.')[1])>=5);
});

test('V2.5 restores Appbit direct metadata identity instead of forcing Chrome UA',async()=>{
  let ua='';let browserCalls=0;
  const result=await fetchText('https://liteapks.com/example.html',{
    gapMs:1,
    fetchImpl:async(_url,opts)=>{ua=opts.headers['user-agent'];return response('<html><title>Example</title><body>ok</body></html>')},
    browserFallbackImpl:async()=>{browserCalls++;throw new Error('should not run')}
  });
  assert.equal(ua,DIRECT_UA);
  assert.equal(DIRECT_UA,'Appbit/1.0 (public metadata request)');
  assert.equal(browserCalls,0);
  assert.match(result.text,/Example/);
});

test('V2.5 retries a raw HTTP 403 through the public Chromium path',async()=>{
  let browserCalls=0;
  const result=await fetchText('https://liteapks.com/example-403.html',{
    gapMs:1,
    fetchImpl:async()=>response('denied',403),
    browserFallbackImpl:async(url)=>{browserCalls++;return {text:'<html><title>Recovered</title></html>',url,contentType:'text/html'}}
  });
  assert.equal(browserCalls,1);
  assert.match(result.text,/Recovered/);
});

test('V2.5 retries a verification HTML response through the browser path',async()=>{
  let browserCalls=0;
  const result=await fetchText('https://liteapks.com/example-challenge.html',{
    gapMs:1,
    fetchImpl:async()=>response('<html><title>Just a moment...</title><body>checking your browser</body></html>'),
    browserFallbackImpl:async(url)=>{browserCalls++;return {text:'<html><title>Real app</title></html>',url,contentType:'text/html'}}
  });
  assert.equal(browserCalls,1);
  assert.match(result.text,/Real app/);
});

test('Auto Import can fall back from sitemap discovery to listing discovery',()=>{
  assert.match(resolverCode,/const tryDiscovery=async fn=>/);
  assert.match(resolverCode,/tryDiscovery\(\(\)=>sitemapAppUrls/);
  assert.match(resolverCode,/tryDiscovery\(\(\)=>crawlListings/);
});

test('one access-denied app does not pause the entire import or update queue',()=>{
  assert.match(resolverCode,/const pauseSource=\['SOURCE_RATE_LIMITED','SOURCE_UNAVAILABLE','SOURCE_NETWORK','SOURCE_TIMEOUT'\]/);
  assert.doesNotMatch(resolverCode,/const blocked=\['SOURCE_ACCESS_DENIED','SOURCE_CHALLENGE','SOURCE_RATE_LIMITED'/);
  assert.match(updatesCode,/const pauseSource=\['SOURCE_RATE_LIMITED','SOURCE_UNAVAILABLE','SOURCE_NETWORK','SOURCE_TIMEOUT'\]/);
});

test('V2.5 keeps browser challenge detection and does not add captcha-solving code',()=>{
  assert.match(sourceCode,/function challengePage/);
  assert.match(sourceCode,/SOURCE_CHALLENGE/);
  assert.doesNotMatch(sourceCode,/captcha.*solve|turnstile.*token|cf_clearance/i);
});
