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

test('Mage Icons are wired into the UI',()=>{
  assert.match(app,/api\.iconify\.design\/mage\//);
  assert.match(app,/MAGE_ICONS=/);
  assert.match(uiCss,/\.mage-icon\{/);
});

test('health action hover preserves readable contrast',()=>{
  assert.match(pageCss,/\.health-actions \.btn:hover\{color:#18305d!important/);
  assert.match(pageCss,/\.health-actions \.btn-primary:hover\{color:#fff!important/);
});
