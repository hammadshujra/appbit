from pathlib import Path
p=Path('src/migrations.js');s=p.read_text().replace('const SCHEMA_VERSION = 123;','const SCHEMA_VERSION = 124;')
s=s.replace('    total_count INT NOT NULL DEFAULT 0,\n    processed_count INT NOT NULL DEFAULT 0,','    total_count INT NOT NULL DEFAULT 0,\n    requested_count INT NOT NULL DEFAULT 0,\n    processed_count INT NOT NULL DEFAULT 0,',1)
s=s.replace("  await ensureColumn(db,'apk_sync_state','run_id','VARCHAR(64) CHARACTER SET ascii NULL');", "  await ensureColumn(db,'apk_sync_state','run_id','VARCHAR(64) CHARACTER SET ascii NULL');\n  await ensureColumn(db,'apk_sync_state','requested_count','INT NOT NULL DEFAULT 0');")
s=s.replace("'appbit_manual_import_controls'","'appbit_v2_import_target'")
p.write_text(s)
p=Path('src/services/apk-resolver.js');s=p.read_text()
s=s.replace("queue_json:'[]',total_count:0,processed_count:0,inserted_count:0", "queue_json:'[]',total_count:0,requested_count:0,processed_count:0,inserted_count:0")
s=s.replace('const cap=Math.min(configured,Math.max(limit*10,100));','const cap=Math.min(configured,Math.max(limit*10,100));')
s=s.replace('urls=urls.filter(url=>!existing.has(normalizeSourceUrl(url)));','urls=urls.filter(url=>!existing.has(normalizeSourceUrl(url)));')
s=s.replace("  return [...new Set(urls)].slice(0,limit);", "  return [...new Set(urls)].slice(0,mode==='new'?Math.min(configured,Math.max(limit*10,100)):limit);")
s=s.replace("mode=?,queue_json='[]',total_count=0,processed_count=0", "mode=?,queue_json='[]',total_count=0,requested_count=?,processed_count=0")
s=s.replace("[runId,chosen,requestedBy?Number(requestedBy):null,SYNC_KEY]", "[runId,chosen,cap,requestedBy?Number(requestedBy):null,SYNC_KEY]")
s=s.replace("  if(!queue.length)return finishSyncIfNeeded(db,st);", "  if(!queue.length)return finishSyncIfNeeded(db,st);\n    if(st.mode==='new'&&Number(st.requested_count||0)>0&&Number(st.inserted_count||0)>=Number(st.requested_count)){\n      await db.query(\"UPDATE apk_sync_state SET queue_json='[]',current_url=NULL WHERE sync_key=? AND run_id=? AND status='running'\",[SYNC_KEY,st.run_id]);\n      return finishSyncIfNeeded(db,await getSyncState());\n    }")
s=s.replace("[JSON.stringify(queue.slice(1)),result.inserted?1:0,result.updated?1:0,SYNC_KEY,runId]);", "[JSON.stringify(queue.slice(1)),result.inserted?1:0,result.updated?1:0,SYNC_KEY,runId]);\n      if(st.mode==='new'&&Number(st.requested_count||0)>0&&Number(st.inserted_count||0)+(result.inserted?1:0)>=Number(st.requested_count)){\n        await db.query(\"UPDATE apk_sync_state SET queue_json='[]',current_url=NULL WHERE sync_key=? AND run_id=? AND status='running'\",[SYNC_KEY,runId]);\n      }")
# Preserve remaining queue on a source failure. The user can choose a new batch;
# a failed record is not marked as imported.
s=s.replace("  console.log('[Appbit] APK resolver worker started (manual imports only).');", "  console.log('[Appbit] APK resolver worker started (explicit imports only).');")
p.write_text(s)
