from pathlib import Path
p=Path(__file__).resolve().parents[1]/'src/migrations.js'
s=p.read_text().replace('const SCHEMA_VERSION = 124;', 'const SCHEMA_VERSION = 125;')
# All metadata text columns should accept the Unicode values returned by sources.
# ASCII-only identifiers are validated at the application boundary instead.
s=s.replace('CHARACTER SET ascii COLLATE ascii_general_ci','CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
s=s.replace('CHARACTER SET ascii','CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
anchor='async function migrate() {'
patch='''// Repair existing installations without dropping tables, changing IDs, or
// rebuilding the database. The previous schema used ASCII for source-supplied
// versions, package details, and category keys. Unicode values could therefore
// fail at the database boundary even when the HTML parser was correct.
async function migrateSourceTextCollations(db) {
  const tables = ['apps','apk_versions','apk_categories'];
  const [rows] = await db.query(`SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?,?,?)
      AND CHARACTER_SET_NAME='ascii'
    ORDER BY TABLE_NAME,ORDINAL_POSITION`,tables);
  for(const row of rows){
    // The names come from the fixed allowlist and the database's own schema.
    if(!tables.includes(row.TABLE_NAME)||!/^[a-z_]+$/.test(row.COLUMN_NAME))throw new Error('Unexpected schema identifier.');
    const type=String(row.COLUMN_TYPE||'');
    if(!/^(?:var)?char\\(\\d+\\)$/i.test(type))continue;
    const nullable=row.IS_NULLABLE==='YES'?'NULL':'NOT NULL';
    const defaultValue=row.COLUMN_DEFAULT;
    let defaultSql='';
    if(defaultValue!==null&&defaultValue!==undefined){
      // Preserve an existing literal default without interpolating its value.
      // All affected metadata columns normally have NULL/no defaults.
      defaultSql=' DEFAULT '+db.escape(String(defaultValue));
    }
    await db.query(`ALTER TABLE \\`${row.TABLE_NAME}\\` MODIFY COLUMN \\`${row.COLUMN_NAME}\\` ${type} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ${nullable}${defaultSql}`);
  }
}

'''
# Check the template literal escaping in the resulting JS before shipping.
s=s.replace(anchor,patch+anchor)
old="""    if (Number(current?.version||0) >= 100 && await tableExists(db,'apps')) {
      await createCoreTables(db);
      await db.query('INSERT IGNORE INTO schema_migrations (version,name) VALUES (?,?)',[SCHEMA_VERSION,'appbit_v2_import_target']);
      return SCHEMA_VERSION;
    }"""
new="""    if (Number(current?.version||0) >= 100 && await tableExists(db,'apps')) {
      await createCoreTables(db);
      await migrateSourceTextCollations(db);
      await db.query('INSERT IGNORE INTO schema_migrations (version,name) VALUES (?,?)',[SCHEMA_VERSION,'appbit_v2_1_unicode_metadata']);
      return SCHEMA_VERSION;
    }"""
assert old in s
s=s.replace(old,new).replace('    await migrateLegacyAndroidData(db);','    await migrateLegacyAndroidData(db);\n    await migrateSourceTextCollations(db);')
s=s.replace('appbit_library_taxonomy_media_pagination','appbit_v2_1_unicode_metadata')
s=s.replace('module.exports = { migrate, SCHEMA_VERSION };','module.exports = { migrate, migrateSourceTextCollations, SCHEMA_VERSION };')
# Leave the historical conversion path unchanged, but do not disable foreign key
# enforcement during the non-destructive upgrade of an existing Appbit database.
s=s.replace("  await db.query('SET FOREIGN_KEY_CHECKS=0');\n  try {\n    await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations", "  try {\n    await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations")
s=s.replace('    await renameLegacySupportTables(db);','    await db.query(\'SET FOREIGN_KEY_CHECKS=0\');\n    await renameLegacySupportTables(db);')
s=s.replace("  } finally {\n    await db.query('SET FOREIGN_KEY_CHECKS=1');\n  }\n}\n\nmodule.exports", "  } finally {\n    await db.query('SET FOREIGN_KEY_CHECKS=1');\n  }\n}\n\nmodule.exports")
# Explicitly avoid the legacy foreign-key setting on the modern path, while
# ensuring that historical conversion re-enables it after an error.
s=s.replace("  try {\n    await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (\n      version INT PRIMARY KEY,name", "  let legacyMode=false;\n  try {\n    await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (\n      version INT PRIMARY KEY,name")
s=s.replace("    await db.query('SET FOREIGN_KEY_CHECKS=0');\n    await renameLegacySupportTables", "    legacyMode=true;\n    await db.query('SET FOREIGN_KEY_CHECKS=0');\n    await renameLegacySupportTables")
s=s.replace("  } finally {\n    await db.query('SET FOREIGN_KEY_CHECKS=1');\n  }\n}\n\nmodule.exports", "  } finally {\n    if(legacyMode)await db.query('SET FOREIGN_KEY_CHECKS=1');\n  }\n}\n\nmodule.exports")
p.write_text(s)
