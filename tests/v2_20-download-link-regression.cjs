const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('V2.20 copied links use the real filename, not the internal R2 object key',()=>{
  const service=read('src/services/r2.js');
  assert.match(service,/function publicUrlForFilename/);
  assert.match(service,/publicUrl:publicUrlForFilename\(row\.filename,downloadHost\)/);
  assert.match(service,/objectPublicUrl\(account,obj,downloadHost=''\).*publicUrlForFilename\(obj\.filename/);
  assert.doesNotMatch(service,/publicUrl:publicUrlForKey\(row\.object_key,downloadHost\)/);
});

test('V2.20 filename download gateway resolves by filename and forces attachment',()=>{
  const service=read('src/services/r2.js');
  const nextPage=read('pages/[[...path]].jsx');
  const downloads=read('src/routes/downloads.js');
  assert.match(service,/WHERE o\.filename=\?/);
  assert.match(nextPage,/Content-Disposition/);
  assert.match(nextPage,/attachment; filename=/);
  assert.match(downloads,/Content-Disposition/);
  assert.match(downloads,/attachment; filename=/);
});

test('V2.20 file-like URLs never fall through to the Appbit page',()=>{
  const nextPage=read('pages/[[...path]].jsx');
  const downloads=read('src/routes/downloads.js');
  assert.match(nextPage,/if\(dedicated\|\|filenameLike\)\{[\s\S]*File not found\./);
  assert.match(downloads,/if\(dedicated\|\|filenameLike\)\{[\s\S]*File not found\./);
  assert.match(nextPage,/Cache-Control','no-store/);
});

test('V2.21 keeps an HTTPS gateway probe as a fallback while one-record CNAME verification is primary',()=>{
  const service=read('src/services/r2.js');
  const ui=read('public/ui/app.js');
  assert.match(service,/async function verifyDownloadGateway/);
  assert.match(service,/https:\/\/\$\{hostname\}\/api\/health\/public/);
  assert.match(service,/resolveCnameTargets/);
  assert.match(ui,/ONE DNS record/);
  assert.doesNotMatch(ui,/Verify DNS \+ HTTPS/);
});

test('V2.20 keeps legacy token/path readers only for old links',()=>{
  const service=read('src/services/r2.js');
  const downloads=read('src/routes/downloads.js');
  assert.match(downloads,/Backward compatibility/);
  assert.match(downloads,/\/d\/:token/);
  assert.match(service,/V2\.18 compatibility/);
});

test('V2.20 deactivates pre-V2.20 custom domains so broken TXT-only hostnames are not reused',()=>{
  const migrations=read('src/migrations.js');
  assert.match(migrations,/SCHEMA_VERSION = 133/);
  assert.match(migrations,/currentVersion<132/);
  assert.match(migrations,/UPDATE r2_download_domains SET active=0,verified_at=NULL/);
});
