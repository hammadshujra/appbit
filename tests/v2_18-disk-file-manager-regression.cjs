const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('V2.18 removes the hidden R2 root-folder setting and treats account label as disk metadata only',()=>{
  const service=read('src/services/r2.js'),ui=read('public/ui/app.js'),migration=read('src/migrations.js');
  assert.match(service,/folder_prefix=NULL/);
  assert.doesNotMatch(service,/cleanPrefix\(account\.folder_prefix/);
  assert.doesNotMatch(ui,/Disk Root Folder|r2FolderPrefix/);
  assert.match(ui,/Account Label/);
  assert.match(ui,/account label is the disk name/i);
  assert.match(migration,/UPDATE r2_accounts SET folder_prefix=NULL/);
});

test('V2.18 file manager opens disks and uses current-folder explorer semantics',()=>{
  const service=read('src/services/r2.js'),ui=read('public/ui/app.js');
  assert.match(ui,/Open Disk/);
  assert.match(ui,/r2-disk-grid/);
  assert.match(ui,/New folder/);
  assert.match(ui,/r2BreadcrumbHtml/);
  assert.match(service,/const parent=cleanPrefix\(prefix\)/);
  assert.match(service,/!key\.slice\(base\.length\)\.includes\('\/'\)/);
});

test('V2.18 supports Windows drag-drop multi-upload with per-file progress rows',()=>{
  const ui=read('public/ui/app.js'),css=read('public/ui/app.css');
  assert.match(ui,/id="r2Dropzone"/);
  assert.match(ui,/type="file" multiple/);
  assert.match(ui,/uploadR2Files/);
  assert.match(ui,/Math\.min\(2,files\.length\)/);
  assert.match(ui,/r2-queue-row/);
  assert.match(ui,/data-r2-queue-bar/);
  assert.match(css,/\.r2-dropzone/);
  assert.match(css,/\.r2-queue-row/);
});

test('V2.18 explorer shows requested metadata and file actions',()=>{
  const ui=read('public/ui/app.js');
  for(const heading of ['Name','Modified','Uploaded','Type','Size','Actions'])assert.ok(ui.includes(`<span>${heading}</span>`),heading);
  assert.match(ui,/Copy link/);
  assert.match(ui,/Delete/);
  assert.doesNotMatch(ui,/data-r2-replace/);
});


test('direct public URL format is exactly domain/object-path and preserves real filenames',()=>{
  const vm=require('node:vm');
  const source=read('src/services/r2.js');
  const mod={exports:{}};
  vm.runInNewContext(source,{module:mod,exports:mod.exports,require:id=>{
    if(id==='../db')return{getPool:()=>({})};
    if(id==='../config')return{r2CredentialsKey:'test-key-material-1234567890',sessionSecret:'test-session-secret-1234567890'};
    if(id==='../utils/r2-sigv4')return require('../src/utils/r2-sigv4');
    return require(id);
  },URL,Buffer,fetch,console,setTimeout,clearTimeout},{filename:'r2.js'});
  assert.equal(mod.exports.publicUrlForKey('tiktok.apk','example.com'),'https://example.com/tiktok.apk');
  assert.equal(mod.exports.publicUrlForKey('Tik Tok/tiktok latest.apk','downloads.example.com'),'https://downloads.example.com/Tik%20Tok/tiktok%20latest.apk');
});

test('V2.18 generates domain/path links and serves them as attachment downloads',()=>{
  const service=read('src/services/r2.js'),page=read('pages/[[...path]].jsx'),downloads=read('src/routes/downloads.js');
  assert.match(service,/function publicUrlForKey/);
  assert.match(service,/publicUrl:publicUrlForKey\(row\.object_key,downloadHost\)/);
  assert.match(service,/async function streamByPath/);
  assert.match(page,/r2\.streamByPath/);
  assert.match(page,/Content-Disposition/);
  assert.match(page,/attachment/);
  assert.match(downloads,/streamByPath/);
  assert.match(downloads,/Content-Disposition/);
  assert.match(downloads,/\/d\/:token/); // old V2.17 links stay valid
});
