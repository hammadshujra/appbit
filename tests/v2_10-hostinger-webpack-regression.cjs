const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Hostinger production build explicitly opts out of Turbopack',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.build,'next build --webpack');
  assert.equal(pkg.scripts['build:hostinger'],'npm run build');
  assert.equal(pkg.dependencies.next,'16.3.3');
  assert.equal(read('VERSION').trim(),'2.18');
});

test('Hostinger guide never instructs a plain Next 16 build',()=>{
  const doc=read('HOSTINGER-DEPLOY.md');
  assert.match(doc,/npm run build/);
  assert.match(doc,/next build --webpack/);
  assert.match(doc,/Do \*\*not\*\* (?:replace|change) it (?:with|to) plain `next build`/);
});
