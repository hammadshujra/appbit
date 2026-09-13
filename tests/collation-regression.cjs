'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const {normalizeAppbitCollations, TARGET} = require('../src/schema-collations');
function column(table,name,type,collation,options={}) {
  return {TABLE_NAME:table,COLUMN_NAME:name,COLUMN_TYPE:type,IS_NULLABLE:options.nullable?'YES':'NO',COLUMN_DEFAULT:options.defaultValue??null,COLUMN_COMMENT:options.comment||'',EXTRA:options.extra||'',GENERATION_EXPRESSION:options.generation||'',CHARACTER_SET_NAME:collation.startsWith('ascii')?'ascii':'utf8mb4',COLLATION_NAME:collation,ORDINAL_POSITION:1};
}
const unicode='utf8mb4_unicode_ci', modern='utf8mb4_0900_ai_ci';
function fakeDb({tables=[],columns=[],indexes=[],collisions=[]}={}) {
  const calls=[];const schema={tables:structuredClone(tables),columns:structuredClone(columns),indexes:structuredClone(indexes)};
  const db={calls,schema,escape:value=>"'"+String(value).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\0/g,'\\0').replace(/\n/g,'\\n')+"'",
    async query(sql,args=[]) {
      calls.push({sql,args});const s=sql.replace(/\s+/g,' ').trim();
      if(s.includes('FROM information_schema.TABLES'))return[structuredClone(schema.tables)];
      if(s.includes('FROM information_schema.COLUMNS'))return[structuredClone(schema.columns)];
      if(s.includes('FROM information_schema.STATISTICS'))return[structuredClone(schema.indexes)];
      if(s.startsWith('SELECT 1 FROM `')&&s.includes('HAVING COUNT(*)>1'))return[collisions.includes(s.match(/FROM `([^`]+)`/)[1])?[{collision:1}]:[]];
      if(s.startsWith('ALTER TABLE')) {
        const name=s.match(/^ALTER TABLE `([^`]+)`/)[1];
        for(const c of schema.columns.filter(c=>c.TABLE_NAME===name))if(s.includes('MODIFY COLUMN `'+c.COLUMN_NAME+'`')){c.COLLATION_NAME=TARGET;c.CHARACTER_SET_NAME='utf8mb4';}
        const table=schema.tables.find(t=>t.TABLE_NAME===name);if(table)table.TABLE_COLLATION=TARGET;
      }
      return[[]];
    }
  };return db;
}
function unique(table,name,parts){return parts.map((part,i)=>({TABLE_NAME:table,INDEX_NAME:name,SEQ_IN_INDEX:i+1,COLUMN_NAME:part,SUB_PART:null,EXPRESSION:null}));}
test('repairs exact reported mixed-collation category comparison, including ENUMs',async()=>{
  const db=fakeDb({tables:[{TABLE_NAME:'apk_categories',TABLE_COLLATION:modern}],columns:[column('apk_categories','slug','varchar(160)',unicode,{nullable:false}),column('apk_categories','section',"enum('apps','games')",modern,{defaultValue:'apps'}),column('apk_categories','parent_slug','varchar(160)',modern,{nullable:true})],indexes:unique('apk_categories','uniq_apk_category',['section','slug'])});
  const result=await normalizeAppbitCollations(db);assert.equal(result.alteredColumns,2);
  const alter=db.calls.find(c=>c.sql.startsWith('ALTER TABLE'))?.sql;
  assert.match(alter,/MODIFY COLUMN `section` enum\('apps','games'\) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'apps'/);
  assert.match(alter,/MODIFY COLUMN `parent_slug` varchar\(160\).* NULL/);
  assert.doesNotMatch(alter,/MODIFY COLUMN `slug`/);
  assert.match(db.calls.find(c=>c.sql.includes('HAVING COUNT(*)>1')).sql,/CONVERT\(`section` USING utf8mb4\) COLLATE utf8mb4_unicode_ci/);
  assert.deepEqual(await normalizeAppbitCollations(db),{alteredTables:0,alteredColumns:0});
});
test('preserves ASCII text length, Unicode characters, literal defaults and comments',async()=>{
 const db=fakeDb({tables:[{TABLE_NAME:'apps',TABLE_COLLATION:unicode}],columns:[column('apps','package_id','varchar(190)','ascii_general_ci',{comment:"App's key",defaultValue:"a'b"}),column('apps','description','mediumtext',modern,{nullable:true})],indexes:unique('apps','PRIMARY',['package_id'])});
 await normalizeAppbitCollations(db);const alter=db.calls.find(c=>c.sql.startsWith('ALTER TABLE')).sql;
 assert.match(alter,/varchar\(190\) CHARACTER SET utf8mb4/);assert.match(alter,/DEFAULT 'a\\'b'/);assert.match(alter,/COMMENT 'App\\'s key'/);assert.match(alter,/mediumtext CHARACTER SET utf8mb4/);assert.doesNotMatch(alter,/CONVERT TO CHARACTER SET|DROP|TRUNCATE|INSERT|DELETE/);
 assert.match(db.calls.find(c=>c.sql.includes('HAVING COUNT(*)>1')).sql,/CONVERT\(`package_id` USING utf8mb4\)/);
});
test('aborts on unique-key collision before changing any table',async()=>{
 const db=fakeDb({tables:[{TABLE_NAME:'apps',TABLE_COLLATION:modern}],columns:[column('apps','package_id','varchar(190)',modern)],indexes:unique('apps','uniq_package',['package_id']),collisions:['apps']});
 await assert.rejects(normalizeAppbitCollations(db),/Collation repair stopped.*uniq_package/);
 assert.equal(db.calls.filter(c=>c.sql.startsWith('ALTER TABLE')).length,0);
});
test('rejects unsupported column definitions without altering data',async()=>{
 const db=fakeDb({tables:[{TABLE_NAME:'apps',TABLE_COLLATION:modern}],columns:[column('apps','computed','varchar(50)',modern,{extra:'VIRTUAL GENERATED',generation:'lower(name)'})]});
 await assert.rejects(normalizeAppbitCollations(db),/Generated text column/);
 assert.equal(db.calls.filter(c=>c.sql.startsWith('ALTER TABLE')).length,0);
});
test('normalizes table defaults without touching already-correct columns and ignores legacy tables',async()=>{
 const db=fakeDb({tables:[{TABLE_NAME:'apps',TABLE_COLLATION:modern},{TABLE_NAME:'software',TABLE_COLLATION:modern}],columns:[column('apps','name','varchar(255)',unicode),column('software','name','varchar(255)',modern)]});
 const result=await normalizeAppbitCollations(db);assert.equal(result.alteredColumns,0);assert.equal(result.alteredTables,1);
 assert.equal(db.calls.filter(c=>c.sql.startsWith('ALTER TABLE')).length,1);
 assert.doesNotMatch(db.calls.find(c=>c.sql.startsWith('ALTER TABLE')).sql,/software|MODIFY COLUMN/);
});
test('Next.js Hostinger source keeps the live collation repair implementation',()=>{
 assert.equal(typeof normalizeAppbitCollations,'function');
 assert.match(fs.readFileSync(path.join(root,'src/schema-collations.js'),'utf8'),/utf8mb4_unicode_ci/);
 assert.match(fs.readFileSync(path.join(root,'src/migrations.js'),'utf8'),/normalizeAppbitCollations/);
});
test('migration repairs before category initialization and never re-enters legacy deletion for existing apps',async()=>{
 const file=fs.readFileSync(path.join(root,'src/migrations.js'),'utf8');
 const events=[];const db={async query(sql,args=[]){const s=sql.replace(/\s+/g,' ').trim();events.push(s);if(s.includes('MAX(version)'))return[[{version:126}]];if(s.includes('information_schema.TABLES'))return[[{found:1}]];if(s.includes('information_schema.COLUMNS'))return[[]];return[[]];}};
 const module={exports:{}};
 vm.runInNewContext(file,{module,exports:module.exports,require:id=>id==='./db'?{getPool:()=>db}:id==='./schema-collations'?{normalizeAppbitCollations:async()=>{events.push('NORMALIZE');return{}}}:id==='./services/apk-fields'?require('../src/services/apk-fields'):require(id),console}, {filename:'migrations.js'});
 assert.equal(await module.exports.migrate(),130);
 assert.ok(events.indexOf('NORMALIZE')<events.findIndex(s=>s.includes('UPDATE apk_categories SET parent_slug')));
 assert.ok(!events.some(s=>/DROP TABLE|DELETE FROM schema_migrations|SET FOREIGN_KEY_CHECKS=0/.test(s)));
 assert.equal(events.filter(s=>s==='NORMALIZE').length,2);
 const unrecognized={async query(sql){if(sql.includes('MAX(version)'))return[[{version:0}]];if(sql.includes('information_schema.TABLES'))return[[{found:1}]];return[[]];}};
 const module2={exports:{}};
 vm.runInNewContext(file,{module:module2,exports:module2.exports,require:id=>id==='./db'?{getPool:()=>unrecognized}:id==='./schema-collations'?{normalizeAppbitCollations:async()=>{throw Error('must not run')}}:id==='./services/apk-fields'?require('../src/services/apk-fields'):require(id),console});
 await assert.rejects(module2.exports.migrate(),/unrecognized schema version/);
});
