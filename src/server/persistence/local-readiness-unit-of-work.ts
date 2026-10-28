import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { MemoryReadinessUnitOfWork } from './readiness-repositories.ts';
import { ReadinessError } from './readiness-contracts.ts';
import type { ReadinessRepositories, ReadinessUnitOfWork } from './readiness-contracts.ts';
import { retryLocalFileOperation } from './local-file-operation.ts';

/** Loopback development only. No ephemeral hosted filesystem may claim durability. */
export class LocalReadinessUnitOfWork implements ReadinessUnitOfWork {
  readonly engine = 'LOCAL_FILE' as const;
  private file: string;
  constructor(file: string) {
    this.file = file;
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) throw new ReadinessError('LOCAL_STORAGE_HOSTING_BLOCKED', 503);
  }
  async transaction<T>(operation: (repositories: ReadinessRepositories) => Promise<T>): Promise<T> {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) throw new ReadinessError('LOCAL_STORAGE_HOSTING_BLOCKED', 503);
    const file = path.resolve(this.file), lockPath = file + '.lock';
    await fs.mkdir(path.dirname(file), { recursive: true });
    let lock: Awaited<ReturnType<typeof fs.open>> | undefined;
    for (let attempt = 0; attempt < 160; attempt++) {
      try { lock = await fs.open(lockPath, 'wx', 0o600); break; }
      catch (error: any) { if (error.code !== 'EEXIST') throw new ReadinessError('PERSISTENCE_UNAVAILABLE', 503); await new Promise(resolve => setTimeout(resolve, 20)); }
    }
    if (!lock) throw new ReadinessError('PERSISTENCE_BUSY', 503);
    let temporary: string | undefined;
    try {
      const memory = new MemoryReadinessUnitOfWork();
      let before: string | undefined;
      try { before=await fs.readFile(file,'utf8'); memory.restoreSnapshot(JSON.parse(before)); }
      catch (error: any) { if (error.code !== 'ENOENT') throw new ReadinessError('PERSISTENCE_UNAVAILABLE', 503); }
      const result = await memory.transaction(operation);
      const serialized=JSON.stringify(memory.exportSnapshot());
      // Read-only queries must not rewrite durable state or contend on a rename.
      if (serialized===before) return result;
      temporary = file + '.' + randomUUID() + '.tmp';
      const handle = await fs.open(temporary, 'wx', 0o600);
      try { await handle.writeFile(serialized, 'utf8'); await handle.sync(); }
      finally { await handle.close(); }
      await retryLocalFileOperation(()=>fs.rename(temporary!, file));
      return result;
    } finally {
      if (temporary) await fs.unlink(temporary).catch(() => undefined);
      await lock.close(); await retryLocalFileOperation(()=>fs.unlink(lockPath));
    }
  }
}
