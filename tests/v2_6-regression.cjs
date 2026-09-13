'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const fields=require('../src/services/apk-fields');
const resolver=fs.readFileSync(path.join(root,'src/services/apk-resolver.js'),'utf8');
const api=fs.readFileSync(path.join(root,'src/routes/api.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'public/ui/app.js'),'utf8');

test('V2.6+ visible version remains two-part',()=>{
  const version=fs.readFileSync(path.join(root,'VERSION'),'utf8').trim();
  assert.match(version,/^\d+\.\d+$/);
  assert.ok(Number(version.split('.')[1])>=6);
});

test('V2.6 keeps strict byte parsing for visible app sizes',()=>{
  assert.equal(fields.parseBytes('284.6 MB'),Math.round(284.6*1024*1024));
  assert.equal(fields.parseBytes('98.2 MB'),Math.round(98.2*1024*1024));
  assert.equal(fields.parseBytes('Not reported'),null);
});

test('V2.6 targets hero/front summary size before generic page candidates',()=>{
  assert.match(resolver,/function heroSizeCandidates/);
  assert.match(resolver,/source:hero-size/);
  assert.match(resolver,/for\(const x of heroSizeCandidates\(\$\)\)add\(x\.raw,x\.source\)/);
  assert.match(resolver,/download\\s\+\(\?:apk\|xapk\|apks\)|download now/);
});

test('V2.6 core content is bounded to Description and Mod Info',()=>{
  assert.match(resolver,/DESCRIPTION_HEADING_RE/);
  assert.match(resolver,/MOD_HEADING_RE/);
  assert.match(resolver,/EXCLUDED_CONTENT_HEADING_RE/);
  assert.match(resolver,/safety/);
  assert.match(resolver,/comments?/);
  assert.match(resolver,/recommended/);
  assert.match(resolver,/modInfoText/);
  assert.match(api,/modInfoText:m\.modInfoText/);
  assert.match(ui,/Core Content/);
  assert.match(ui,/appModInfo/);
});

test('V2.6 SEO metadata reads multiple standard meta forms without body invention',()=>{
  assert.match(resolver,/function metaValues/);
  assert.match(resolver,/og:title/);
  assert.match(resolver,/twitter:title/);
  assert.match(resolver,/og:description/);
  assert.match(resolver,/twitter:description/);
});

test('invalid raw size labels can no longer mask valid byte values',()=>{
  assert.match(api,/find\(v=>typeof v==='string'&&apkFields\.parseBytes\(v\)\)\|\|null/);
  assert.match(api,/firstParsedBytes\(m\.fileSizeBytes,m\.fileSizeRaw,m\.size/);
  assert.match(ui,/rawSizeValues\.find\(v=>typeof v==='string'&&/);
  assert.match(ui,/const sizeDisplay=sizeLabel\|\|bytes\(x\.fileSizeBytes\?\?m\.fileSizeBytes\)/);
});

test('fresh scan can recover size from any supported metadata key before database merge',()=>{
  assert.match(resolver,/recover a size that the fresh scan already found/);
  assert.match(resolver,/details\.metadata\?\.fileSizeRaw/);
  assert.match(resolver,/details\.metadata\?\.packageSize/);
});
