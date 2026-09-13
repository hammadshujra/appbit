"""Synthetic metadata fixtures in real Chromium DOM. No live LiteAPKs access."""
import json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
SOURCES={name:(ROOT/name).read_text() for name in ['src/services/apk-fields.js','src/services/apk-history.js','src/services/apk-resolver.js','src/services/apk-source.js']}
ADAPTER=(ROOT/'tests/dom-adapter.js').read_text()
FIXTURES=[
('cards','https://liteapks.com/fixture-app.html', '''<!doctype html><html><head><title>Fixture App - LiteAPKs</title><meta property="og:image" content="https://cdn.example/cover.jpg"></head><body><h1>Fixture App</h1><div class="apk-info"><div><span>Developer</span><span>Example Studio</span></div><div><span>Version</span><span>4.2.1</span></div><div><span>Updated</span><span>August 5, 2026</span></div><div><span>Size</span><span>123.5 MB</span></div><div><span>Category</span><a href="/tools">Tools</a></div><div><span>Downloads</span><span>1.2M+</span></div><div><span>Views</span><span>5 million</span></div><div><span>Package Name</span><span>com.example.fixture</span></div><div><span>Requires Android</span><span>Android 8.0+</span></div></div><div class="app-icon"><img src="https://cdn.example/icon.png"></div><a href="https://play.google.com/store/apps/details?id=com.example.fixture">Google Play</a><a href="/download/fixture-app">Download APK</a><h2>Previous Versions</h2><ul><li><a href="/download/fixture-app-v4.1.0">Version 4.1.0</a> 110 MB 2026-07-01</li><li><a href="/old-versions/fixture-app">All Versions</a></li></ul></body></html>''',{'name':'Fixture App','developer':'Example Studio','version':'4.2.1','updatedDate':'2026-08-05','fileSizeBytes':129499136,'downloadCount':1200000,'viewCount':5000000,'sourcePackageId':'com.example.fixture','playStoreUrl':'https://play.google.com/store/apps/details?id=com.example.fixture','oldVersions':[{'version':'4.1.0','sourcePageUrl':'https://liteapks.com/download/fixture-app-v4.1.0'}]}),
('structured','https://liteapks.com/structured-app.html','''<!doctype html><html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"Structured App","softwareVersion":"2.0.4","author":{"@type":"Organization","name":"Real Developer"},"dateModified":"2026-09-02T12:00:00Z","fileSize":"1.5 GB","downloadCount":0,"aggregateRating":{"ratingValue":4.7,"ratingCount":42},"applicationCategory":"Productivity","operatingSystem":"Android 9.0+","image":"https://cdn.example/icon.png","sameAs":"https://play.google.com/store/apps/details?id=com.example.structured"}</script></head><body><h1>Structured App</h1><div><b>Package ID</b> com.example.structured</div><div><b>Developer</b>Real Developer</div><a href="/download/structured-app">Download</a></body></html>''',{'developer':'Real Developer','version':'2.0.4','updatedDate':'2026-09-02','fileSizeBytes':1610612736,'downloadCount':0,'ratingCount':42}),
('missing','https://liteapks.com/missing-app.html','''<!doctype html><html><head><title>Missing App - LiteAPKs</title></head><body><h1>Missing App</h1><div><strong>Version</strong> 1.0.0</div><div><strong>Developer</strong> Not reported</div><div><strong>Size</strong> Not reported</div><div><strong>Updated</strong> Not reported</div><div><strong>Views</strong> 12K+</div><div class="app-icon"><img src="https://cdn.example/missing.png"></div><a href="/download/missing-app">Download</a><h2>Old Versions</h2><a href="/old-versions/missing-app">All Versions</a></body></html>''',{'developer':None,'updatedDate':None,'fileSizeBytes':None,'downloadCount':12000,'viewCount':12000,'oldVersions':[],'historyPageUrl':'https://liteapks.com/old-versions/missing-app'})
]

def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page()
  page.goto('about:blank')
  out=page.evaluate('''async ({sources,adapter,fixtures})=>{
    (0,eval)(adapter);
    const fields=load('fields',sources['src/services/apk-fields.js'],()=>({}));
    const source=load('source',sources['src/services/apk-source.js'],()=>({}));
    const history=load('history',sources['src/services/apk-history.js'],id=>id==='./apk-fields'?fields:source);
    const resolver=load('resolver',sources['src/services/apk-resolver.js'],id=>{
      if(id==='cheerio')return {load:createDomAdapter};
      if(id==='./apk-fields')return fields;if(id==='./apk-history')return history;if(id==='./apk-source')return source;
      if(id==='node:crypto')return {randomUUID:()=> 'test-uuid'};
      if(id==='../state')return {dbReady:false};if(id==='../config')return {apkResolverRequestGapMs:700};
      if(id==='../db')return {getPool:()=>{throw Error('No DB access in parser test')}};
      return {};
    });
    function load(name,code,require){const module={exports:{}};return new Function('require','module','exports',code+'\\nreturn module.exports;')(require,module,module.exports)}
    const outputs=[];
    for(const [label,url,html,expected] of fixtures){
      const result=await resolver.parseAppPage(html,url);
      for(const [key,value] of Object.entries(expected)){
        if(Array.isArray(value)){if(!Array.isArray(result[key])||value.length!==result[key].length)throw Error(label+': '+key+' count mismatch');for(let i=0;i<value.length;i++)for(const [k,v] of Object.entries(value[i]))if(JSON.stringify(result[key][i][k])!==JSON.stringify(v))throw Error(label+': '+key+'['+i+'].'+k+' mismatch');}
        else if(JSON.stringify(result[key])!==JSON.stringify(value))throw Error(label+': '+key+' expected '+JSON.stringify(value)+' got '+JSON.stringify(result[key])); 
      }
      if(!result.looksLikeAppPage)throw Error(label+': did not recognize app');
      outputs.push({label,fields:Object.keys(expected).length,history:result.oldVersions.length});
    }
    const html=fixtures[0][2];const $=createDomAdapter(html);
    const h=history.extractHistory($,fixtures[0][1],'4.2.1');
    if(h.versions.length!==1||!h.historyPageUrl)throw Error('History extraction failed');
    if(history.safeVersionUrl(undefined,fixtures[0][1])!==null)throw Error('Missing source URL was fabricated');
    return outputs;
  }''',{'sources':SOURCES,'adapter':ADAPTER,'fixtures':FIXTURES})
  print('PASS: Synthetic browser-DOM parser fixtures:',json.dumps(out))
  browser.close()
if __name__=='__main__':run()
