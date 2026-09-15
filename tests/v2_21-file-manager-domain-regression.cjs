const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('V2.21 File Manager sidebar has expandable R2 accounts and nested folders',()=>{
  const ui=read('public/ui/app.js'),service=read('src/services/r2.js'),api=read('src/routes/api.js');
  assert.match(ui,/function r2SidebarNav/);
  assert.match(ui,/data-r2-side-toggle/);
  assert.match(ui,/data-r2-side-account-root/);
  assert.match(ui,/data-r2-side-folder/);
  assert.match(service,/async function folderTree/);
  assert.match(api,/\/r2\/tree/);
});

test('V2.21 clicking File Manager in the sidebar resets to the disk root',()=>{
  const ui=read('public/ui/app.js');
  assert.match(ui,/if\(b\.dataset\.nav==='r2-files'\)\{S\.r2\.fileAccountId=0;S\.r2\.prefix=''/);
});

test('V2.21 folder cards show file counts and optional custom app icons',()=>{
  const ui=read('public/ui/app.js'),css=read('public/ui/app.css'),service=read('src/services/r2.js'),migrations=read('src/migrations.js');
  assert.match(ui,/r2-folder-app-icon/);
  assert.match(ui,/fileCount/);
  assert.match(ui,/id="r2FolderIcon"/);
  assert.match(css,/\.r2-folder-app-icon/);
  assert.match(service,/parseFolderIconData/);
  assert.match(service,/r2_folder_meta/);
  assert.match(migrations,/CREATE TABLE IF NOT EXISTS r2_folder_meta/);
});

test('V2.21 custom download domain uses one CNAME record and no TXT setup UI',()=>{
  const ui=read('public/ui/app.js'),service=read('src/services/r2.js');
  assert.match(ui,/ONE DNS record/);
  assert.match(ui,/CNAME/);
  assert.match(ui,/No TXT verification record is required/);
  assert.doesNotMatch(ui,/TXT name|TXT value|Verify DNS \+ HTTPS/);
  assert.match(service,/resolveCnameTargets/);
  assert.match(service,/Create ONE CNAME record/);
  assert.doesNotMatch(service,/resolveTxt/);
});

test('V2.21 schema and release metadata are current',()=>{
  const pkg=JSON.parse(read('package.json'));
  const migration=read('src/migrations.js');
  assert.equal(pkg.version,'2.5.0');
  assert.equal(read('VERSION').trim(),'2.5');
  assert.match(migration,/SCHEMA_VERSION = 133/);
});
