'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const fields=require('../src/services/apk-fields');
const resolver=fs.readFileSync(path.join(root,'src/services/apk-resolver.js'),'utf8');
const source=fs.readFileSync(path.join(root,'src/services/apk-source.js'),'utf8');
const api=fs.readFileSync(path.join(root,'src/routes/api.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'public/ui/app.js'),'utf8');

test('release keeps the requested two-part visible version format',()=>{
  assert.match(fs.readFileSync(path.join(root,'VERSION'),'utf8').trim(),/^2\.\d+$/);
});

test('V2.4 accepts source size labels and exact raw size formats',()=>{
  assert.equal(fields.parseBytes('17 MB'),17*1024*1024);
  assert.equal(fields.parseBytes('310.7 MB'),Math.round(310.7*1024*1024));
  assert.equal(fields.parseBytes('1.5 GB'),Math.round(1.5*1024**3));
});

test('V2.4 rendering fallback and size/content recovery remain present',()=>{
  assert.match(source,/BROWSER_UA/);
  assert.match(resolver,/renderedPageSnapshot/);
  assert.match(resolver,/source:rendered-app-page/);
  assert.match(resolver,/rawHtmlSizeCandidates/);
  assert.match(resolver,/localizedSizeCandidates/);
});

test('V2.4 captures SEO metadata and source article content',()=>{
  assert.match(resolver,/function sourceContentData/);
  assert.match(resolver,/metaTitle/);
  assert.match(resolver,/metaDescription/);
  assert.match(resolver,/sourceContentText/);
  assert.match(resolver,/descriptionSectionText/);
  assert.match(api,/sourceContentText:m\.sourceContentText/);
  assert.match(ui,/(?:Source|Core) Content/);
  assert.match(ui,/Meta Title/);
  assert.match(ui,/Meta Description/);
});

test('V2.4 API displays source metadata size even while managed version is behind',()=>{
  assert.match(api,/const fileSize=rawMetaSize\|\|\(sourceDiffers\?null:/);
  assert.match(api,/fileSizeLabel:rawSizeLabel/);
  assert.match(ui,/const sizeDisplay=sizeLabel\|\|bytes/);
});
