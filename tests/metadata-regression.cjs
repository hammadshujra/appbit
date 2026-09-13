'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const fields=require('../src/services/apk-fields'),history=require('../src/services/apk-history'),source=require('../src/services/apk-source');
function fixture(overrides={}){return{looksLikeAppPage:true,internalPackageId:'liteapks:fixture',sourcePageUrl:'https://liteapks.com/fixture.html',name:'Fixture App',developer:null,version:'2.0.0',category:'Tools',sourceSection:'apps',categorySlug:'tools',categoryUrl:null,description:null,updatedDate:null,fileSizeBytes:null,minimumOsVersion:null,downloadCount:null,iconUrl:null,coverImageUrl:null,screenshots:[],metadata:{version:'2.0.0',developer:null,updatedDate:null,fileSizeBytes:null,downloadCount:null,oldVersions:[]},oldVersions:[],...overrides}}
function harness(existing){const calls=[],app={id:7,package_id:'liteapks:fixture',name:'Fixture App',developer:'Saved Studio',current_version:'1.0.0',source_page_url:'https://liteapks.com/fixture.html',category:'Tools',category_slug:'tools',category_url:null,source_section:'apps',source_updated_at:'2026-01-01',file_size_bytes:104857600,download_count:100,source_metadata_json:JSON.stringify({version:'1.0.0',developer:'Saved Studio',updatedDate:'2026-01-01',fileSizeBytes:104857600,downloadCount:100,oldVersions:[]}),...existing};
 const pool={async query(sql,args=[]){calls.push({sql,args});if(sql.startsWith('SELECT * FROM apps WHERE package_id='))return[[app]];if(sql.startsWith('SELECT * FROM apps WHERE id='))return[[app]];if(sql.startsWith('SELECT section,name,slug FROM apk_categories'))return[[null]];if(sql.startsWith('SELECT id,source_page_url FROM apk_versions'))return[[{id:3,source_page_url:'https://liteapks.com/fixture.html'}]];if(sql.startsWith('SELECT'))return[[]];return[{affectedRows:1}]},async getConnection(){return{beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){},query:(...args)=>pool.query(...args)}}};
 const stubs={'cheerio':{load:()=>({})},'../state':{dbReady:true},'../config':{},'../db':{getPool:()=>pool},'../utils/version':{compareVersions:(a,b)=>a.localeCompare(b,undefined,{numeric:true})},'./activity':{},'./notifications':{},'./apk-source':source,'./apk-fields':fields,'./apk-history':history,'./remote':{probeRemoteFileSize:async()=>null},'../utils/sql-checked':require('../src/utils/sql-checked')};
 const file=path.join(root,'src/services/apk-resolver.js'),module={exports:{}};
 const context={module,exports:module.exports,require:id=>stubs[id]??require(id),Buffer,URL,URLSearchParams,AbortController,Response,Headers,fetch,console,setTimeout,clearTimeout,setInterval,clearInterval,Date,Math,Number,JSON,String,Promise,Array,Map,Set,RegExp,process};
 vm.runInNewContext(fs.readFileSync(file,'utf8')+'\nglobalThis.testUpsert=upsertManaged;',context,{filename:file});return{upsert:context.testUpsert,calls,app};}
test('strict dates, sizes, and counts preserve missing vs zero',()=>{
 assert.equal(fields.parseDate('2026-09-02T12:00:00Z'),'2026-09-02');assert.equal(fields.parseDate('2026-02-30'),null);assert.equal(fields.parseDate('05/08/2026'),null);
 assert.equal(fields.parseDate('August 5, 2026'),'2026-08-05');assert.equal(fields.parseCount('1.2M+'),1200000);assert.equal(fields.parseCount('0'),0);assert.equal(fields.parseCount('1.2.3'),null);
 assert.equal(fields.parseBytes('123.5 MB'),129499136);assert.equal(fields.parseBytes('1.5 GB'),1610612736);assert.equal(fields.parseBytes('Not reported'),null);
});
test('history URLs must be real source-provided links, not a guessed current URL or index',()=>{
 assert.equal(history.safeVersionUrl(undefined),null);assert.equal(history.safeVersionUrl('https://evil.example/a'),null);assert.equal(history.samePage('https://liteapks.com/fixture.html','https://liteapks.com/fixture.html'),true);
 assert.equal(history.isHistoryOnlyUrl('https://liteapks.com/old-versions/fixture'),true);
 assert.equal(history.isHistoryOnlyUrl('https://liteapks.com/old-versions/fixture-v1.2.3'),false);
});
test('existing metadata is preserved on a partial scan, and old fake links are cleared',async()=>{
 const h=harness();const d=fixture({version:'1.0.0',metadata:{version:'1.0.0',developer:null,updatedDate:null,fileSizeBytes:null,downloadCount:null,oldVersions:[]}});
 await h.upsert(d,{autoAdd:false});assert.equal(d.developer,'Saved Studio');assert.equal(d.fileSizeBytes,104857600);assert.equal(d.updatedDate,'2026-01-01');assert.equal(d.downloadCount,100);
 const insert=h.calls.find(c=>c.sql.startsWith('INSERT INTO apps\n'));assert.ok(insert);assert.equal((insert.sql.match(/\?/g)||[]).length,insert.args.length,'SQL parameter count must match');
 assert.ok(h.calls.some(c=>c.sql.startsWith('UPDATE apk_versions SET source_page_url=NULL WHERE id=')&&c.args[0]===3));
});
test('a newly detected source version does not inherit stale size or update date',async()=>{
 const h=harness();const d=fixture({version:'2.0.0',developer:'New Studio',metadata:{version:'2.0.0',developer:'New Studio',updatedDate:null,fileSizeBytes:null,downloadCount:0,oldVersions:[]},downloadCount:0});
 await h.upsert(d,{autoAdd:false});assert.equal(d.developer,'New Studio');assert.equal(d.fileSizeBytes,null);assert.equal(d.updatedDate,null);assert.equal(d.downloadCount,0);
 const insert=h.calls.find(c=>c.sql.startsWith('INSERT INTO apps\n'));assert.ok(insert);assert.equal((insert.sql.match(/\?/g)||[]).length,insert.args.length);
 assert.doesNotMatch(insert.sql,/IF\(\?,VALUES\(/,'ON DUPLICATE KEY must not contain server-visible placeholders');
 const reset=h.calls.find(c=>c.sql.startsWith('UPDATE apps SET source_updated_at='));assert.ok(reset,'new version must explicitly clear stale date/size');
 assert.deepEqual(Array.from(reset.args),[null,null,1,'liteapks:fixture']);
 assert.equal(d.metadata.updatedDate,null);assert.equal(d.metadata.fileSizeBytes,null);
});
