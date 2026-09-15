'use strict';
// The app importer must never send an unbound '?' to MySQL. mysql2.query()
// otherwise interpolates too few values without raising a client-side error.
function countParameters(sql){
  let count=0,quote=null,comment=null;
  for(let i=0;i<sql.length;i++){
    const c=sql[i],n=sql[i+1];
    if(comment==='line'){if(c==='\n')comment=null;continue}
    if(comment==='block'){if(c==='*'&&n==='/'){comment=null;i++}continue}
    if(quote){if(c==='\\'){i++;continue}if(c===quote){if(sql[i+1]===quote){i++;continue}quote=null}continue}
    if(c==='-'&&n==='-'&&(/\s/.test(sql[i+2]||''))){comment='line';i++;continue}
    if(c==='#'){comment='line';continue}
    if(c==='/'&&n==='*'){comment='block';i++;continue}
    if(c==='\''||c==='"'||c==='`'){quote=c;continue}
    if(c==='?')count++;
  }
  return count;
}
function checkedQuery(db,sql,args=[]){
  if(!Array.isArray(args)||countParameters(sql)!==args.length)throw new Error('Happy Cloud Studio Manager SQL parameter mismatch: '+countParameters(sql)+' placeholders, '+(Array.isArray(args)?args.length:'invalid')+' values.');
  // mysql2 rejects undefined; optional missing metadata is represented by SQL NULL.
 args=args.map(v=>v===undefined?null:v);
  // Prepared statements preserve types and cannot leave literal placeholders
  // in the SQL. The query fallback is for the deterministic test harness.
  const task=typeof db.execute==='function'?db.execute(sql,args):db.query(sql,args);
  return Promise.resolve(task).catch(err=>{
    if(/conversion from collation|illegal mix of collations/i.test(String(err.message||''))){
      const error=new Error('Database text collation is incompatible. Check that Happy Cloud schema migration 125 completed successfully.');
      error.code='DB_TEXT_COLLATION';error.status=500;error.cause=err;throw error;
    }
    throw err;
  });
}
module.exports={countParameters,checkedQuery};
