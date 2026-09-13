from pathlib import Path
p=Path('src/services/apk-resolver.js');s=p.read_text()
start=s.index('async function upsertManaged(');end=s.index('\n\nfunction taxonomyLinks',start)
f=s[start:end]
# Preserve initial validation, then obtain a single transactional connection.
f=f.replace('  const db=getPool();','  const db=await getPool().getConnection();\n  await db.beginTransaction();\n  try{',1)
f=f.replace('  await syncMedia(app.id,details);','  await syncMedia(app.id,details,{db});')
f=f.replace('  return {app,inserted:!existing,updated:Boolean(existing),updateAvailable:available};','  await db.commit();\n  return {app,inserted:!existing,updated:Boolean(existing),updateAvailable:available};\n  }catch(err){await db.rollback();throw err}finally{db.release()}')
# The previous upsert had six extra parameters and did not update current_version.
f=f.replace('developer=COALESCE(VALUES(developer),developer),description=', 'developer=COALESCE(VALUES(developer),developer),current_version=COALESCE(VALUES(current_version),current_version),description=')
old='[details.internalPackageId,details.name,details.category,details.sourceSection||\'apps\',details.categorySlug||categorySlug(details.category),details.categoryUrl||null,details.ratingValue,details.ratingCount,details.modInfo,details.popularityScore||0,details.trendingScore||0,details.developer,details.version,details.description,details.officialUrl,details.sourcePageUrl,details.sourcePackageId,details.updatedDate,JSON.stringify(details.metadata),details.apkType||details.apkFormat,details.architecture,details.fileSizeBytes,details.minimumOsVersion,details.language,details.licenseName,details.downloadCount,JSON.stringify(details.tags||[]),details.version||null,versionChanged?1:0,versionChanged?1:0,available?1:0,available?1:0,available?1:0]'
new='[details.internalPackageId,details.name,details.category,details.sourceSection||\'apps\',details.categorySlug||categorySlug(details.category),details.categoryUrl||null,details.ratingValue,details.ratingCount,details.modInfo,details.popularityScore||0,details.trendingScore||0,details.developer,details.version,details.description,details.officialUrl,details.sourcePageUrl,details.sourcePackageId,details.updatedDate,JSON.stringify(details.metadata),details.apkType||details.apkFormat,details.architecture,details.fileSizeBytes,details.minimumOsVersion,details.language,details.licenseName,details.downloadCount,JSON.stringify(details.tags||[]),details.version||null,versionChanged?1:0,versionChanged?1:0,available?1:0]'
assert old in f;f=f.replace(old,new)
# The child version upsert also had an unbound IF(?) placeholder.
f=f.replace('v.updatedDate||null]);','v.updatedDate||null,v.version===details.version&&versionChanged?1:0]);')
# Correct source freshness preservation. A new release must not inherit the old size/date.
f=f.replace('const previousSourceVersion=previous.version||existing?.current_version||null;', 'const previousSourceVersion=existing?.current_version||previous.version||null;')
# Use validated source values, not arbitrary placeholder texts, in persistent fields.
s=s[:start]+f+s[end:]
p.write_text(s)
