const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('V2.19 exposes a public, secret-free deployment health page',()=>{
  assert.ok(fs.existsSync(path.join(root,'pages','health.jsx')));
  const page=read('pages/health.jsx'),backend=read('src/next-api-app.js');
  assert.match(page,/\/api\/health\/public/);
  assert.match(page,/Database and application checks are passing/);
  assert.match(backend,/app\.get\('\/api\/health\/public'/);
  assert.match(backend,/Cache-Control/);
  assert.match(backend,/state\.dbReady/);
  assert.doesNotMatch(backend,/state\.dbError.*res\.json/);
});

test('login screen has constrained responsive card styling',()=>{
  const login=read('pages/login.jsx'),css=read('public/css/app.css');
  assert.match(login,/className="login-shell"/);
  assert.match(login,/className="login-logo"/);
  assert.match(login,/href="\/health"/);
  assert.match(css,/\.login-card\{width:min\(100%,440px\)/);
  assert.match(css,/\.login-card \.stack-form input/);
  assert.match(css,/\.login-logo\{display:block/);
});

test('R2 download and folder paths remain routed without credentials',()=>{
  const service=read('src/services/r2.js'),downloads=read('src/routes/downloads.js'),cfg=read('next.config.js');
  assert.match(service,/async function createFolder/);
  assert.match(service,/application\/x-directory/);
  assert.match(service,/object_key NOT LIKE/);
  assert.match(downloads,/Content-Disposition/);
  assert.match(downloads,/attachment/);
  assert.match(cfg,/source:'\/d\/:token'/);
});

test('release has one consolidated V2.19 version note',()=>{
  const notes=read('versionnotes.md'),readme=read('README.md');
  assert.match(notes,/Appbit V2\.19/);
  assert.match(notes,/10 GB/);
  assert.match(notes,/Download-only hostname/);
  assert.match(readme,/versionnotes\.md/);
  assert.doesNotMatch(readme,/docker-compose|Dockerfile/);
});
