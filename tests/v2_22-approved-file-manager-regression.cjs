const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('V2.22 matches the approved full-width responsive File Manager structure',()=>{
  const ui=read('public/ui/app.js'),css=read('public/ui/app.css');
  assert.match(ui,/r2-file-manager-v222/);
  assert.match(ui,/r2-stats-premium/);
  assert.match(css,/\.content\.r2-wide-content\{max-width:none/);
  assert.match(css,/\.r2-file-manager-v222 \.r2-stats-premium\{grid-template-columns:repeat\(4/);
  assert.match(css,/@media\(max-width:1180px\)/);
  assert.match(css,/@media\(max-width:900px\)/);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.match(css,/@media\(max-width:430px\)/);
});

test('V2.22 account toolbar is reduced to search and New Folder',()=>{
  const ui=read('public/ui/app.js');
  assert.match(ui,/Search this account/);
  assert.match(ui,/id="r2NewFolder"/);
  assert.doesNotMatch(ui,/id="r2BackDisks"|id="r2UpFolder"|id="r2ReloadFiles"|id="r2ReloadDisks"/);
});

test('V2.22 has global search that can jump to files and folders',()=>{
  const ui=read('public/ui/app.js');
  assert.match(ui,/Search all R2 files and folders/);
  assert.match(ui,/runR2ManagerSearch/);
  assert.match(ui,/data-r2-search-folder/);
  assert.match(ui,/data-r2-search-file/);
  assert.match(ui,/S\.r2\.prefix=r2ParentPath\(b\.dataset\.r2SearchKey\)/);
});

test('V2.22 folder icons are manual only and use the supplied base folder artwork',()=>{
  const ui=read('public/ui/app.js');
  assert.ok(fs.existsSync(path.join(root,'public','folder-icon.svg')));
  assert.match(ui,/Appbit will never insert an app icon automatically/);
  assert.match(ui,/right-click → Change Icon/);
  assert.match(ui,/id="r2FolderIcon"/);
  assert.match(ui,/\/api\/r2\/folders\/icon/);
  assert.doesNotMatch(ui,/extract.*apk.*icon|apk.*icon.*extract/i);
});

test('V2.22 right-click management supports folder and file rename/delete',()=>{
  const ui=read('public/ui/app.js'),api=read('src/routes/api.js'),service=read('src/services/r2.js');
  assert.match(ui,/oncontextmenu/);
  assert.match(ui,/openR2FolderRenameModal/);
  assert.match(ui,/deleteR2Folder/);
  assert.match(ui,/openR2FileRenameModal/);
  assert.match(api,/\/r2\/folders\/rename/);
  assert.match(api,/\/r2\/folders\/delete/);
  assert.match(api,/\/r2\/objects\/:id\/rename/);
  assert.match(service,/async function renameFolder/);
  assert.match(service,/async function deleteFolder/);
  assert.match(service,/async function renameObject/);
});

test('V2.22 release metadata is consistent',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'2.22.0');
  assert.equal(read('VERSION').trim(),'2.22');
  assert.match(read('src/version.js'),/version:'2\.22'/);
  assert.match(read('pages/[[...path]].jsx'),/APP_VERSION='2\.22'/);
});
