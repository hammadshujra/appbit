'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const resolver=fs.readFileSync(path.join(root,'src/services/apk-resolver.js'),'utf8');
const fields=fs.readFileSync(path.join(root,'src/services/apk-fields.js'),'utf8');
const updates=fs.readFileSync(path.join(root,'src/services/apk-updates.js'),'utf8');
const init=fs.readFileSync(path.join(root,'src/init.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'public/ui/app.js'),'utf8');
test('V2.2 fixes secondary metadata enrichment pageText crash',()=>{
  const block=resolver.slice(resolver.indexOf('async function enrichMissingSourceFields'),resolver.indexOf('function metadataMissingFields'));
  assert.match(block,/const pageText=cleanText\(\$\('body'\)\.text\(\)\);/);
  assert.match(block,/extractSizeInfo\(\$,app,labels,pageText(?:,response\.text)?\)/);
  assert.ok(block.indexOf('const pageText=')<block.indexOf('extractSizeInfo($,app,labels,pageText'),'pageText must exist before enrichment uses it');
});
test('V2.2 has typed LiteAPKs stat fallback for size and reached counter',()=>{
  assert.match(fields,/function visibleStatFallback/);
  assert.match(fields,/size:\[\/\\b\(\\d\+/);
  assert.match(fields,/REACHED/);
  assert.match(resolver,/const downloadCount=.*\?\?viewCount;/);
});
test('update scans continue server-side after Start Scan',()=>{
  assert.match(updates,/function startUpdateWorker/);
  assert.match(updates,/setInterval\(autoTick,WORKER_INTERVAL_MS\)/);
  assert.match(init,/apkUpdates\.startUpdateWorker\(\)/);
  const poll=ui.slice(ui.indexOf('async function pollUpdateScan'),ui.indexOf('async function renderUpdateCenter'));
  assert.match(poll,/API\('\/api\/updates\/state'\)/);
  assert.doesNotMatch(poll,/updates\/step/);
});
