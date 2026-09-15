const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const state=require('../state');
const{getPool}=require('../db');
const activity=require('./activity');
const notifications=require('./notifications');
const r2=require('./r2');

const BACKUP_DIR=path.join(process.cwd(),'backups');
const AUTO_INTERVAL_MS=24*60*60*1000;
const CHECK_INTERVAL_MS=60*1000;
const AUTO_RETENTION=30;
const MANUAL_RETENTION=20;
const BACKUP_FORMAT_VERSION=4;
const APP_VERSION='2.5.0';
let workerStarted=false,running=false,restoring=false;

function ensureDir(){fs.mkdirSync(BACKUP_DIR,{recursive:true})}
function safeFilename(kind='manual'){return`appbit-studio-${kind}-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`}
async function rows(db,t,where='',params=[]){const[r]=await db.query(`SELECT * FROM \`${t}\` ${where}`,params);return r}
async function tableExists(db,t){const[[r]]=await db.query('SELECT COUNT(*) count FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[t]);return Number(r?.count||0)>0}
function serializableRows(list){return list.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,Buffer.isBuffer(v)?{__appbit_buffer:v.toString('base64')}:v])))}
function reviveValue(v){return v&&typeof v==='object'&&typeof v.__appbit_buffer==='string'?Buffer.from(v.__appbit_buffer,'base64'):v}
function randomToken(){return crypto.randomBytes(24).toString('base64url').slice(0,48)}
function keyHash(v){return crypto.createHash('sha256').update(String(v||''),'utf8').digest()}
function folderPrefixes(key){const parts=String(key||'').split('/').filter(Boolean);const folders=String(key||'').endsWith('/')?parts:parts.slice(0,-1);let cur='';return folders.map(p=>(cur+=`${p}/`))}

async function relatedRows(db,table,appIds){if(!appIds.length)return[];return rows(db,table,`WHERE app_id IN (${appIds.map(()=>'?').join(',')})`,appIds)}

async function studioPayload(kind){
  const db=getPool();
  const[[schema]]=await db.query('SELECT MAX(version) version FROM schema_migrations');
  const published=await rows(db,'apps','WHERE published=1 ORDER BY id');
  const appIds=published.map(x=>Number(x.id));
  const [versions,media,metadata,queue,categories,settings,users,r2Accounts,r2Domains,r2Objects,r2FolderMeta]=await Promise.all([
    relatedRows(db,'apk_versions',appIds),relatedRows(db,'apk_media',appIds),relatedRows(db,'apk_metadata',appIds),relatedRows(db,'publish_queue',appIds),
    rows(db,'apk_categories'),rows(db,'settings'),rows(db,'users'),rows(db,'r2_accounts'),rows(db,'r2_download_domains'),rows(db,'r2_objects'),rows(db,'r2_folder_meta')
  ]);
  const accountSecrets=r2Accounts.map(a=>({
    ...a,
    secret_access_key:r2.decryptSecret(a.secret_encrypted),
    secret_encrypted:undefined
  }));
  const structureMap=new Map();
  for(const a of r2Accounts)structureMap.set(Number(a.id),{account_id:Number(a.id),label:a.label,cloudflare_account_id:a.cloudflare_account_id,bucket_name:a.bucket_name,folders:new Set()});
  for(const o of r2Objects){const s=structureMap.get(Number(o.account_id));if(!s)continue;for(const p of folderPrefixes(o.object_key))s.folders.add(p)}
  for(const m of r2FolderMeta){const s=structureMap.get(Number(m.account_id));if(s&&m.folder_key)s.folders.add(String(m.folder_key))}
  const r2Structure=[...structureMap.values()].map(s=>({...s,folders:[...s.folders].sort()}));
  const team=users.map(u=>({
    id:Number(u.id),name:u.name,email:u.email,role:u.role,is_active:u.is_active,last_login_at:u.last_login_at,created_by:u.created_by,created_at:u.created_at,updated_at:u.updated_at,
    // Partner password hashes are required if a studio is restored on a new install. Admin credentials are intentionally not replaced.
    password_hash:u.role==='partner'?u.password_hash:null,
    avatar_mime:u.avatar_mime||null,avatar_blob:u.avatar_blob?{__appbit_buffer:Buffer.from(u.avatar_blob).toString('base64')}:null
  }));
  return{
    backup_format:'appbit-studio-json-backup',backup_version:BACKUP_FORMAT_VERSION,app_version:APP_VERSION,schema_version:Number(schema?.version||0),created_at:new Date().toISOString(),kind,
    scope:{published_apps_only:true,raw_app_files:false,includes_connected_accounts:true,includes_team:true,includes_folder_hierarchy:true},
    data:{
      apps:serializableRows(published),apk_versions:serializableRows(versions),apk_media:serializableRows(media),apk_metadata:serializableRows(metadata),publish_queue:serializableRows(queue),apk_categories:serializableRows(categories),
      settings:serializableRows(settings),team:serializableRows(team),r2_accounts:serializableRows(accountSecrets),r2_download_domains:serializableRows(r2Domains),r2_folder_meta:serializableRows(r2FolderMeta),r2_structure:r2Structure
    }
  }
}

