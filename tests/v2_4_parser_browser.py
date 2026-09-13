"""Offline Chromium fixtures for V2.4 source size + SEO/content capture."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
SOURCES={name:(ROOT/name).read_text() for name in ['src/services/apk-fields.js','src/services/apk-history.js','src/services/apk-resolver.js','src/services/apk-source.js','src/utils/sql-checked.js']}
ADAPTER=(ROOT/'tests/dom-adapter.js').read_text()
FIXTURES=[
 ('liteapks-value-above-label','https://liteapks.com/example-app.html','''<!doctype html><html><head><title>Example App v4.5 APK - LiteAPKs</title><meta name="description" content="Example App source meta description for Android users."><meta property="og:title" content="Example App v4.5 APK + MOD"></head><body><main><div class="app-hero"><h1>Example App v4.5 APK + MOD</h1><a class="developer" href="/developer/example-studio">Example Studio</a><a href="/download/example-app">Download APK</a></div><section class="statistics"><div class="stat"><strong>4.5</strong><span>VERSION</span><small>Latest</small></div><div class="stat"><div class="value"><strong>141.99</strong><span> MB</span></div><span>SIZE</span><small>Total</small></div><div class="stat"><strong>Tools</strong><span>GENRE</span></div><div class="stat"><strong>Example Studio</strong><span>DEVELOPER</span></div><div class="stat"><strong>12.4K+</strong><span>REACHED</span><small>Views</small></div><div class="stat"><strong>Sep 10</strong><span>UPDATED</span><small>2026</small></div></section><article><div class="entry-content"><h2>Description</h2><p>This is the first full description paragraph supplied by the source page.</p><p>This is the second paragraph and it must remain in the captured source content.</p><h2>Features</h2><ul><li>First written feature</li><li>Second written feature</li></ul></div></article><div class="app-icon"><img src="https://cdn.example/icon.png"></div></main></body></html>''',{'fileSizeBytes':148887306,'developer':'Example Studio','updatedDate':'2026-09-10','metaTitle':'Example App v4.5 APK - LiteAPKs','metaDescription':'Example App source meta description for Android users.'},['first full description paragraph','second paragraph','First written feature']),
 ('embedded-json-size','https://liteapks.com/json-size.html','''<html><head><title>JSON Size App - LiteAPKs</title><meta name="description" content="JSON Size meta description"></head><body><main><h1>JSON Size App</h1><div><b>Version</b><span>2.7</span></div><div><b>Developer</b><span>JSON Studio</span></div><a href="/download/json-size">Download APK</a><div class="app-icon"><img src="https://cdn.example/json.png"></div><script type="application/json">{"app":{"fileSize":"17 MB"}}</script><div class="entry-content"><h2>Description</h2><p>Full JSON-size app written content.</p></div></main></body></html>''',{'fileSizeBytes':17825792,'metaDescription':'JSON Size meta description'},['Full JSON-size app written content'])]
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
  for(const [name,url,html,expected,content] of fixtures){const d=await resolver.parseAppPage(html,url);for(const [key,value] of Object.entries(expected)){if(JSON.stringify(d[key])!==JSON.stringify(value))throw Error(name+' '+key+': expected '+JSON.stringify(value)+' got '+JSON.stringify(d[key]));}for(const needle of content){if(!(d.sourceContentText||'').includes(needle))throw Error(name+' missing source content '+needle);}outputs.push({name,size:d.fileSizeBytes,metaTitle:d.metaTitle,contentLength:(d.sourceContentText||'').length});}
  return outputs;
 }''',{'sources':SOURCES,'adapter':ADAPTER,'fixtures':FIXTURES})
 print(json.dumps(result,indent=2))
 browser.close()
