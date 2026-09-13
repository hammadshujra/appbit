"""Offline Chromium fixtures for V2.6 bounded content + hero size extraction."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
SOURCES={name:(ROOT/name).read_text() for name in ['src/services/apk-fields.js','src/services/apk-history.js','src/services/apk-resolver.js','src/services/apk-source.js','src/utils/sql-checked.js']}
ADAPTER=(ROOT/'tests/dom-adapter.js').read_text()
FIXTURES=[
 ('core-content-boundaries','https://liteapks.com/fixture-core.html','''<!doctype html><html><head><title>Fixture Core v2.7.5 APK + MOD - LiteAPKs</title><meta name="description" content=""><meta property="og:description" content="Exact SEO description from the source page."></head><body><main>
 <div class="app-hero"><h1>Fixture Core v2.7.5 APK + MOD</h1><a class="developer">Core Studio</a><div class="hero-facts"><div><strong>2.7.5</strong><span>Version</span></div><div><strong><span>284.6</span><em> MB</em></strong><span>Size</span></div><a href="https://play.google.com/store/apps/details?id=com.example.core">Get it on</a><span>4.6 ★</span></div><a href="/download/fixture-core">Download Now</a></div>
 <div class="entry-content"><h2>Description</h2><p>Keep this first description paragraph.</p><h3>Main Features</h3><p>Keep this second description paragraph and feature text.</p><h2>Mod Info</h2><ul><li>Premium unlocked</li><li>Ads removed</li></ul><h2>FAQ</h2><p>REMOVE FAQ ANSWER</p><h2>Safety Data</h2><p>REMOVE SAFETY DATA</p><h2>Comments</h2><p>REMOVE COMMENT</p><h2>Recommended for you</h2><p>REMOVE RECOMMENDED APP NAME</p></div><div class="recommended"><span>Other App</span><span>999 MB</span></div><footer>REMOVE FOOTER LINKS</footer></main></body></html>''',
  {'fileSizeBytes':298424730,'metaTitle':'Fixture Core v2.7.5 APK + MOD - LiteAPKs','metaDescription':'Exact SEO description from the source page.'},
  ['Keep this first description paragraph','Main Features','Keep this second description paragraph','Premium unlocked','Ads removed'],
  ['REMOVE FAQ ANSWER','REMOVE SAFETY DATA','REMOVE COMMENT','REMOVE RECOMMENDED APP NAME','REMOVE FOOTER LINKS','999 MB']),
 ('hero-size-without-size-label','https://liteapks.com/hero-no-label.html','''<html><head><meta property="og:title" content="Hero No Label v4.2 APK"><meta name="twitter:description" content="Twitter description fallback from the source."></head><body><main><div class="app-hero"><h1>Hero No Label v4.2 APK</h1><a class="developer">Hero Studio</a><div class="top-summary"><span>4.2 Version</span><strong>98.2 MB</strong><a href="https://play.google.com/store/apps/details?id=com.hero.nolabel">Google Play</a><span>4.2/5</span><a href="/download/hero-no-label">Download APK</a></div></div><div class="app-icon"><img src="https://cdn.example/hero.png"></div><div class="entry-content"><h2>About this app</h2><p>Only this app description should be captured.</p><h2>Data Safety</h2><p>REMOVE DATA SAFETY</p></div></main></body></html>''',
  {'fileSizeBytes':102970163,'metaTitle':'Hero No Label v4.2 APK','metaDescription':'Twitter description fallback from the source.'},
  ['Only this app description should be captured.'],['REMOVE DATA SAFETY'])
]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page();page.goto('about:blank')
 result=page.evaluate('''async ({sources,adapter,fixtures})=>{
  (0,eval)(adapter);
  function load(code,require){const module={exports:{}};return new Function('require','module','exports',code+'\\nreturn module.exports;')(require,module,module.exports)}
  const fields=load(sources['src/services/apk-fields.js'],()=>({}));
  const source=load(sources['src/services/apk-source.js'],()=>({}));
  const history=load(sources['src/services/apk-history.js'],id=>id==='./apk-fields'?fields:source);
  const resolver=load(sources['src/services/apk-resolver.js'],id=>{if(id==='cheerio')return {load:createDomAdapter};if(id==='./apk-fields')return fields;if(id==='./apk-history')return history;if(id==='./apk-source')return source;if(id==='node:crypto')return {randomUUID:()=> 'test-uuid'};if(id==='../state')return {dbReady:false};if(id==='../config')return {};if(id==='../utils/sql-checked')return load(sources['src/utils/sql-checked.js'],()=>({}));if(id==='../db')return {getPool:()=>{throw Error('No database in parser fixture')}};return {}});
  const outputs=[];
  for(const [name,url,html,expected,includes,excludes] of fixtures){
    const d=await resolver.parseAppPage(html,url);
    for(const [key,value] of Object.entries(expected)){if(JSON.stringify(d[key])!==JSON.stringify(value))throw Error(name+' '+key+': expected '+JSON.stringify(value)+' got '+JSON.stringify(d[key]));}
    const core=d.sourceContentText||'';
    for(const needle of includes)if(!core.includes(needle))throw Error(name+' missing core content '+needle);
    for(const needle of excludes)if(core.includes(needle))throw Error(name+' leaked excluded content '+needle);
    if(name==='core-content-boundaries'&&!String(d.modInfoText||'').includes('Premium unlocked'))throw Error('full Mod Info section missing');
    outputs.push({name,size:d.fileSizeBytes,metaTitle:d.metaTitle,metaDescription:d.metaDescription,coreLength:core.length,modInfoLength:(d.modInfoText||'').length});
  }
  return outputs;
 }''',{'sources':SOURCES,'adapter':ADAPTER,'fixtures':FIXTURES})
 print(json.dumps(result,indent=2))
 browser.close()