async function createBackup(kind='manual'){
  if(running)throw new Error('A backup is already being created.');running=true;
  try{
    ensureDir();const db=getPool(),payload=await studioPayload(kind),filename=safeFilename(kind),filepath=path.join(BACKUP_DIR,filename),json=JSON.stringify(payload,null,2);fs.writeFileSync(filepath,json,'utf8');
    const size=Buffer.byteLength(json);const[result]=await db.query('INSERT INTO backup_history (backup_kind,filename,file_size_bytes) VALUES (?,?,?)',[kind,filename,size]);await pruneBackups(kind);
    return{id:Number(result.insertId),kind,filename,fileSizeBytes:size,createdAt:payload.created_at,summary:{publishedApps:payload.data.apps.length,accounts:payload.data.r2_accounts.length,team:payload.data.team.length,folders:payload.data.r2_structure.reduce((n,x)=>n+x.folders.length,0)}};
  }finally{running=false}
}
async function pruneBackups(kind){const db=getPool(),limit=kind==='auto'?AUTO_RETENTION:kind==='manual'?MANUAL_RETENTION:5;const[rs]=await db.query('SELECT id,filename FROM backup_history WHERE backup_kind=? ORDER BY created_at DESC,id DESC',[kind]);for(const x of rs.slice(limit)){try{fs.unlinkSync(path.join(BACKUP_DIR,path.basename(x.filename)))}catch{}await db.query('DELETE FROM backup_history WHERE id=?',[x.id])}}
async function latest(kind=null){const db=getPool(),where=kind?'WHERE backup_kind=?':'',params=kind?[kind]:[];const[[x]]=await db.query(`SELECT id,backup_kind,filename,file_size_bytes,created_at,downloaded_at FROM backup_history ${where} ORDER BY created_at DESC,id DESC LIMIT 1`,params);if(!x)return null;const filepath=path.join(BACKUP_DIR,path.basename(x.filename));return{id:Number(x.id),kind:x.backup_kind,filename:x.filename,fileSizeBytes:Number(x.file_size_bytes||0),createdAt:x.created_at,downloadedAt:x.downloaded_at,exists:fs.existsSync(filepath)}}
async function stateJson(){const last=await latest(),lastAuto=await latest('auto');return{last,lastAuto,unreadAutomatic:Boolean(lastAuto&&lastAuto.exists&&!lastAuto.downloadedAt),automaticEveryHours:24,format:'json',scope:'published-apps + connected accounts + team + folder hierarchy',rawFilesIncluded:false}}
async function getBackupFile(id){const[[x]]=await getPool().query('SELECT * FROM backup_history WHERE id=? LIMIT 1',[id]);if(!x)return null;const filename=path.basename(x.filename),filepath=path.join(BACKUP_DIR,filename);if(!fs.existsSync(filepath))return null;return{row:x,filename,filepath}}
async function markDownloaded(id){await getPool().query('UPDATE backup_history SET downloaded_at=NOW() WHERE id=?',[id])}

