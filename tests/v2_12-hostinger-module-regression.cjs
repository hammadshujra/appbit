const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('V2.12 API bridge is explicitly ESM and no mixed CommonJS route remains',()=>{
  const routePath=path.join(root,'pages','api','[...path].mjs');
  assert.ok(fs.existsSync(routePath));
  assert.ok(!fs.existsSync(path.join(root,'pages','api','[[...path]].js')));
  const route=read('pages/api/[...path].mjs');
  assert.match(route,/^import backendModule from/m);
  assert.match(route,/export const config/);
  assert.match(route,/export default function appbitApi/);
  assert.doesNotMatch(route,/\brequire\s*\(/);
  cp.execFileSync(process.execPath,['--check',routePath],{stdio:'pipe'});
});

test('Next page extensions include mjs and production stays on Webpack',()=>{
  const cfg=read('next.config.js');
  const pkg=JSON.parse(read('package.json'));
  assert.match(cfg,/pageExtensions:\['js','jsx','mjs'\]/);
  assert.equal(pkg.scripts.build,'next build --webpack');
  assert.equal(pkg.scripts.postbuild,'node scripts/hostinger-postbuild.js');
  assert.equal(pkg.scripts.start,'next start');
});

test('postbuild finalizer writes compatibility release files into .next/server',()=>{
  const post=read('scripts/hostinger-postbuild.js');
  assert.match(post,/\.next','server'/);
  assert.match(post,/VERSION/);
  assert.match(post,/BUILD-INFO\.json/);
  assert.match(post,/writeFileSync/);
  assert.equal(read('VERSION').trim(),'2.12');
});
