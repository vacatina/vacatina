import { createHash } from 'node:crypto';
import type { SearchQueryCriteria } from './types.ts';
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
  return value;
}
/** Every material criterion participates; ordering of object keys does not. */
export function searchCacheFingerprint(criteria: SearchQueryCriteria): string {
  return 'search:v2:'+createHash('sha256').update(JSON.stringify(canonical(criteria))).digest('hex');
}
