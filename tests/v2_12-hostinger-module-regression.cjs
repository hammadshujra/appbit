const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('V2.12 postbuild compatibility guard remains in current release',()=>{
  const pkg=JSON.parse(read('package.json'));
  const post=read('scripts/hostinger-postbuild.js');
  assert.equal(pkg.scripts.build,'next build --webpack');
  assert.equal(pkg.scripts.postbuild,'node scripts/hostinger-postbuild.js');
  assert.match(post,/\.next','server'/);
  assert.match(post,/VERSION/);
  assert.match(post,/BUILD-INFO\.json/);
  assert.match(post,/writeFileSync/);
  assert.equal(read('VERSION').trim(),'2.13');
});
