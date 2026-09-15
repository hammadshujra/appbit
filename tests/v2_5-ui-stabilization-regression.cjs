'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('login and health use the light Studio Manager standalone UI and cache-isolated logo',()=>{
  const login=read('pages/login.jsx'),health=read('pages/health.jsx'),css=read('public/css/app.css');
  assert.match(login,/auth-page/); assert.match(login,/auth-visual/); assert.match(login,/studio-logo\.svg\?v=251/);
  assert.match(health,/health-hero/); assert.match(health,/studio-logo\.svg\?v=251/);
  assert.match(css,/\.auth-page\{/); assert.match(css,/\.health-page\{/);
});

test('main shell has no duplicate bottom profile card and includes File Manager under Accounts',()=>{
  const js=read('public/ui/app.js');
  const shell=js.match(/function shell\(\).*?(?=function bindShell\()/s)?.[0]||'';
  assert.doesNotMatch(shell,/sidebar-foot/);
  assert.match(shell,/r2SidebarNav\(\)/);
  assert.match(shell,/studio-user-role/);
  assert.match(shell,/studio-user-email/);
  assert.match(shell,/studio-profile-menu/);
});

test('Apps import progress is hidden until an import is active',()=>{
  const js=read('public/ui/app.js');
  assert.match(js,/if\(!active\)return''/);
  assert.match(js,/import-status \$\{active\|\|paused\?'is-visible':''\}/);
  assert.match(js,/Stop import/);
});

test('Analytics renders a real SVG chart from current app activity',()=>{
  const js=read('public/ui/app.js');
  assert.match(js,/studio-activity-chart/);
  assert.match(js,/last 7 days/i);
  assert.match(js,/publishedAt/);
  assert.match(js,/updatedAt/);
});

test('Accounts have Cloudflare guide, icon, spacing and File Manager access',()=>{
  const js=read('public/ui/app.js'),css=read('public/ui/app.css');
  assert.match(js,/Manage R2 API Tokens/);
  assert.match(js,/Object Read & Write/);
  assert.match(js,/icon\('cloudflare'\)/);
  assert.match(js,/Open File Manager/);
  assert.match(css,/\.r2-connect-layout/);
  assert.match(css,/\.r2-simple-account-form\{padding:20px/);
});

test('Team supports Admin and Partner profile photo editing',()=>{
  const js=read('public/ui/app.js');
  assert.match(js,/data-edit-user/);
  assert.match(js,/openUserEditModal/);
  assert.match(js,/userAvatarFile/);
  assert.match(js,/\/api\/users\/\$\{u\.id\}\/avatar/);
});

test('File Manager uses larger search with no visible Ctrl shortcut and simplified disk usage cards',()=>{
  const js=read('public/ui/app.js'),css=read('public/ui/app.css');
  const search=js.match(/function r2SearchBoxHtml.*?\n/s)?.[0]||'';
  assert.doesNotMatch(search,/Ctrl K/);
  assert.match(js,/\% used/); assert.match(js,/\% remaining/);
  assert.doesNotMatch(js.match(/function r2DiskCard.*?\n/s)?.[0]||'',/bucket/);
  assert.match(css,/\.r2-search-wrap\{position:relative;min-width:400px/);
});

test('Workspace app tables separate Version and Size columns',()=>{
  const js=read('public/ui/app.js'),css=read('public/ui/app.css');
  const table=js.match(/function studioAppTable.*?(?=async function renderDashboard)/s)?.[0]||'';
  assert.match(table,/<span>Version<\/span><span>Size<\/span>/);
  assert.doesNotMatch(table,/fileSizeBytes\?bytes\(x\.fileSizeBytes\):''<\/small>/);
  assert.match(css,/grid-template-columns:minmax\(220px,2fr\).*minmax\(78px,.65fr\).*minmax\(78px,.65fr\)/s);
});

test('V2.5 identity and schema remain non-destructive',()=>{
  assert.equal(read('VERSION').trim(),'2.5');
  assert.match(read('src/version.js'),/version:'2\.5'/);
  assert.match(read('src/version.js'),/ui-stabilization/);
});
