'use strict';
// Read-only diagnostic; no DDL, source requests, or application data changes.
const {getPool} = require('../src/db');
const {TABLES,TARGET} = require('../src/schema-collations');
async function main(){
 const db=getPool();
 try{
  const [rows]=await db.query(`SELECT TABLE_NAME,COLUMN_NAME,CHARACTER_SET_NAME,COLLATION_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${TABLES.map(()=>'?').join(',')})
      AND CHARACTER_SET_NAME IS NOT NULL AND COLLATION_NAME<>?
    ORDER BY TABLE_NAME,ORDINAL_POSITION`,[...TABLES,TARGET]);
  const [[version]]=await db.query('SELECT MAX(version) AS version FROM schema_migrations');
  console.log('Appbit schema version:',version?.version??'unknown');
  if(rows.length){console.table(rows);process.exitCode=1;console.error(`${rows.length} Appbit text columns still have a different collation.`)}
  else console.log(`All Appbit text columns use ${TARGET}.`);
 }finally{await db.end()}
}
main().catch(err=>{console.error('Collation check failed:',err.message);process.exitCode=1});
