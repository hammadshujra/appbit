const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('V2.17 has exactly one Hostinger API catch-all and no legacy module route',()=>{
  const expected=path.join(root,'pages','api','[[...path]].js');
  assert.ok(fs.existsSync(expected));
  assert.ok(!fs.existsSync(path.join(root,'pages','api','[...path].mjs')));
  assert.ok(!fs.existsSync(path.join(root,'pages','api','[...path].js')));
  assert.ok(!fs.existsSync(path.join(root,'pages','api','[[...path]].mjs')));
  const route=read('pages/api/[[...path]].js');
  assert.match(route,/^import backendModule from/m);
  assert.match(route,/export const config/);
  assert.match(route,/export default function appbitApi/);
  assert.doesNotMatch(route,/\brequire\s*\(|module\.exports|exports\./);
  cp.execFileSync(process.execPath,['--input-type=module','--check'],{input:route,stdio:['pipe','pipe','pipe']});
});

test('package does not force CommonJS classification over Next page sources',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.type,undefined);
  assert.equal(pkg.version,'2.21.0');
  assert.equal(pkg.scripts.prebuild,'node scripts/hostinger-prebuild.js');
  assert.equal(pkg.scripts.build,'next build --webpack');
  assert.equal(pkg.scripts.start,'next start');
  assert.equal(read('VERSION').trim(),'2.21');
  assert.match(read('next.config.js'),/pageExtensions:\['js','jsx'\]/);
});

test('prebuild guard cleans stale API bridge layouts before compilation',()=>{
  const guard=read('scripts/hostinger-prebuild.js');
  assert.match(guard,/\[\[\.\.\.path\]\]\.js/);
  assert.match(guard,/\[\.\.\.path\]\.mjs/);
  assert.match(guard,/removeStaleRoutes/);
  assert.match(guard,/unlinkSync/);
  assert.match(guard,/package\.json must not force a package-wide module type/);
  cp.execFileSync(process.execPath,[path.join(root,'scripts','hostinger-prebuild.js'),'--check-only'],{cwd:root,stdio:'pipe'});
});
