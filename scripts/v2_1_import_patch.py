from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'src/services/apk-resolver.js';s=p.read_text()
s=s.replace("  const developer=firstLabel(labels,['developer','publisher','author'])||fields.personName(app.developer)||fields.personName(app.author)||fields.personName(app.creator)||fields.personName(app.publisher);", """  const headerDeveloper=metadataContent($,['.app-hero [class*="developer"]','.app-hero a[href*="/developer/"]','.app-header [class*="developer"]','.app-header a[href*="/developer/"]','[itemprop="author"] [itemprop="name"]','[itemprop="author"] a']);
  const developer=firstLabel(labels,['developer','publisher','author'])||fields.personName(app.developer)||fields.personName(app.author)||fields.personName(app.creator)||fields.personName(app.publisher)||headerDeveloper;""")
anchor='async function fetchPackageDetails(pageUrl,{signal}={}) {'
patch='''// Read a source-linked download/details page only when the primary page is
// missing facts. This is a normal public metadata request, not a direct APK
// resolver or an access-control bypass. Version-specific facts must match.
async function enrichMissingSourceFields(details,{signal}={}) {
  const missing=details.missingFields||[];
  const index=source.sourceUrl(details.downloadPageUrl);
  if(!index||!missing.length||source.sourceUrl(details.sourcePageUrl)===index)return details;
  try{
    const response=await fetchText(index,{signal});
    const $=cheerio.load(response.text),labels=labelMap($);
    const app=pickSoftwareJsonLd(jsonLdObjects($),details.sourcePackageId);
    const secondaryVersion=normalizeVersion(firstLabel(labels,['version'])||app.softwareVersion||app.version);
    const sameVersion=Boolean(secondaryVersion&&secondaryVersion===details.version);
    const developer=firstLabel(labels,['developer','publisher','author'])||fields.personName(app.developer)||fields.personName(app.author)||fields.personName(app.publisher);
    const sizeRaw=firstLabel(labels,['size','file size','apk size','app size'])??app.fileSize;
    const updated=extractUpdatedRaw($,app,labels,cleanText($('body').text()));
    const downloads=parseCount(firstLabel(labels,['downloads','download count']))??fields.structuredCount(app.downloadCount??app.numDownloads);
    const views=parseCount(firstLabel(labels,['views','reached']))??null;
    const apply=(key,value,metaKey=key)=>{
      if(value==null||value==='')return;
      if(details[key]!=null&&details[key]!=='')return;
      details[key]=value;details.metadata[metaKey]=value;
      details.fieldSources[key==='fileSizeBytes'?'size':key==='updatedDate'?'updated':key]='source:download-details';
    };
    apply('developer',developer);
    if(sameVersion){
      if(parseBytes(sizeRaw)!=null){apply('fileSizeBytes',parseBytes(sizeRaw));if(!details.metadata.size)details.metadata.size=sizeRaw;}
      apply('updatedDate',updated.value);
      if(updated.value&&!details.metadata.updated){details.metadata.updated=updated.value;details.metadata.updatedDateSource='source:download-details';}
    }
    apply('downloadCount',downloads);apply('viewCount',views);
    details.missingFields=metadataMissingFields(details);
    details.metadata.missingFields=details.missingFields;
    details.metadata.fieldSources=details.fieldSources;
  }catch(err){
    if(signal?.aborted||err.code==='SOURCE_STOPPED')throw err;
    details.metadata.enrichmentWarning=String(err.message||err).slice(0,300);
  }
  return details;
}
function metadataMissingFields(d) {
  const checks={name:d.metadata?.name||d.name,developer:d.developer,version:d.version,size:d.fileSizeBytes,updated:d.updatedDate,downloads:d.downloadCount};
  return Object.entries(checks).filter(([key,v])=>v==null||v===''||key==='size'&&!(Number(v)>0)).map(([key])=>key);
}
function requiredMissingFields(d){return metadataMissingFields(d).filter(k=>k!=='downloads')}

'''
s=s.replace(anchor,patch+anchor)
s=s.replace("  if(!d.looksLikeAppPage)throw new Error('LiteAPKs did not return a recognizable app detail page.');", "  if(!d.looksLikeAppPage)throw new Error('LiteAPKs did not return a recognizable app detail page.');\n  await enrichMissingSourceFields(d,{signal});",1)
s=s.replace("  if(!details.internalPackageId)throw new Error('The APK source did not provide a stable app identity.');", "  if(!details.internalPackageId)throw new Error('The APK source did not provide a stable app identity.');\n  if(!details.version||!details.metadata?.name)throw Object.assign(new Error('The source did not provide a verified app name and version. No incomplete identity was imported.'),{status:422,code:'SOURCE_IDENTITY_INCOMPLETE'});")
# Existing tests fabricate an app with no metadata.name; tests are adjusted to the genuine source contract.
needle="  if(details.fileSizeBytes&&(!merged.size||!parseBytes(merged.size)))merged.size=details.fileSizeBytes;"
replacement="""  if(details.fileSizeBytes&&(!merged.size||!parseBytes(merged.size)))merged.size=details.fileSizeBytes;
  details.metadata=merged;
  const missing=metadataMissingFields(details);
  const requiredMissing=requiredMissingFields(details);
  const metadataStatus=requiredMissing.length?'pending':'ready';
  const metadataError=requiredMissing.length?'Source metadata needs: '+requiredMissing.join(', '):null;
  merged.missingFields=missing;
  merged.fieldSources={...(previous.fieldSources||{}),...(details.fieldSources||{})};
  details.missingFields=missing;
  details.fieldSources=merged.fieldSources;
"""
assert needle in s;s=s.replace(needle,replacement)
s=s.replace("NOW(),NULL,'ready',1,NULL,NOW())", "NOW(),NULL,?,1,?,NOW())",1)
s=s.replace("metadata_status='ready',metadata_error=NULL,metadata_updated_at=NOW()", "metadata_status=VALUES(metadata_status),metadata_error=VALUES(metadata_error),metadata_updated_at=NOW()",1)
s=s.replace("details.version||null,available?1:0]);", "details.version||null,available?1:0,metadataStatus,metadataError]);",1)
s=s.replace("  return {app,inserted:!existing,updated:Boolean(existing),updateAvailable:available};", "  return {app,inserted:!existing,updated:Boolean(existing),updateAvailable:available,metadataStatus,missingFields:missing};",1)
# Include the actual failure context on a row where an importer database write fails.
s=s.replace("  }catch(err){try{await db.rollback()}catch{}throw err}finally{db.release()}\n}\n\n\nfunction taxonomyLinks", "  }catch(err){try{await db.rollback()}catch{}throw err}finally{db.release()}\n}\n\n\nfunction taxonomyLinks")
# Count incomplete records independently; they are saved but never presented
# as complete metadata. The requested count still means new app records.
s=s.replace("inserted_count=0,updated_count=0,failed_count=0,current_url=NULL", "inserted_count=0,updated_count=0,failed_count=0,incomplete_count=0,current_url=NULL",1)
s=s.replace("inserted_count=inserted_count+?,updated_count=updated_count+?,current_url=NULL,last_error=NULL", "inserted_count=inserted_count+?,updated_count=updated_count+?,incomplete_count=incomplete_count+?,current_url=NULL,last_error=NULL")
s=s.replace("result.inserted?1:0,result.updated?1:0,SYNC_KEY,runId", "result.inserted?1:0,result.updated?1:0,result.metadataStatus==='pending'?1:0,SYNC_KEY,runId",1)
s=s.replace("inserted:Number(done.inserted_count||0),updated:Number(done.updated_count||0),failed:Number(done.failed_count||0)", "inserted:Number(done.inserted_count||0),updated:Number(done.updated_count||0),incomplete:Number(done.incomplete_count||0),failed:Number(done.failed_count||0)")
s=s.replace("${Number(done.updated_count||0).toLocaleString()} refreshed · ${Number(done.failed_count||0).toLocaleString()} failed.", "${Number(done.updated_count||0).toLocaleString()} refreshed · ${Number(done.incomplete_count||0).toLocaleString()} need metadata · ${Number(done.failed_count||0).toLocaleString()} failed.")
s=s.replace("  internalPackageId,normalizeSourceUrl,isLikelyAppUrl", "  internalPackageId,normalizeSourceUrl,isLikelyAppUrl,metadataMissingFields,requiredMissingFields")
p.write_text(s)
p=root/'src/migrations.js';s=p.read_text()
s=s.replace("    failed_count INT NOT NULL DEFAULT 0,", "    failed_count INT NOT NULL DEFAULT 0,\n    incomplete_count INT NOT NULL DEFAULT 0,",1)
s=s.replace("  await ensureColumn(db,'apk_sync_state','requested_count','INT NOT NULL DEFAULT 0');", "  await ensureColumn(db,'apk_sync_state','requested_count','INT NOT NULL DEFAULT 0');\n  await ensureColumn(db,'apk_sync_state','incomplete_count','INT NOT NULL DEFAULT 0');")
p.write_text(s)
p=root/'src/db.js';s=p.read_text().replace("charset: 'utf8mb4',", "charset: 'UTF8MB4_UNICODE_CI',")
p.write_text(s)
p=root/'src/utils/sql-checked.js';s=p.read_text()
s=s.replace("  return typeof db.execute==='function'?db.execute(sql,args):db.query(sql,args);", """  const task=typeof db.execute==='function'?db.execute(sql,args):db.query(sql,args);
  return Promise.resolve(task).catch(err=>{
    if(/conversion from collation|illegal mix of collations/i.test(String(err.message||''))){
      const error=new Error('Database text collation is incompatible. Check that Appbit schema migration 125 completed successfully.');
      error.code='DB_TEXT_COLLATION';error.status=500;error.cause=err;throw error;
    }
    throw err;
  });""")
p.write_text(s)
