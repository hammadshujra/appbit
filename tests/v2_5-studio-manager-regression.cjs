const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('V2.5 release identity and Concept 4 light shell are wired',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'2.5.0');
  assert.equal(read('VERSION').trim(),'2.5');
  const page=read('pages/[[...path]].jsx');
  assert.match(page,/const APP_VERSION='2\.5'/);
  assert.match(page,/theme-color" content="#f6f9ff/);
  assert.match(page,/Appbit Studio Manager/);
  const css=read('public/ui/app.css');
  assert.match(css,/--bg:#f[0-9a-f]{5}/i);
  assert.match(css,/studio-hero/);
  assert.match(css,/\.sidebar\{/);
});

test('V2.5 sidebar uses requested top-level studio sections',()=>{
  const ui=read('public/ui/app.js');
  const ordered=[
    "navItem('dashboard','Workspace'",
    "navItem('library','Apps'",
    "navItem('publishing','Release'",
    "navItem('updates','Update'",
    "navItem('analytics','Analytics'",
    "navItem('r2-accounts','Accounts'",
    "navItem('team','Team'",
    "navItem('settings','Settings'"
  ];
  let last=-1;
  for(const token of ordered){const i=ui.indexOf(token);assert.ok(i>last,`missing/out-of-order ${token}`);last=i}
  const shell=ui.slice(ui.indexOf('function shell'),ui.indexOf('function bindShell'));
  assert.doesNotMatch(shell,/r2-files|File Manager/);
});

test('V2.5 keeps existing internal route names while exposing new URLs',()=>{
  const ui=read('public/ui/app.js');
  for(const url of ['/workspace','/apps','/release','/update','/analytics','/accounts','/team','/settings'])assert.ok(ui.includes(url),`missing ${url}`);
  for(const renderer of ['renderDashboard','renderLibrary','renderPublishing','renderUpdateCenter','renderAnalytics','renderR2Accounts','renderTeam','renderSettings'])assert.match(ui,new RegExp(`function ${renderer}\\(`));
});

test('V2.5 JSON backup includes studio metadata and explicitly excludes raw R2 object bodies',()=>{
  const b=read('src/services/backups.js');
  assert.match(b,/BACKUP_FORMAT_VERSION=4/);
  assert.match(b,/appbit-studio-json-backup/);
  for(const marker of ['r2_accounts','r2_download_domains','r2_folder_meta','r2_structure','team'])assert.ok(b.includes(marker),`backup missing ${marker}`);
  assert.match(b,/published=1/);
  assert.match(b,/raw_app_files:false/);
  const payloadBlock=b.slice(b.indexOf('data:{'),b.indexOf('async function createBackup'));
  assert.doesNotMatch(payloadBlock,/r2_objects\s*:/);
});

test('V2.5 partner/admin boundaries keep infrastructure management admin-only',()=>{
  const api=read('src/routes/api.js');
  assert.match(api,/requireAdmin/);
  assert.match(api,/\/r2\/accounts/);
  assert.match(api,/\/users/);
  const users=read('src/services/users.js');
  assert.match(users,/partner/i);
  assert.match(users,/admin/i);
});

test('V2.5 uses vector monogram for site logo and favicon',()=>{
  const logo=read('public/logo.svg');
  const fav=read('public/favicon.svg');
  assert.match(logo,/<svg/);
  assert.match(logo,/(linearGradient|path)/);
  assert.equal(fav,logo);
});
