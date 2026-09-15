'use strict';

const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const serverDir=path.join(root,'.next','server');
if(!fs.existsSync(serverDir)){
  throw new Error('Hostinger postbuild: .next/server was not created by next build.');
}
const version=fs.readFileSync(path.join(root,'VERSION'),'utf8').trim();
const buildInfo=fs.readFileSync(path.join(root,'BUILD-INFO.json'),'utf8');
fs.writeFileSync(path.join(serverDir,'VERSION'),version+'\n','utf8');
fs.writeFileSync(path.join(serverDir,'BUILD-INFO.json'),buildInfo,'utf8');
console.log(`[Happy Cloud] Hostinger output finalized for V${version}.`);
