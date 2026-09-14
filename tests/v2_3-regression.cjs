'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const fields=require('../src/services/apk-fields');
const resolver=fs.readFileSync(path.join(root,'src/services/apk-resolver.js'),'utf8');
const migrations=fs.readFileSync(path.join(root,'src/migrations.js'),'utf8');
const api=fs.readFileSync(path.join(root,'src/routes/api.js'),'utf8');
const remote=fs.readFileSync(path.join(root,'src/services/remote.js'),'utf8');

test('V2.3 accepts real app-size formats and rejects captions',()=>{
  assert.equal(fields.parseBytes('17 MB'),17*1024*1024);
  assert.equal(fields.parseBytes('141.99 MB'),Math.round(141.99*1024*1024));
  assert.equal(fields.parseBytes('1.90 GB'),Math.round(1.9*1024*1024*1024));
  assert.equal(fields.parseBytes('123 MiB'),123*1024*1024);
  assert.equal(fields.parseBytes('221 megabytes'),221*1024*1024);
  assert.equal(fields.parseBytes('Total'),null);
  assert.equal(fields.validForKey('size','Total'),null);
  assert.equal(fields.validForKey('size','310.7 MB'),'310.7 MB');
});

test('V2.3 prevents early invalid SIZE captures from poisoning later values',()=>{
  const src=fs.readFileSync(path.join(root,'src/services/apk-fields.js'),'utf8');
  assert.match(src,/if\(map\.has\('size'\)&&!parseBytes\(map\.get\('size'\)\)\)map\.delete\('size'\)/);
  assert.match(src,/function structuredFileSize/);
  assert.match(src,/downloadSize/);
  assert.match(src,/fileSizeBytes/);
});

test('V2.3 follows current app download details and has safe size fallbacks',()=>{
  assert.match(resolver,/const compatibleVersion=!secondaryVersion\|\|secondaryVersion===details\.version/);
  assert.match(resolver,/remote\.probeRemoteFileSize\(packageUrl,\{signal\}\)/);
  assert.match(resolver,/source:package-headers/);
  assert.match(resolver,/source:rendered-download-page/);
  assert.match(resolver,/source:rendered-page/);
});

test('header probing never treats a one-byte range body as the package size',()=>{
  assert.match(remote,/Content-Range|content-range/i);
  assert.match(remote,/ranged\.status===200/);
  assert.match(remote,/n>1/);
  assert.match(remote,/ranged\.body\?\.cancel/);
});

test('schema 128 recovery remains available in the current schema',()=>{
  assert.match(migrations,/const SCHEMA_VERSION = 132/);
  assert.match(migrations,/currentVersion<128/);
  assert.match(migrations,/recoverFileSizesFromMetadata/);
  assert.match(api,/(?:apkFields\.parseBytes|firstParsedBytes)/);
});

test('update scan preserves managed current-release metadata for a newer version',()=>{
  const block=resolver.slice(resolver.indexOf('async function checkUpdateForApp'),resolver.indexOf('async function markUpdated'));
  assert.match(block,/if\(!\(available&&reason==='version'\)\)await upsertManaged/);
  assert.doesNotMatch(block,/source_updated_at=COALESCE/);
});

test('visible release keeps requested two-part V2.x format',()=>{
  assert.match(fs.readFileSync(path.join(root,'VERSION'),'utf8').trim(),/^2\.\d+$/);
});
