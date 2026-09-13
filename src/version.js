'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const version=fs.readFileSync(path.join(root,'VERSION'),'utf8').trim();
let buildId=version;
try{const info=JSON.parse(fs.readFileSync(path.join(root,'BUILD-INFO.json'),'utf8'));buildId=String(info.buildId||version)}catch{}
module.exports={version,buildId};
