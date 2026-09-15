'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'public/ui/app.js'),'utf8');
const uiCss=fs.readFileSync(path.join(root,'public/ui/app.css'),'utf8');
const pageCss=fs.readFileSync(path.join(root,'public/css/app.css'),'utf8');
const cloudflare=fs.readFileSync(path.join(root,'public/cloudflare.svg'),'utf8');

test('R2 Accounts binder and account actions are defined',()=>{
  assert.match(app,/function bindR2AccountsPage\(/);
  assert.match(app,/function r2AccountAction\(/);
  assert.match(app,/function saveR2AccountInline\(/);
  assert.match(app,/\/api\/r2\/accounts\/\$\{id\}\/\$\{action\}/);
});

test('Accounts and File Manager are separate top-level routes',()=>{
  assert.match(app,/navItem\('r2-accounts','Accounts','cloud'\)/);
  assert.match(app,/function r2SidebarNav\(\)\{return`\$\{navItem\('r2-files','File Manager','folder'\)\}/);
  assert.match(app,/'r2-accounts':'\/accounts'/);
  assert.match(app,/'r2-files':'\/files'/);
});

test('File Manager tree uses constrained Cloudflare/app icons',()=>{
  assert.match(app,/r2-side-cloudflare[^>]*src="\/cloudflare\.svg"/);
  assert.match(uiCss,/\.r2-side-link img,\.r2-side-app-icon\{width:20px!important;height:20px!important/);
  assert.match(uiCss,/\.r2-side-link\.disk img\.r2-side-cloudflare\{object-fit:contain/);
  assert.match(cloudflare,/#F48120/);
});

test('R2 account cards and active account use Cloudflare brand asset',()=>{
  const refs=(app.match(/\/cloudflare\.svg/g)||[]).length;
  assert.ok(refs>=3,`expected multiple Cloudflare references, got ${refs}`);
  assert.match(uiCss,/\.r2-account-heading-icon img\{display:block!important/);
});

test('new folder modal is single-instance and stable',()=>{
  assert.match(app,/function openR2FolderModal\(\)\{[^]*?if\(\$\('#r2FolderWrap'\)\)return/);
  assert.match(app,/id="r2FolderWrap"/);
  assert.match(app,/if\(e\.target\.id==='r2FolderWrap'\)close\(\)/);
});

test('search icon and responsive File Manager styles remain visible',()=>{
  assert.match(app,/r2-search-icon[^]*?icon\('search'\)/);
  assert.match(uiCss,/\.r2-search-icon\{[^}]*color:#52698f/i);
  assert.match(uiCss,/@media\(max-width:/);
});

test('navigation icons are bundled locally and do not depend on remote icon APIs',()=>{
  assert.match(app,/const UI_ICON_PATHS=/);
  assert.match(app,/const localIcon=/);
  assert.doesNotMatch(app,/api\.iconify\.design/);
  assert.match(uiCss,/\.ui-svg-icon/);
});

test('health and sign-in buttons never turn white on hover',()=>{
  assert.match(pageCss,/\.btn:hover\{background:#e8f0ff!important/);
  assert.match(pageCss,/\.btn-primary:hover\{background:linear-gradient/);
  assert.match(pageCss,/\.health-secondary:hover\{background:#e9f1ff!important/);
});

test('app detail artwork is hard-contained and cannot overflow the workspace',()=>{
  assert.match(uiCss,/\.record-artwork-row\{display:grid!important/);
  assert.match(uiCss,/\.record-cover-preview>img\{display:block;width:100%!important;height:158px!important/);
  assert.match(uiCss,/\.record-shot-preview>img\{display:block;width:220px!important;height:124px!important/);
  assert.match(uiCss,/html,body,#app\{overflow-x:hidden\}/);
});

test('collapsed sidebar uses a dedicated compact rail layout',()=>{
  assert.match(uiCss,/\.sidebar-collapsed\{--sidebar:82px\}/);
  assert.match(uiCss,/\.sidebar-collapsed \.nav-btn\{height:44px;width:48px/);
  assert.match(app,/chevron-right/);
});
