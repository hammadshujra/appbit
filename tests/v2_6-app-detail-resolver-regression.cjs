'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fields=require('../src/services/apk-fields');

test('V2.6 release identity is wired',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'2.6.0');
  assert.equal(read('VERSION').trim(),'2.6');
  assert.match(read('src/version.js'),/version:'2\.6'/);
  assert.match(read('pages/[[...path]].jsx'),/APP_VERSION='2\.6'/);
});

test('LiteAPKs compact M and G size units are parsed as MB and GB',()=>{
  assert.equal(fields.parseBytes('147 M'),147*1024*1024);
  assert.equal(fields.parseBytes('1.6 G'),Math.round(1.6*1024*1024*1024));
  assert.equal(fields.parseBytes('98.2 MB'),Math.round(98.2*1024*1024));
  assert.equal(fields.parseBytes('2 G'),2*1024*1024*1024);
});

test('resolver recognizes bare compact size units in source statistics',()=>{
  const src=read('src/services/apk-resolver.js');
  const fieldsSrc=read('src/services/apk-fields.js');
  assert.match(src,/SIZE_TOKEN_RE=.*\[kmgt\]/i);
  assert.match(fieldsSrc,/size:\/.*\[kmgt\]/i);
  assert.match(fieldsSrc,/parseBytes\(value\)/);
});

test('app detail removes duplicate icon artwork and uses 20/80 organization',()=>{
  const ui=read('public/ui/app.js');
  const css=read('public/ui/app.css');
  assert.match(ui,/record-artwork-no-icon/);
  assert.doesNotMatch(ui,/record-artwork-row\"><div class="record-icon-preview/);
  assert.match(ui,/record-columns record-columns-20-80/);
  assert.match(ui,/normalizedSizeLabel/);
  assert.match(css,/record-columns\.record-columns-20-80\{grid-template-columns:minmax\(235px,20fr\) minmax\(0,80fr\)/);
  for(const label of ['Meta Title','Meta Description','Description'])assert.ok(ui.includes(label),`missing ${label}`);
});

test('Download Media ZIP includes icon cover screenshots and manifest',()=>{
  const media=read('src/services/apk-media.js');
  assert.match(media,/media\.iconUrl/);
  assert.match(media,/media\.coverImageUrl/);
  assert.match(media,/media\.screenshots\.forEach/);
  assert.match(media,/media-manifest\.json/);
});
