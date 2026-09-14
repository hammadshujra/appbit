const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('V2.8 adds download-domain schema and domain API',()=>{
  const m=read('src/migrations.js'),api=read('src/routes/api.js');
  assert.match(m,/SCHEMA_VERSION = 133/);
  assert.match(m,/CREATE TABLE IF NOT EXISTS r2_download_domains/);
  for(const route of ["/r2/domains","/r2/domains/:id/verify"])assert.ok(api.includes(route),route);
});

test('R2 account setup is inline and limited to required fields',()=>{
  const ui=read('public/ui/app.js');
  assert.match(ui,/id="r2AccountForm"/);
  assert.match(ui,/Cloudflare Account ID/);
  assert.match(ui,/Bucket Name/);
  assert.match(ui,/Access Key ID/);
  assert.match(ui,/Secret Access Key/);
  assert.doesNotMatch(ui,/openR2AccountModal/);
  assert.doesNotMatch(ui,/id="r2Endpoint"|id="r2Region"|id="r2LinkMode"|id="r2GatewayDomain"|id="r2DirectDomain"/);
});

test('sidebar exposes R2 Account submenus and dedicated routes',()=>{
  const ui=read('public/ui/app.js'),nextPage=read('pages/[[...path]].jsx'),server=read('server.js');
  assert.match(ui,/R2 Account/);
  assert.match(ui,/r2-accounts/);
  assert.match(ui,/r2-files/);
  assert.match(server,/r2\/accounts/);
  assert.match(server,/r2\/files/);
  assert.match(nextPage,/Loading Appbit/);
  assert.match(server,/redirect\('\/r2\/accounts'\)/);
});

test('account cards expose tracked used and remaining storage',()=>{
  const service=read('src/services/r2.js'),ui=read('public/ui/app.js');
  assert.match(service,/remainingBytes/);
  assert.match(service,/usagePercent/);
  assert.match(service,/DEFAULT_TARGET=10\*GiB/);
  assert.match(ui,/Tracked Remaining/);
  assert.match(ui,/10 GB tracking target/);
});

test('download domain uses one CNAME record with simple verification',()=>{
  const service=read('src/services/r2.js'),ui=read('public/ui/app.js');
  assert.match(service,/resolveCnameTargets/);
  assert.match(service,/Create ONE CNAME record/);
  assert.doesNotMatch(service,/dns\.resolveTxt/);
  assert.match(ui,/ONE DNS record/);
  assert.match(ui,/CNAME/);
  assert.match(ui,/I added the CNAME — Verify/);
  assert.doesNotMatch(ui,/TXT name|TXT value|Verify DNS \+ HTTPS/);
});

test('file manager keeps folders, folder-only bulk upload, resume, delete, and the V2.22 search bar',()=>{
  const ui=read('public/ui/app.js');
  assert.match(ui,/Search all R2 files and folders/);
  assert.match(ui,/Search this account/);
  assert.match(ui,/Drop files here to upload/);
  assert.match(ui,/New Folder/i);
  assert.match(ui,/\/api\/r2\/folders/);
  assert.match(ui,/appbit:r2:resume/);
  assert.match(ui,/appbit:r2:resumes/);
  assert.doesNotMatch(ui,/data-r2-replace/);
  assert.match(ui,/Delete/);
  assert.match(ui,/keyMode:'name'/);
  assert.match(ui,/objectKey/);
});
