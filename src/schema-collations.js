'use strict';

// Appbit V2.1.1: normalize only Appbit-owned text columns. MySQL 8 may have
// inherited utf8mb4_0900_ai_ci while older installations use unicode_ci or
// ascii_general_ci. Explicit column/ENUM collations can otherwise conflict
// when both operands have IMPLICIT coercibility (for example slug <> section).
// This migration never drops, truncates, renames, or merges application data.
const TARGET = 'utf8mb4_unicode_ci';
const TABLES = Object.freeze([
  'schema_migrations', 'users', 'settings', 'apps', 'apk_categories',
  'apk_versions', 'apk_media', 'apk_metadata', 'publish_queue',
  'apk_sync_state', 'apk_update_state', 'activity_log', 'notifications',
  'app_work_claims', 'backup_history'
]);
const TEXT_TYPE = /^(?:char|varchar|tinytext|text|mediumtext|longtext|enum|set)\b/i;
const SAFE_TYPE = /^(?:(?:var)?char\(\d+\)|(?:tiny|medium|long)?text|enum\((?:.|\n)*\)|set\((?:.|\n)*\))$/i;

function identifier(value) {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error('Unexpected schema identifier.');
  return '`' + value + '`';
}
function literal(db, value) {
  if (typeof db.escape !== 'function') throw new Error('Database adapter does not support safe SQL literal escaping.');
  return db.escape(String(value));
}
function columnDefinition(db, row) {
  const type = String(row.COLUMN_TYPE || '');
  if (!TEXT_TYPE.test(type) || !SAFE_TYPE.test(type)) throw new Error('Unsupported text column definition: ' + row.TABLE_NAME + '.' + row.COLUMN_NAME);
  const extra = String(row.EXTRA || '').trim();
  if (/GENERATED|VIRTUAL|STORED/i.test(extra) || row.GENERATION_EXPRESSION) {
    throw new Error('Generated text column needs manual schema review: ' + row.TABLE_NAME + '.' + row.COLUMN_NAME);
  }
  const flags = extra ? extra.split(/\s+/).filter(Boolean) : [];
  if (flags.some(flag => flag.toUpperCase() !== 'INVISIBLE')) {
    throw new Error('Unsupported text column attribute: ' + row.TABLE_NAME + '.' + row.COLUMN_NAME);
  }
  const nullable = row.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
  let defaultSql = '';
  if (row.COLUMN_DEFAULT !== null && row.COLUMN_DEFAULT !== undefined) {
    defaultSql = ' DEFAULT ' + literal(db, row.COLUMN_DEFAULT);
  }
  const comment = row.COLUMN_COMMENT ? ' COMMENT ' + literal(db, row.COLUMN_COMMENT) : '';
  return `MODIFY COLUMN ${identifier(row.COLUMN_NAME)} ${type} CHARACTER SET utf8mb4 COLLATE ${TARGET} ${nullable}${defaultSql}${comment}${flags.length ? ' INVISIBLE' : ''}`;
}

async function inspect(db) {
  const [tables] = await db.query(`SELECT TABLE_NAME,TABLE_COLLATION FROM information_schema.TABLES
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME IN (${TABLES.map(() => '?').join(',')})`, TABLES);
  const [columns] = await db.query(`SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,COLUMN_COMMENT,EXTRA,GENERATION_EXPRESSION,CHARACTER_SET_NAME,COLLATION_NAME,ORDINAL_POSITION
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${TABLES.map(() => '?').join(',')})
    AND CHARACTER_SET_NAME IS NOT NULL ORDER BY TABLE_NAME,ORDINAL_POSITION`, TABLES);
  const [indexes] = await db.query(`SELECT TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX,COLUMN_NAME,SUB_PART,EXPRESSION
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${TABLES.map(() => '?').join(',')})
    AND NON_UNIQUE=0 ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX`, TABLES);
  const owned = new Set(tables.filter(row => TABLES.includes(row.TABLE_NAME)).map(row => row.TABLE_NAME));
  return { tables: tables.filter(row => owned.has(row.TABLE_NAME)), columns: columns.filter(row => owned.has(row.TABLE_NAME)), indexes: indexes.filter(row => owned.has(row.TABLE_NAME)) };
}

