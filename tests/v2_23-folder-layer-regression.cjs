const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('V2.23 ships the two supplied folder layer SVG assets',()=>{
  assert.ok(fs.existsSync(path.join(root,'public','folder-layer-back.svg')));
  assert.ok(fs.existsSync(path.join(root,'public','folder-layer-front.svg')));
  const back=read('public/folder-layer-back.svg');
  const front=read('public/folder-layer-front.svg');
  assert.match(back,/viewBox="0 0 634 394"/);
  assert.match(front,/viewBox="0 0 543 41"/);
});

test('V2.23 folder tile has strict back -> manual app icon -> front composition',()=>{
  const ui=read('public/ui/app.js');
  const tile=/function r2FolderTile\(folder\)[\s\S]*?function r2FolderGridHtml/.exec(ui)?.[0]||'';
  assert.match(tile,/r2-folder-back-layer[^`]*\$\{iconHtml\}[^`]*r2-folder-front-layer/);
  assert.match(tile,/iconHtml=folder\.hasIcon&&folder\.iconUrl\?`<img class=\"r2-folder-app-icon/);
  assert.match(tile,/folder\.hasIcon&&folder\.iconUrl/);
  assert.doesNotMatch(tile,/extract.*icon/i);
});

test('V2.23 CSS locks the three layer z-order and removes Account One circle',()=>{
  const css=read('public/ui/app.css');
  assert.match(css,/\.r2-file-manager-v222 \.r2-folder-back-layer\{[^}]*z-index:1/);
  assert.match(css,/\.r2-file-manager-v222 \.r2-folder-app-icon\{[^}]*z-index:2/);
  assert.match(css,/\.r2-file-manager-v222 \.r2-folder-front-layer\{[^}]*z-index:3/);
  assert.match(css,/\.r2-account-heading-icon\{[^}]*border-radius:0!important;[^}]*background:transparent!important/);
});

test('V2.23 folder create/change previews use the same three-layer stack',()=>{
  const ui=read('public/ui/app.js');
  assert.match(ui,/r2-icon-preview-back[^>]*folder-layer-back\.svg/);
  assert.match(ui,/r2-icon-preview-front[^>]*folder-layer-front\.svg/);
  assert.match(ui,/id="r2FolderIconPreview"/);
  assert.match(ui,/id="r2ChangeIconPreview"/);
});

test('V2.23 release metadata is consistent',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'2.23.0');
  assert.equal(read('VERSION').trim(),'2.23');
  assert.match(read('src/version.js'),/version:'2\.23'/);
  assert.match(read('src/version.js'),/buildId:'2\.23-three-layer-folder-fix'/);
  assert.match(read('pages/[[...path]].jsx'),/APP_VERSION='2\.23'/);
});