function validateBackup(p){
  if(!p||typeof p!=='object')throw new Error('Backup JSON is invalid.');
  if(p.backup_format==='appbit-studio-json-backup'&&Number(p.backup_version)===4){for(const k of ['apps','r2_accounts','team','r2_structure'])if(!Array.isArray(p.data?.[k]))throw new Error('The studio backup is incomplete or damaged.');return p}
  if(p.backup_format==='appbit-json-backup'&&[2,3].includes(Number(p.backup_version))){for(const k of ['apps','apk_versions','apk_media','apk_metadata','publish_queue'])if(!Array.isArray(p.data?.[k]))throw new Error('The backup is incomplete or damaged.');if(!Array.isArray(p.data.apk_categories))p.data.apk_categories=[];return p}
  throw new Error('This is not a supported Appbit backup.');
}
function normalizeDbValue(v,type=''){v=reviveValue(v);if(v==null)return v;const t=String(type).toLowerCase();if((t.includes('datetime')||t.includes('timestamp'))&&typeof v==='string'){const d=new Date(v);if(!Number.isNaN(d.getTime()))return d.toISOString().slice(0,19).replace('T',' ')}if(t.startsWith('date')&&typeof v==='string'){const m=v.match(/^(\d{4}-\d{2}-\d{2})/);if(m)return m[1]}return v}
async function insertRows(db,table,data){if(!data?.length||!(await tableExists(db,table)))return;const[colsRaw]=await db.query(`SHOW COLUMNS FROM \`${table}\``),meta=new Map(colsRaw.map(c=>[c.Field,c.Type]));for(const row of data){const cols=Object.keys(row).filter(k=>meta.has(k));if(!cols.length)continue;await db.query(`INSERT INTO \`${table}\` (${cols.map(c=>`\`${c}\``).join(',')}) VALUES (${cols.map(()=>'?').join(',')})`,cols.map(c=>normalizeDbValue(row[c],meta.get(c))))}}

async function restoreLegacy(payload){
  const safety=await createBackup('safety'),db=getPool(),conn=await db.getConnection();restoring=true;
  try{await conn.beginTransaction();await conn.query('SET FOREIGN_KEY_CHECKS=0');for(const t of ['publish_queue','apk_metadata','apk_media','apk_versions','app_work_claims','apps','apk_categories'])await conn.query(`DELETE FROM \`${t}\``);await insertRows(conn,'apps',payload.data.apps);await insertRows(conn,'apk_versions',payload.data.apk_versions);await insertRows(conn,'apk_media',payload.data.apk_media);await insertRows(conn,'apk_metadata',payload.data.apk_metadata);await insertRows(conn,'publish_queue',payload.data.publish_queue);if(payload.data.apk_categories.length)await insertRows(conn,'apk_categories',payload.data.apk_categories);await conn.query('SET FOREIGN_KEY_CHECKS=1');await conn.commit();return{restoredApps:payload.data.apps.length,restoredAccounts:0,restoredTeam:0,restoredFolders:0,safetyBackup:safety}}catch(err){try{await conn.query('SET FOREIGN_KEY_CHECKS=1')}catch{}try{await conn.rollback()}catch{}throw err}finally{conn.release();restoring=false}
}

