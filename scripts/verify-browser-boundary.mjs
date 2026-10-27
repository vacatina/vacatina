import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { assertBrowserModuleBoundary } from './build.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = { absWorkingDir: root, bundle: true, platform: 'browser', format: 'iife', target: ['es2022'], write: false, metafile: true, logLevel: 'silent' };
const browser = buildSync({ ...options, entryPoints: ['src/app/main.ts'] });
assertBrowserModuleBoundary(Object.keys(browser.metafile.inputs));
const negative = buildSync({ ...options, stdin: { contents: "import {readBackendReadinessConfig} from './src/server/config/backend-readiness.ts'; console.log(readBackendReadinessConfig({}));", resolveDir: root, sourcefile: 'boundary-negative-probe.js' } });
let blocked = false;
try { assertBrowserModuleBoundary(Object.keys(negative.metafile.inputs)); }
catch (error) { if (error.message.startsWith('Private server module entered the browser build:')) blocked = true; else throw error; }
if (!blocked) throw new Error('Negative boundary probe was not blocked');
console.log(JSON.stringify({ browserModules: Object.keys(browser.metafile.inputs).length, serverModules: 0, negativeProbeBlocked: true, filesWritten: false }));