// A collation change can make two formerly distinct UNIQUE keys equal. Check
// the target comparison semantics first; never delete, merge, or use IGNORE.
async function assertUniqueKeysSafe(db, table, columns, indexes, changing) {
  const byName = new Map(columns.map(row => [row.COLUMN_NAME, row]));
  const groups = new Map();
  for (const row of indexes) {
    if (row.TABLE_NAME !== table) continue;
    if (!groups.has(row.INDEX_NAME)) groups.set(row.INDEX_NAME, []);
    groups.get(row.INDEX_NAME).push(row);
  }
  for (const [name, parts] of groups) {
    if (!parts.some(part => changing.has(part.COLUMN_NAME))) continue;
    const expressions = [];
    for (const part of parts) {
      if (!part.COLUMN_NAME || part.EXPRESSION) throw new Error(`Functional unique index ${table}.${name} needs manual review before collation repair.`);
      const col = identifier(part.COLUMN_NAME);
      const meta = byName.get(part.COLUMN_NAME);
      // Non-text columns retain their existing comparison semantics.
      let expr = col;
      if (meta && meta.CHARACTER_SET_NAME && String(meta.COLLATION_NAME).toLowerCase() !== TARGET) {
        expr = `CONVERT(${col} USING utf8mb4) COLLATE ${TARGET}`;
      }
      if (part.SUB_PART !== null && part.SUB_PART !== undefined) {
        const length = Number(part.SUB_PART);
        if (!Number.isSafeInteger(length) || length < 1) throw new Error('Invalid unique index prefix.');
        expr = `LEFT(${col}, ${length})`;
        if (meta && meta.CHARACTER_SET_NAME) expr = `CONVERT(${expr} USING utf8mb4) COLLATE ${TARGET}`;
      }
      expressions.push(expr);
    }
    const where = parts.map(part => `${identifier(part.COLUMN_NAME)} IS NOT NULL`).join(' AND ');
    const [rows] = await db.query(`SELECT 1 FROM ${identifier(table)} WHERE ${where} GROUP BY ${expressions.join(', ')} HAVING COUNT(*)>1 LIMIT 1`);
    if (rows.length) throw new Error(`Collation repair stopped: ${table}.${name} contains keys that would collide under ${TARGET}. Existing data was not merged or deleted. Back up the database and resolve the conflicting keys before retrying.`);
  }
}

async function normalizeAppbitCollations(db) {
  const schema = await inspect(db);
  const changes = new Map();
  for (const row of schema.columns) {
    if (String(row.COLLATION_NAME).toLowerCase() === TARGET) continue;
    if (!['ascii','utf8mb3','utf8mb4'].includes(String(row.CHARACTER_SET_NAME).toLowerCase())) {
      throw new Error(`Unsupported character set on ${row.TABLE_NAME}.${row.COLUMN_NAME}; manual review is required.`);
    }
    // Validate every definition before any ALTER is attempted.
    const definition = columnDefinition(db, row);
    if (!changes.has(row.TABLE_NAME)) changes.set(row.TABLE_NAME, []);
    changes.get(row.TABLE_NAME).push({row,definition});
  }
  // Preflight every affected UNIQUE key before modifying any table.
  for (const [table, entries] of changes) {
    await assertUniqueKeysSafe(db, table, schema.columns.filter(row => row.TABLE_NAME === table), schema.indexes, new Set(entries.map(entry => entry.row.COLUMN_NAME)));
  }
  let alteredTables = 0, alteredColumns = 0;
  for (const table of schema.tables) {
    const entries = changes.get(table.TABLE_NAME) || [];
    const defaultMismatch = String(table.TABLE_COLLATION).toLowerCase() !== TARGET;
    if (!entries.length && !defaultMismatch) continue;
    // One ALTER per table preserves column types/lengths, enum members,
    // defaults, comments, nullability, and indexes. It never uses CONVERT TO
    // CHARACTER SET (which can silently widen TEXT types).
    const clauses = entries.map(entry => entry.definition);
    if (defaultMismatch) clauses.push(`DEFAULT CHARACTER SET utf8mb4 COLLATE ${TARGET}`);
    await db.query(`ALTER TABLE ${identifier(table.TABLE_NAME)} ${clauses.join(', ')}`);
    alteredTables++;
    alteredColumns += entries.length;
  }
  return {alteredTables, alteredColumns};
}

module.exports = {normalizeAppbitCollations, TARGET, TABLES};
