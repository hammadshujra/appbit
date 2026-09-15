const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('current release is a Next.js Hostinger Webpack package',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'2.5.0');
  assert.equal(pkg.dependencies.next,'16.3.3');
  assert.equal(pkg.dependencies.react,'19.2.0');
  assert.equal(pkg.scripts.build,'next build --webpack');
  assert.equal(pkg.scripts['build:hostinger'],'npm run build');
  assert.equal(pkg.scripts.start,'next start');
  assert.equal(read('VERSION').trim(),'2.5');
  assert.ok(fs.existsSync(path.join(root,'next.config.js')));
  assert.ok(fs.existsSync(path.join(root,'pages','[[...path]].jsx')));
  assert.ok(!fs.existsSync(path.join(root,'astro.config.mjs')));
});

test('legacy custom Next server remains available for compatibility',()=>{
  const server=read('server.js');
  assert.match(server,/const next=require\('next'\)/);
  assert.match(server,/req\.path\.startsWith\('\/_next\/static\/'\)/);
  assert.match(server,/src\/routes\/downloads/);
  assert.match(server,/src\/routes\/health/);
  assert.match(server,/src\/routes\/auth/);
  assert.match(server,/app\.use\('\/api'/);
  assert.match(server,/requireDb,requireAuth,requireActiveUser/);
  assert.match(server,/server\.requestTimeout=60\*60\*1000/);
});

test('Hostinger instructions force Webpack and use the managed Next.js runtime',()=>{
  const doc=read('HOSTINGER-DEPLOY.md');
  assert.match(doc,/Framework preset: \*\*Next\.js\*\*/);
  assert.match(doc,/Output directory: \*\*\.next\*\*/);
  assert.match(doc,/Node\.js: \*\*24\.x\*\*/);
  assert.match(doc,/Build command: \*\*npm run build\*\*/);
  assert.match(doc,/next build --webpack/);
  assert.match(doc,/do not need a custom Entry File/i);
  assert.ok(fs.existsSync(path.join(root,'hostinger.env.example')));
});
