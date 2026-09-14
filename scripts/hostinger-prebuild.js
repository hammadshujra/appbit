'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const version=fs.readFileSync(path.join(root,'VERSION'),'utf8').trim();
const route=path.join(root,'pages','api','[[...path]].js');
const staleRoutes=[
  path.join(root,'pages','api','[...path].mjs'),
  path.join(root,'pages','api','[...path].js'),
  path.join(root,'pages','api','[[...path]].mjs')
];
function fail(message){
  console.error(`[Appbit] Hostinger prebuild failed: ${message}`);
  process.exit(1);
}
function removeStaleRoutes(){
  const removed=[];
  for(const file of staleRoutes){
    if(!fs.existsSync(file))continue;
    if(!fs.lstatSync(file).isFile())fail(`legacy/conflicting API route is not a regular file: ${path.relative(root,file)}`);
    fs.unlinkSync(file);
    removed.push(path.relative(root,file));
  }
  return removed;
}
if(version!=='2.18')fail(`expected VERSION 2.18, found ${version}`);
if(Object.prototype.hasOwnProperty.call(pkg,'type'))fail('package.json must not force a package-wide module type for the Next.js Pages build.');
const removed=removeStaleRoutes();
if(!fs.existsSync(route))fail('pages/api/[[...path]].js is missing.');
const source=fs.readFileSync(route,'utf8');
if(!/export\s+default\s+function\s+appbitApi/.test(source))fail('API route does not contain the standard Next.js default export.');
if(!/export\s+const\s+config/.test(source))fail('API route is missing the Next.js API config export.');
if(/\brequire\s*\(|module\.exports|exports\./.test(source))fail('API route mixes CommonJS syntax into the Next.js ESM source route.');
const cleanup=removed.length?` Removed stale route(s): ${removed.join(', ')}.`:'';
console.log(`[Appbit] Hostinger prebuild V${version}: API route verified — pages/api/[[...path]].js (Next.js module syntax).${cleanup}`);
