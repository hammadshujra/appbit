const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('V2.9 is a Next.js Hostinger package',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'2.9.0');
  assert.equal(pkg.dependencies.next,'16.3.3');
  assert.equal(pkg.dependencies.react,'19.2.0');
  assert.equal(pkg.scripts.build,'next build');
  assert.equal(pkg.scripts.start,'node server.js');
  assert.equal(read('VERSION').trim(),'2.9');
  assert.ok(fs.existsSync(path.join(root,'next.config.js')));
  assert.ok(fs.existsSync(path.join(root,'pages','[[...path]].jsx')));
  assert.ok(!fs.existsSync(path.join(root,'astro.config.mjs')));
});

test('custom Next server preserves protected Appbit backend routes',()=>{
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

test('Hostinger instructions use Next.js output and server entry',()=>{
  const doc=read('HOSTINGER-DEPLOY.md');
  assert.match(doc,/Framework: \*\*Next\.js\*\*/);
  assert.match(doc,/Output directory: \*\*\.next\*\*/);
  assert.match(doc,/Entry file: \*\*server\.js\*\*/);
  assert.match(doc,/Node\.js: \*\*24\.x\*\*/);
  assert.ok(fs.existsSync(path.join(root,'hostinger.env.example')));
});
