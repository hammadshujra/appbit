"""Offline DOM fixtures. The Bravo values are transcribed from the user's screenshot;
the HTML is a representative fixture, not a claim about LiteAPKs' current markup."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
SOURCES={name:(ROOT/name).read_text() for name in ['src/services/apk-fields.js','src/services/apk-history.js','src/services/apk-resolver.js','src/services/apk-source.js','src/utils/sql-checked.js']}
ADAPTER=(ROOT/'tests/dom-adapter.js').read_text()
FIXTURES=[
 ('bravo-statistics','https://liteapks.com/bravo-security.html','''<html><head><title>Bravo Security v1.2.5.1002 APK + MOD (Premium Unlocked) - LiteAPKs</title></head><body><main><div class="app-hero"><h1>Bravo Security v1.2.5.1002 APK + MOD (Premium Unlocked)</h1><a class="developer" href="/developer/bravo-gmbh">Bravo GmbH</a><a href="/download/bravo-security">Download APK</a></div><div class="statistics"><div class="stat"><span>VERSION</span><b>1.2.5.1002</b><small>Latest</small></div><div class="stat"><span>SIZE</span><b>17 MB</b><small>Total</small></div><div class="stat"><span>GENRE</span><b>Tools</b></div><div class="stat"><span>DEVELOPER</span><a>Bravo GmbH</a></div><div class="stat"><span>REACHED</span><b>5.7K+</b><small>Views</small></div><div class="stat"><span>UPDATED</span><b>Aug 5</b><small>2022</small></div></div><div class="app-icon"><img src="https://cdn.example/bravo.png"></div><a href="https://play.google.com/store/apps/details?id=com.bravo.security">Google Play</a></main></body></html>''',{'name':'Bravo Security','developer':'Bravo GmbH','version':'1.2.5.1002','updatedDate':'2022-08-05','fileSizeBytes':17825792,'viewCount':5700,'downloadCount':5700}),
 ('nested-statistics','https://liteapks.com/nested.html','''<html><body><h1>Nested App</h1><div class="apk-info"><div class="stat"><div><svg></svg><span>Version</span></div><div><strong>3.4.5</strong><small>Latest</small></div></div><div class="stat"><div><svg></svg><span>Developer</span></div><div><a>Studio Étoile</a></div></div><div class="stat"><div><span>Size</span></div><div><b>123.5 MB</b><span>Total</span></div></div><div class="stat"><div><span>Updated</span></div><div><b>August 5, 2026</b></div></div><div class="stat"><span>Downloads</span><b>1.2M+</b></div></div><a href="/download/nested">Download</a><div class="app-icon"><img src="https://cdn.example/nested.png"></div></body></html>''',{'developer':'Studio Étoile','version':'3.4.5','fileSizeBytes':129499136,'updatedDate':'2026-08-05','downloadCount':1200000}),
 ('unknown-count','https://liteapks.com/unknown.html','''<html><body><h1>Unknown App</h1><div><b>Version</b> 1.2.3</div><div><b>Reached</b> 1.1K+ Views</div><div><b>Developer</b> Not reported</div><div class="app-icon"><img src="https://cdn.example/unknown.png"></div><a href="/download/unknown">Download</a></body></html>''',{'downloadCount':1100,'viewCount':1100,'developer':None})]
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
 for(const [name,url,html,expected] of fixtures){const d=await resolver.parseAppPage(html,url);for(const [key,value] of Object.entries(expected)){if(JSON.stringify(d[key])!==JSON.stringify(value))throw Error(name+' '+key+': expected '+JSON.stringify(value)+' got '+JSON.stringify(d[key]));}outputs.push({name,missing:d.missingFields,fields:Object.keys(expected).length});}
 return outputs;
}''',{'sources':SOURCES,'adapter':ADAPTER,'fixtures':FIXTURES})
 print(json.dumps(result,indent=2))
 browser.close()
