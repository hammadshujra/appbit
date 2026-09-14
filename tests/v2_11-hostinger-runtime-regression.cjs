const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('release identity is bundled and never reads loose VERSION at runtime',()=>{
  const version=read('src/version.js');
  assert.match(version,/version:'2\.22'/);
  assert.match(version,/buildId:'2\.22-approved-responsive-file-manager'/);
  assert.doesNotMatch(version,/readFileSync|node:fs|BUILD-INFO\.json|path\.join/);
  const page=read('pages/[[...path]].jsx');
  assert.match(page,/APP_VERSION='2\.22'/);
  assert.doesNotMatch(page,/readFileSync|node:fs|BUILD-INFO\.json/);
});

test('Hostinger Next preset starts native Next and has an API catch-all around the existing Appbit backend',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.start,'next start');
  assert.ok(fs.existsSync(path.join(root,'pages','api','[[...path]].js')));
  const route=read('pages/api/[[...path]].js');
  const backend=read('src/next-api-app.js');
  assert.match(route,/bodyParser:\s*false/);
  assert.match(route,/responseLimit:\s*false/);
  assert.match(route,/next-api-app/);
  assert.match(backend,/app\.use\('\/api',require\('\.\/routes\/api'\)\)/);
  assert.match(backend,/app\.use\('\/api\/auth',require\('\.\/routes\/auth'\)\)/);
  assert.match(backend,/app\.use\('\/api\/_download',require\('\.\/routes\/downloads'\)\)/);
  assert.match(backend,/startDatabaseInitialization\(\)/);
  assert.match(backend,/PLAYWRIGHT_BROWSERS_PATH/);
});

test('native Next login and R2 public download routes are wired for managed Hostinger runtime',()=>{
  const login=read('pages/login.jsx');
  const ui=read('public/ui/app.js');
  const cfg=read('next.config.js');
  assert.match(login,/\/api\/session\/csrf/);
  assert.match(login,/action="\/api\/auth\/login"/);
  assert.match(ui,/action="\/api\/auth\/logout"/);
  assert.match(ui,/r\.status===401/);
  assert.match(cfg,/source:'\/d\/:token'/);
  assert.match(cfg,/destination:'\/api\/_download\/d\/:token'/);
});

test('database-not-ready API path returns JSON instead of requiring EJS files from .next/server',()=>{
  const dbReady=read('src/middleware/db-ready.js');
  assert.match(dbReady,/res\.status\(503\)\.json/);
  assert.match(dbReady,/req\.originalUrl\.startsWith\('\/api\/'\)/);
});
