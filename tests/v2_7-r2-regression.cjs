const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sig=require('../src/utils/r2-sigv4');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('R2 schema keeps V2.7 tables in current schema',()=>{
  const m=read('src/migrations.js');
  assert.match(m,/SCHEMA_VERSION = 133/);
  for(const table of ['r2_accounts','r2_objects','r2_uploads'])assert.match(m,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
});

test('SigV4 canonical query is stable and RFC3986 encoded',()=>{
  assert.equal(sig.canonicalQuery({z:'two words',a:'x',uploads:''}),'a=x&uploads=&z=two%20words');
  assert.equal(sig.canonicalPath('/bucket/a b/test.apk'),'/bucket/a%20b/test.apk');
});

test('SigV4 request signing is deterministic',()=>{
  const out=sig.signRequest({method:'GET',url:'https://example.r2.cloudflarestorage.com/bucket?list-type=2&max-keys=10',accessKeyId:'AKID',secretAccessKey:'SECRET',region:'auto',now:new Date('2026-09-13T10:00:00Z')});
  assert.match(out.headers.Authorization,/^AWS4-HMAC-SHA256 Credential=AKID\/20260913\/auto\/s3\/aws4_request/);
  assert.equal(out.signature.length,64);
  assert.match(out.canonicalRequest,/list-type=2&max-keys=10/);
});

test('R2 service implements encrypted secrets and multipart lifecycle',()=>{
  const r=read('src/services/r2.js');
  assert.match(r,/aes-256-gcm/);
  for(const name of ['startUpload','uploadPart','completeUpload','abortUpload','syncAccount','createFolder','deleteObject','streamByToken'])assert.match(r,new RegExp(`function ${name}\\b|async function ${name}\\b`));
  assert.match(r,/DEFAULT_PART=5\*MiB/);
  assert.match(r,/MAX_FILE_SIZE=10\*GiB/);
  assert.match(r,/timeoutMs:15\*60\*1000/);
  assert.match(r,/Content-MD5/);
  assert.match(r,/file_size_bytes/);
});

test('R2 API is admin-only and supports account, sync, upload, replace/delete flows',()=>{
  const api=read('src/routes/api.js');
  for(const route of ["/r2/state","/r2/accounts","/r2/folders","/r2/objects","/r2/uploads/start","/r2/uploads/:token/complete"])assert.ok(api.includes(route),route);
  assert.match(api,/express\.raw\(\{type:'application\/octet-stream',limit:'70mb'\}\)/);
  assert.match(api,/requireAdmin/);
});

test('Public download gateway keeps legacy tokens and adds direct paths without exposing R2 credentials',()=>{
  const d=read('src/routes/downloads.js');
  assert.match(d,/\/d\/:token/);
  assert.match(d,/streamByToken/);
  assert.match(d,/streamByPath/);
  assert.doesNotMatch(d,/accessKeyId|secretAccessKey/);
});

test('R2 UI is nested under Update Center and has resumable multipart upload',()=>{
  const ui=read('public/ui/app.js');
  assert.match(ui,/R2 Account/);
  assert.match(ui,/navItem\('r2-accounts','Accounts','cloud','',true\)/);
  assert.match(ui,/navItem\('r2-files','File Manager','android','',true\)/);
  assert.match(ui,/appbit:r2:resume/);
  assert.match(ui,/for\(let attempt=1;attempt<=8/);
  assert.match(ui,/navigator\.connection\?\.effectiveType/);
  assert.match(ui,/multiple/);
  assert.match(ui,/data-r2-folder/);
  assert.match(ui,/appbit:r2:resumes/);
  assert.match(ui,/id="r2Dropzone"/);
  assert.match(ui,/Copy link/);
  assert.doesNotMatch(ui,/data-r2-replace/);
  assert.match(ui,/Delete/);
});

test('R2 upload page is responsive and shows account/file controls',()=>{
  const css=read('public/ui/app.css');
  assert.match(css,/\.r2-page/);
  assert.match(css,/\.r2-account-grid/);
  assert.match(css,/@media\(max-width:720px\)/);
  const server=read('server.js');
  assert.match(server,/server\.requestTimeout=60\*60\*1000/);
  const nextPage=read('pages/[[...path]].jsx');
  assert.match(server,/r2\/accounts/);
  assert.match(nextPage,/Appbit — APK Publishing Workspace/);
});
