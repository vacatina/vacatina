import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'pgsql-ast-parser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function checkBackendMigrations() {
  const dir = path.join(root, 'src/server/db/migrations');
  const names = ['001_vacatina_canonical_inventory.sql', '002_operational_runtime_state.sql', '003_backend_readiness.sql', '003_backend_readiness.rollback.sql'];
  const parsed = names.map(name => {
    const sql = fs.readFileSync(path.join(dir, name), 'utf8');
    // This parser does not implement PostgreSQL ACL statements. Validate this
    // exact constant ACL independently; never skip arbitrary unparsed SQL.
    const acl = /^REVOKE UPDATE, DELETE ON vacatina_backend_events FROM PUBLIC;$/gm;
    const aclStatements = [...sql.matchAll(acl)].length;
    return { name, statements: parse(sql.replace(acl, '')).length, constantAclStatementsValidated: aclStatements };
  });
  const forward = fs.readFileSync(path.join(dir, names[2]), 'utf8');
  const rollback = fs.readFileSync(path.join(dir, names[3]), 'utf8');
  const tables = [...forward.matchAll(/CREATE TABLE (vacatina_\w+)/g)].map(match => match[1]);
  if (tables.length !== 12 || /(?:^|;)\s*(?:DROP|TRUNCATE|DELETE|ALTER)\s/im.test(forward.replace(/--[^\n]*/g, ''))) throw new Error('Phase 15 forward migration must be additive');
  if (!forward.includes('migration_approval_guard') || !rollback.includes('rollback_approval_guard') || !rollback.includes('empty_schema_guard')) throw new Error('Migration approval/rollback safeguards missing');
  if (/\bCASCADE\b/.test(rollback.replace(/--[^\n]*/g, ''))) throw new Error('Cascading rollback is forbidden');
  for (const table of tables) if (!rollback.includes('DROP TABLE ' + table + ';')) throw new Error('Rollback coverage missing: ' + table);
  if (!forward.includes('uq_active_booking_per_trip') || !forward.includes('uq_active_payment_per_booking') || !forward.includes('uq_verified_payment_event') || !forward.includes('ON DELETE RESTRICT')) throw new Error('Critical persistence constraints missing');
  return { mode: 'PARSE_ONLY_NO_DATABASE', files: parsed, tables, migrationsExecuted: false };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(checkBackendMigrations(), null, 2));