async function upsertPublishedApps(conn,payload){
  const map=new Map();
  const[colsRaw]=await conn.query('SHOW COLUMNS FROM `apps`'),meta=new Map(colsRaw.map(c=>[c.Field,c.Type]));
  for(const raw of payload.data.apps||[]){const row={...raw};delete row.id;row.published=1;const cols=Object.keys(row).filter(k=>meta.has(k));const values=cols.map(c=>normalizeDbValue(row[c],meta.get(c)));const updates=cols.filter(c=>c!=='package_id').map(c=>`\`${c}\`=VALUES(\`${c}\`)`).join(',');await conn.query(`INSERT INTO apps (${cols.map(c=>`\`${c}\``).join(',')}) VALUES (${cols.map(()=>'?').join(',')}) ON DUPLICATE KEY UPDATE ${updates}`,values);const[[saved]]=await conn.query('SELECT id FROM apps WHERE package_id=? LIMIT 1',[row.package_id]);map.set(Number(raw.id),Number(saved.id))}
  const related=['apk_versions','apk_media','apk_metadata','publish_queue'];
  for(const table of related){if(!(await tableExists(conn,table)))continue;const rowsIn=payload.data[table]||[];const ids=[...new Set([...map.values()])];if(ids.length)await conn.query(`DELETE FROM \`${table}\` WHERE app_id IN (${ids.map(()=>'?').join(',')})`,ids);const[metaColsRaw]=await conn.query(`SHOW COLUMNS FROM \`${table}\``),tmeta=new Map(metaColsRaw.map(c=>[c.Field,c.Type]));for(const raw of rowsIn){const row={...raw,app_id:map.get(Number(raw.app_id))};if(!row.app_id)continue;delete row.id;const cols=Object.keys(row).filter(k=>tmeta.has(k));await conn.query(`INSERT INTO \`${table}\` (${cols.map(c=>`\`${c}\``).join(',')}) VALUES (${cols.map(()=>'?').join(',')})`,cols.map(c=>normalizeDbValue(row[c],tmeta.get(c))))}}
  return map.size;
}

async function restoreAccountsAndStructure(conn,payload){
  const accountMap=new Map();
  for(const raw of payload.data.r2_accounts||[]){
    const secret=String(raw.secret_access_key||'');const enc=secret?r2.encryptSecret(secret):String(raw.secret_encrypted||'');
    const params=[raw.label,raw.enabled?1:0,raw.cloudflare_account_id,raw.bucket_name,raw.access_key_id,enc,raw.endpoint_url||null,raw.region||'auto',raw.storage_target_bytes||10737418240];
    await conn.query(`INSERT INTO r2_accounts(label,enabled,cloudflare_account_id,bucket_name,access_key_id,secret_encrypted,folder_prefix,endpoint_url,region,link_mode,direct_domain,gateway_domain,storage_target_bytes) VALUES (?,?,?,?,?,?,NULL,?,?,'gateway','','',?) ON DUPLICATE KEY UPDATE label=VALUES(label),enabled=VALUES(enabled),access_key_id=VALUES(access_key_id),secret_encrypted=VALUES(secret_encrypted),endpoint_url=VALUES(endpoint_url),region=VALUES(region),storage_target_bytes=VALUES(storage_target_bytes)`,params);
    const[[saved]]=await conn.query('SELECT id FROM r2_accounts WHERE cloudflare_account_id=? AND bucket_name=? LIMIT 1',[raw.cloudflare_account_id,raw.bucket_name]);accountMap.set(Number(raw.id),Number(saved.id));
  }
  for(const s of payload.data.r2_structure||[]){const old=Number(s.account_id);let accountId=accountMap.get(old);if(!accountId){const[[a]]=await conn.query('SELECT id FROM r2_accounts WHERE cloudflare_account_id=? AND bucket_name=? LIMIT 1',[s.cloudflare_account_id,s.bucket_name]);accountId=a?.id?Number(a.id):0}if(!accountId)continue;for(const key of s.folders||[]){const folder=String(key||'').replace(/^\/+|\/+$/g,'')+'/';if(folder==='/')continue;await conn.query(`INSERT INTO r2_objects(account_id,key_hash,object_key,filename,size_bytes,public_token,last_seen_at,source) VALUES (?,?,?,?,0,?,NOW(),'sync') ON DUPLICATE KEY UPDATE filename=VALUES(filename),last_seen_at=NOW()`,[accountId,keyHash(folder),folder,folder.split('/').filter(Boolean).pop()||'Folder',randomToken()])}}
  for(const raw of payload.data.r2_folder_meta||[]){const accountId=accountMap.get(Number(raw.account_id));if(!accountId)continue;const icon=reviveValue(raw.icon_blob);const key=String(raw.folder_key||'');if(!key)continue;await conn.query(`INSERT INTO r2_folder_meta(account_id,folder_key_hash,folder_key,icon_mime,icon_blob) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE folder_key=VALUES(folder_key),icon_mime=VALUES(icon_mime),icon_blob=VALUES(icon_blob),updated_at=CURRENT_TIMESTAMP`,[accountId,keyHash(key),key,raw.icon_mime||null,icon||null])}
  for(const d of payload.data.r2_download_domains||[]){await conn.query(`INSERT INTO r2_download_domains(hostname,verification_token,gateway_target,verified_at,active) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE gateway_target=VALUES(gateway_target),verified_at=VALUES(verified_at),active=VALUES(active)`,[d.hostname,d.verification_token||randomToken(),d.gateway_target||null,normalizeDbValue(d.verified_at,'datetime'),d.active?1:0])}
  return accountMap.size;
}

async function restoreTeam(conn,payload){let count=0;for(const raw of payload.data.team||[]){if(String(raw.role)!=='partner')continue;const avatar=reviveValue(raw.avatar_blob);const[[existing]]=await conn.query('SELECT id FROM users WHERE email=? LIMIT 1',[String(raw.email||'').toLowerCase()]);if(existing){await conn.query('UPDATE users SET name=?,is_active=?,password_hash=COALESCE(?,password_hash),avatar_mime=?,avatar_blob=? WHERE id=?',[raw.name||null,raw.is_active?1:0,raw.password_hash||null,raw.avatar_mime||null,avatar||null,existing.id])}else if(raw.password_hash){await conn.query(`INSERT INTO users(name,email,password_hash,role,is_active,avatar_mime,avatar_blob) VALUES (?,?,?,'partner',?,?,?)`,[raw.name||null,String(raw.email||'').toLowerCase(),raw.password_hash,raw.is_active?1:0,raw.avatar_mime||null,avatar||null])}count++}return count}

async function restoreStudio(payload){
  const safety=await createBackup('safety'),conn=await getPool().getConnection();restoring=true;
  try{await conn.beginTransaction();const restoredApps=await upsertPublishedApps(conn,payload);if(Array.isArray(payload.data.apk_categories)&&payload.data.apk_categories.length){await conn.query('DELETE FROM apk_categories');await insertRows(conn,'apk_categories',payload.data.apk_categories)}if(Array.isArray(payload.data.settings)){for(const x of payload.data.settings)await conn.query('INSERT INTO settings(setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)',[x.setting_key,x.setting_value])}const restoredTeam=await restoreTeam(conn,payload);const restoredAccounts=await restoreAccountsAndStructure(conn,payload);await conn.commit();const restoredFolders=(payload.data.r2_structure||[]).reduce((n,x)=>n+(x.folders||[]).length,0);return{restoredApps,restoredAccounts,restoredTeam,restoredFolders,safetyBackup:safety}}catch(e){try{await conn.rollback()}catch{}throw e}finally{conn.release();restoring=false}
}

async function restoreBackup(payload){validateBackup(payload);if(restoring)throw new Error('A restore is already in progress.');return payload.backup_format==='appbit-studio-json-backup'?restoreStudio(payload):restoreLegacy(payload)}

async function autoTick(){if(!state.dbReady||running||restoring)return;try{const lastAuto=await latest('auto'),age=lastAuto?.createdAt?Date.now()-new Date(lastAuto.createdAt).getTime():Infinity;if(!lastAuto||!Number.isFinite(age)||age>=AUTO_INTERVAL_MS){const b=await createBackup('auto');await activity.record(null,'backup_created',{details:{kind:'auto',filename:b.filename,fileSizeBytes:b.fileSizeBytes}});await notifications.notifyAdmins({type:'success',title:'Studio backup completed',message:`${b.filename} is ready to download.`,dedupeKey:`auto-backup-${b.id}`})}}catch(err){console.error('[Appbit] Automatic backup failed:',err?.message||err);try{await activity.record(null,'backup_failed',{details:{kind:'auto',error:String(err?.message||err).slice(0,500)}});await notifications.notifyAdmins({type:'error',title:'Automatic backup failed',message:String(err?.message||err).slice(0,500),dedupeKey:`auto-backup-failed-${new Date().toISOString().slice(0,10)}`})}catch{}}}
function startBackupWorker(){if(workerStarted)return;workerStarted=true;const first=setTimeout(autoTick,8000);if(first.unref)first.unref();const timer=setInterval(autoTick,CHECK_INTERVAL_MS);if(timer.unref)timer.unref()}
module.exports={createBackup,restoreBackup,validateBackup,state:stateJson,latest,getBackupFile,markDownloaded,startBackupWorker,BACKUP_DIR};
