'use strict';
const {spawnSync}=require('node:child_process');
const cmd=process.platform==='win32'?'npx.cmd':'npx';
const env={...process.env,PLAYWRIGHT_BROWSERS_PATH:'0'};
const result=spawnSync(cmd,['playwright','install','chromium'],{stdio:'inherit',env});
if(result.error||result.status!==0){
  console.warn('[Happy Cloud] Playwright Chromium could not be downloaded during install. Appbit will keep direct HTTP scraping enabled; browser fallback may be unavailable on this host.');
  process.exit(0);
}
console.log('[Happy Cloud] Playwright Chromium installed in the project runtime.');
