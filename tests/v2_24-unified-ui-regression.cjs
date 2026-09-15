const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('V2.5 folder cards use only the user supplied app icon and no folder layers',()=>{
  const ui=read('public/ui/app.js'),css=read('public/ui/app.css');
  const tile=/function r2FolderTile\(folder\)[\s\S]*?function r2FolderGridHtml/.exec(ui)?.[0]||'';
  assert.match(tile,/r2-folder-app-icon/);
  assert.match(tile,/r2-folder-empty-app-icon/);
  assert.doesNotMatch(tile,/folder-layer-back|folder-layer-front|r2-folder-back-layer|r2-folder-front-layer/);
  assert.doesNotMatch(ui,/src="\/folder-layer-back\.svg"|src="\/folder-layer-front\.svg"/);
  assert.ok(!fs.existsSync(path.join(root,'public','folder-layer-back.svg')));
  assert.ok(!fs.existsSync(path.join(root,'public','folder-layer-front.svg')));
  assert.match(css,/Folder cards are now app-icon cards/);
});

test('V2.5 folder create and change-icon previews show the app icon only',()=>{
  const ui=read('public/ui/app.js');
  assert.match(ui,/r2-icon-app-only-preview/);
  assert.match(ui,/id="r2FolderIconPreview"/);
  assert.match(ui,/id="r2ChangeIconPreview"/);
  assert.match(ui,/card is created without an app icon/);
  assert.doesNotMatch(ui,/r2-icon-preview-back[^\n]*folder-layer-back|r2-icon-preview-front[^\n]*folder-layer-front/);
});

test('V2.5 has a persistent desktop sidebar rail and a mobile full-sidebar toggle',()=>{
  const ui=read('public/ui/app.js'),css=read('public/ui/app.css');
  assert.match(ui,/id="appShell"/);
  assert.match(ui,/id="sidebarToggle"/);
  assert.match(ui,/appbit-sidebar-collapsed/);
  assert.match(ui,/localStorage\.setItem\('appbit-sidebar-collapsed'/);
  assert.doesNotMatch(ui,/id="mobileMenu"/);
  assert.match(css,/\.shell\.sidebar-collapsed \.sidebar\{width:var\(--app-sidebar-collapsed\)/);
  assert.match(css,/\.shell\.sidebar-collapsed \.nav-label-text/);
  assert.match(css,/\.shell\.mobile-sidebar-open \.sidebar-edge-toggle/);
});

test('V2.5 applies File Manager page width and control geometry across the app',()=>{
  const css=read('public/ui/app.css');
  assert.match(css,/\.content,\.content\.r2-wide-content\{[\s\S]*?max-width:none/);
  assert.match(css,/One card language across Dashboard, Library, Publishing, R2 and Settings/);
  assert.match(css,/\.btn,\.btn\.primary[\s\S]*?border-radius:var\(--app-control-radius\)!important/);
  assert.match(css,/\.library-card-grid\{[\s\S]*?grid-template-columns:repeat\(auto-fill,minmax\(150px,180px\)\)/);
});

test('V2.5 release metadata is consistent',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'2.5.0');
  assert.equal(read('VERSION').trim(),'2.5');
  assert.match(read('src/version.js'),/version:'2\.24'/);
  assert.match(read('src/version.js'),/buildId:'2\.24-unified-ui-sidebar-app-icon-folders'/);
  assert.match(read('pages/[[...path]].jsx'),/APP_VERSION='2\.24'/);
  assert.match(read('scripts/hostinger-prebuild.js'),/expected VERSION 2\.24/);
});
