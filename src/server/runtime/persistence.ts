import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { globalStorageEngine, type VacatinaStorageEngine, type IPersistenceAdapter } from '../db/storage.ts';
import type { StorageLifecycle } from '../inventory/types.ts';

type OperationalSnapshot = ReturnType<VacatinaStorageEngine['exportSnapshot']>;
export interface RuntimeStateParticipant {
  export(): unknown | Promise<unknown>;
  restore(value: unknown): void | Promise<void>;
}
interface RuntimeSnapshot { version: 1; engine: OperationalSnapshot; participants: Record<string, unknown> }
const participants = new Map<string, RuntimeStateParticipant>();

export function registerRuntimeStateParticipant(name: string, participant: RuntimeStateParticipant): void {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(name)) throw new Error('Invalid persistence participant name');
  participants.set(name, participant);
}

export class PersistenceUnavailableError extends Error {
  public readonly code = 'PERSISTENCE_UNAVAILABLE';
  constructor() { super('Durable production storage is unavailable or not enabled. Configure the database, apply its migration and explicitly enable operational writes.'); }
}

export interface RuntimePersistenceOptions {
  mode: 'file' | 'postgres' | 'unavailable';
  filePath?: string;
  engine?: VacatinaStorageEngine;
  databaseUrl?: string;
  enabled?: boolean;
  namespace?: string;
  pool?: { connect(): Promise<any>; end?(): Promise<void> };
}

/** Approved source only: database writes require a provisioned schema and explicit runtime opt-in. */
export class RuntimePersistence {
  private queue: Promise<unknown> = Promise.resolve();
  private engine: VacatinaStorageEngine;
  public readonly lifecycle: StorageLifecycle;
  private options: RuntimePersistenceOptions;
  private pool?: { connect(): Promise<any>; end?(): Promise<void> };

  constructor(options: RuntimePersistenceOptions) {
    this.options = options;
    this.engine = options.engine || globalStorageEngine;
    this.lifecycle = options.mode === 'postgres' ? 'PERSISTENT_DATABASE' : options.mode === 'file' ? 'FILE_BACKED_PROTOTYPE' : 'IN_MEMORY_PROTOTYPE';
    if (options.mode === 'postgres' && (options.pool || options.databaseUrl)) {
      this.pool = options.pool || new pg.Pool({ connectionString: options.databaseUrl, max: 4, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000 });
    }
    const adapter: IPersistenceAdapter = {
      lifecycle: this.lifecycle,
      save: async () => { throw new Error('Use RuntimePersistence.run for atomic local writes'); },
      get: async () => null, getAll: async () => [], delete: async () => false, flush: async () => {}
    };
    this.engine.attachPersistenceAdapter(adapter);
  }

  public get available(): boolean {
    return this.options.mode === 'file' || (this.options.mode === 'postgres' && Boolean(this.pool) && this.options.enabled === true);
  }

  public async run<T>(operation: () => Promise<T>): Promise<T> {
    const execution = this.queue.then(() => this.execute(operation));
    this.queue = execution.catch(() => undefined);
    return execution;
  }

  private async restore(snapshot?: RuntimeSnapshot): Promise<void> {
    if (snapshot && snapshot.version !== 1) throw new Error('Unsupported local runtime snapshot');
    this.engine.restoreSnapshot(snapshot?.engine);
    for (const [name, participant] of participants) await participant.restore(snapshot?.participants?.[name]);
  }

  private async snapshot(): Promise<RuntimeSnapshot> {
    const auxiliary: Record<string, unknown> = {};
    for (const [name, participant] of participants) auxiliary[name] = await participant.export();
    return { version: 1, engine: this.engine.exportSnapshot(), participants: auxiliary };
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.available) throw new PersistenceUnavailableError();
    if (this.options.mode === 'postgres') return this.executePostgres(operation);
    const file = path.resolve(this.options.filePath || '.data/operational-state.json');
    await fs.mkdir(path.dirname(file), { recursive: true });
    const lockFile = file + '.lock';
    let lock: Awaited<ReturnType<typeof fs.open>> | undefined;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { lock = await fs.open(lockFile, 'wx', 0o600); break; }
      catch (error: any) {
        if (error.code !== 'EEXIST') throw error;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    }
    if (!lock) throw new Error('Local operational storage is locked by another process');
    let before: RuntimeSnapshot | undefined;
    try {
      try { before = JSON.parse(await fs.readFile(file, 'utf8')); }
      catch (error: any) { if (error.code !== 'ENOENT') throw new Error('Local operational state could not be read safely'); }
      await this.restore(before);
      const result = await operation();
      const temporary = file + '.' + crypto.randomUUID() + '.tmp';
      await fs.writeFile(temporary, JSON.stringify(await this.snapshot()), { encoding: 'utf8', mode: 0o600 });
      await fs.rename(temporary, file);
      return result;
    } catch (error) {
      await this.restore(before);
      throw error;
    } finally {
      await lock.close();
      await fs.unlink(lockFile).catch(() => undefined);
    }
  }

  private async executePostgres<T>(operation: () => Promise<T>): Promise<T> {
    let client: any;
    let before: RuntimeSnapshot | undefined;
    try {
      client = await this.pool!.connect();
      await client.query('BEGIN');
      const namespace = this.options.namespace || 'vacatina-operational-v1';
      // Advisory transaction lock also serializes the first command before a row exists.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [namespace]);
      const result = await client.query('SELECT payload FROM vacatina_runtime_state WHERE namespace = $1 FOR UPDATE', [namespace]);
      before = result.rows[0]?.payload;
      await this.restore(before);
      const output = await operation();
      await client.query('INSERT INTO vacatina_runtime_state (namespace, payload) VALUES ($1, $2::jsonb) ON CONFLICT (namespace) DO UPDATE SET payload = EXCLUDED.payload, revision = vacatina_runtime_state.revision + 1, updated_at = now()', [namespace, JSON.stringify(await this.snapshot())]);
      await client.query('COMMIT');
      return output;
    } catch (error: any) {
      if (client) await client.query('ROLLBACK').catch(() => undefined);
      await this.restore(before);
      if (!client || ['42P01', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', '28P01'].includes(error.code)) throw new PersistenceUnavailableError();
      throw error;
    } finally { client?.release(); }
  }

  public async close(): Promise<void> { await this.pool?.end?.(); }
}

let activePersistence: RuntimePersistence | undefined;
export function getRuntimePersistence(): RuntimePersistence {
  if (!activePersistence) {
    const production = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
    const databaseUrl = process.env.DATABASE_URL;
    activePersistence = new RuntimePersistence({
      mode: production ? databaseUrl ? 'postgres' : 'unavailable' : 'file',
      databaseUrl,
      enabled: production && process.env.VACATINA_ENABLE_PRODUCTION_WRITES === 'true',
      filePath: process.env.VACATINA_LOCAL_STORAGE_PATH || '.data/operational-state.json'
    });
  }
  return activePersistence;
}
