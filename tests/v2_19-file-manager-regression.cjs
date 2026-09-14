const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('V2.19 uses the supplied folder SVG for disks and Windows-style folder tiles',()=>{
  const ui=read('public/ui/app.js'),css=read('public/ui/app.css');
  assert.ok(fs.existsSync(path.join(root,'public','folder-icon.svg')));
  assert.match(ui,/src="\/folder-icon\.svg"/);
  assert.match(ui,/r2-folder-tile/);
  assert.match(ui,/r2-folder-grid/);
  assert.match(css,/\.r2-disk-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.r2-folder-art\{display:block;width:90px;height:74px/);
});

test('V2.22 disk root is folder-only with one breadcrumb, global search, and no root uploader/activity panel',()=>{
  const ui=read('public/ui/app.js');
  assert.match(ui,/Search all R2 files and folders/);
  assert.doesNotMatch(ui,/id="r2UploadPath"/);
  assert.doesNotMatch(ui,/<div class="panel-title">Upload Activity<\/div>/);
  assert.match(ui,/insideFolder=Boolean\(S\.r2\.prefix\)/);
  assert.match(ui,/uploader=insideFolder\?/);
  assert.match(ui,/Create folders here first\. App icons are added manually by you\./);
  assert.match(ui,/if\(!S\.r2\.prefix\)return folderGrid/);
});

test('V2.19 folders are icon tiles instead of metadata/action table rows',()=>{
  const ui=read('public/ui/app.js');
  assert.doesNotMatch(ui,/function r2FolderRow/);
  assert.match(ui,/function r2FolderTile/);
  assert.match(ui,/data-r2-folder=/);
  assert.doesNotMatch(ui,/Folder<\/span><span>—<\/span><div class="r2-file-actions"><button[^>]+>Open/);
});

test('V2.19 upload progress remains inside opened folders and root upload is blocked',()=>{
  const ui=read('public/ui/app.js');
  assert.match(ui,/id="r2Dropzone"/);
  assert.match(ui,/type="file" multiple/);
  assert.match(ui,/r2-queue-row/);
  assert.match(ui,/Open a folder before uploading files\./);
  assert.match(ui,/Open a folder before uploading\./);
});

test('V2.19 public links ignore internal folder paths and resolve by filename',()=>{
  const service=read('src/services/r2.js');
  assert.match(service,/function publicFilename/);
  assert.match(service,/function publicUrlForFilename/);
  assert.match(service,/publicUrl:publicUrlForFilename\(row\.filename,downloadHost\)/);
  assert.match(service,/WHERE o\.filename=\?/);
  assert.match(service,/V2\.18 compatibility/);
  assert.match(service,/requested\.includes\('\/'\)/);
  assert.match(service,/WHERE o\.object_key=\?/);
});

test('V2.19 file counters exclude folder marker objects',()=>{
  const service=read('src/services/r2.js');
  assert.match(service,/indexed_objects FROM r2_accounts/);
  assert.match(service,/o\.object_key NOT LIKE '%\/'/);
  assert.match(service,/FROM r2_objects WHERE object_key NOT LIKE '%\/'/);
});
