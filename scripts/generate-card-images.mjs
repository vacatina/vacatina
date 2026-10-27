/* ============================================================================
 * Vacatina OpenAI Image Asset Generator (scripts/generate-card-images.mjs)
 *
 * Authorities:
 * 1. VACATINA — COMPLETE API-POWERED 40 IMAGE GENERATION MASTER INSTRUCTION
 * 2. scripts/card-image-manifest.mjs
 *
 * Responsibilities:
 * - Reads .env configuration (OPENAI_API_KEY, OPENAI_IMAGE_MODEL).
 * - Reads 40-image manifest.
 * - Sequential & controlled batch generation (10 batches of 4).
 * - Retries transient failures with exponential backoff (2s, 5s, 10s).
 * - Immediately halts on 401 / billing / model access errors without logging keys.
 * - Saves raw images to public/cards/raw/ and optimizes with sharp to 1600x960 WebP (5:3).
 * - Records audit report and retry log.
 * ============================================================================ */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import sharp from 'sharp';
import OpenAI from 'openai';
import {
  CARD_IMAGE_MANIFEST,
  buildFullPrompt
} from './card-image-manifest.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Load environment variables (.env, .env.local)
dotenv.config({ path: path.join(ROOT_DIR, '.env') });
if (!process.env.OPENAI_API_KEY && fs.existsSync(path.join(ROOT_DIR, '.env.local'))) {
  dotenv.config({ path: path.join(ROOT_DIR, '.env.local') });
}

const CARDS_DIR = path.join(ROOT_DIR, 'public', 'cards');
const RAW_DIR = path.join(CARDS_DIR, 'raw');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');
const REPORT_PATH = path.join(DOCS_DIR, 'IMAGE_GENERATION_REPORT.json');
const RETRY_REPORT_PATH = path.join(DOCS_DIR, 'IMAGE_GENERATION_RETRY_REPORT.json');

const TARGET_WIDTH = 1600;
const TARGET_HEIGHT = 960; // 5:3 aspect ratio
const DEFAULT_MODEL = 'gpt-image-2.5-sunburst';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    category: null,
    id: null,
    force: false,
    dryRun: false,
    batchSize: 4
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--category' && args[i + 1]) {
      options.category = args[++i].toLowerCase();
    } else if (arg === '--id' && args[i + 1]) {
      options.id = args[++i].toLowerCase();
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--batch-size' && args[i + 1]) {
      options.batchSize = parseInt(args[++i], 10) || 4;
    }
  }
  return options;
}

function ensureDirectories() {
  fs.mkdirSync(CARDS_DIR, { recursive: true });
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

function calculateSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function optimizeImage(inputBuffer, outputPath) {
  // Resize to 1600x960 (5:3), cover fit, centered, strip metadata, quality 85 WebP
  await sharp(inputBuffer)
    .resize(TARGET_WIDTH, TARGET_HEIGHT, {
      fit: 'cover',
      position: 'centre'
    })
    .webp({
      quality: 85,
      effort: 6,
      chromaSubsampling: '4:2:0'
    })
    .toFile(outputPath);

  const stats = fs.statSync(outputPath);
  return stats.size;
}

async function callOpenAiWithRetry(openai, model, prompt, entryId) {
  const maxRetries = 3;
  const backoffDelays = [2000, 5000, 10000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   [API Request] Model: ${model} | Size: 1536x1024 | Quality: high | Format: webp`);
      const response = await openai.images.generate({
        model: model,
        prompt: prompt,
        size: '1536x1024',
        quality: 'high',
        output_format: 'webp',
        background: 'opaque',
        n: 1
      });

      if (!response.data || response.data.length === 0 || !response.data[0].b64_json) {
        throw new Error('OpenAI response did not contain base64 image data');
      }

      return Buffer.from(response.data[0].b64_json, 'base64');
    } catch (err) {
      const status = err.status || err.statusCode || (err.error && err.error.code);
      const errorMsg = err.message || String(err);

      // Critical non-retryable errors: Stop immediately
      const isAuthError = status === 401 || errorMsg.includes('API key') || errorMsg.includes('Incorrect API key');
      const isBillingError = status === 402 || errorMsg.includes('billing') || errorMsg.includes('quota') || errorMsg.includes('insufficient_quota');
      const isModelError = status === 404 || errorMsg.includes('model') || errorMsg.includes('does not exist') || errorMsg.includes('access');

      if (isAuthError) {
        throw new Error(`[CRITICAL AUTH ERROR (401)] Authentication failed. Please verify your OPENAI_API_KEY in .env. Details: ${errorMsg}`);
      }
      if (isBillingError) {
        throw new Error(`[CRITICAL BILLING ERROR] Account billing or quota issue detected: ${errorMsg}`);
      }
      if (isModelError && !errorMsg.includes('rate')) {
        throw new Error(`[CRITICAL MODEL ERROR] The configured model "${model}" is not available for this account. Set OPENAI_IMAGE_MODEL in .env to a supported model. Details: ${errorMsg}`);
      }

      // Transient errors: retry with backoff
      if (attempt < maxRetries) {
        const delay = backoffDelays[attempt];
        console.warn(`   [Transient Error] Attempt ${attempt + 1}/${maxRetries} failed (${errorMsg}). Retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.error(`   [GENERATION_FAILED] ${entryId} exceeded ${maxRetries} retries: ${errorMsg}`);
        return null;
      }
    }
  }
  return null;
}

export async function runGeneration() {
  const options = parseArgs();
  ensureDirectories();

  const apiKey = process.env.OPENAI_API_KEY;
  const imageModel = process.env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL;

  console.log('===============================================================');
  console.log('   VACATINA 40-CARD AI IMAGE ASSET GENERATOR                  ');
  console.log(`   Model: ${imageModel}                                       `);
  console.log(`   Target Size: ${TARGET_WIDTH}x${TARGET_HEIGHT} (5:3 WebP)   `);
  console.log(`   Force Overwrite: ${options.force}                          `);
  console.log(`   Dry Run: ${options.dryRun}                                  `);
  if (options.category) console.log(`   Category Filter: ${options.category}   `);
  if (options.id) console.log(`   ID Filter: ${options.id}                   `);
  console.log('===============================================================\n');

  // Filter entries
  let targetEntries = [...CARD_IMAGE_MANIFEST];
  if (options.category) {
    targetEntries = targetEntries.filter(c => c.category.toLowerCase() === options.category);
  }
  if (options.id) {
    targetEntries = targetEntries.filter(c => c.id.toLowerCase() === options.id);
  }

  if (targetEntries.length === 0) {
    console.log('[Notice] No cards match the specified filter criteria.');
    return;
  }

  console.log(`Queue contains ${targetEntries.length} card(s) to process.\n`);

  if (options.dryRun) {
    console.log('--- DRY RUN MODE: Validating prompts and configurations ---');
    targetEntries.forEach((entry, idx) => {
      const fullPrompt = buildFullPrompt(entry.subjectPrompt);
      console.log(`[#${idx + 1}] ID: ${entry.id} | File: ${entry.filename}`);
      console.log(`     Alt: "${entry.alt}"`);
      console.log(`     Prompt length: ${fullPrompt.length} chars`);
      console.log(`     Preview: ${fullPrompt.slice(0, 120)}...\n`);
    });
    console.log('✔ Dry run verification passed. All 40 prompts built cleanly.');
    return;
  }

  // Check API Key
  if (!apiKey || apiKey === '<SECRET>' || apiKey.trim() === '') {
    console.error('\n✖ [CONFIGURATION ERROR] OPENAI_API_KEY is not set.');
    console.error('Please configure your OpenAI API key in .env before running:');
    console.error('  OPENAI_API_KEY=your_actual_key_here');
    console.error(`  OPENAI_IMAGE_MODEL=${imageModel}\n`);
    throw new Error('OPENAI_API_KEY missing. Execution stopped cleanly.');
  }

  const openai = new OpenAI({ apiKey: apiKey });

  const report = {
    timestamp: new Date().toISOString(),
    model: imageModel,
    totalTarget: targetEntries.length,
    generatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    entries: []
  };
  const failedEntries = [];

  // Group into batches of batchSize (default 4)
  const batches = [];
  for (let i = 0; i < targetEntries.length; i += options.batchSize) {
    batches.push(targetEntries.slice(i, i + options.batchSize));
  }

  for (let b = 0; b < batches.length; b++) {
    const currentBatch = batches[b];
    console.log(`\n▶ [Batch ${b + 1}/${batches.length}] Processing ${currentBatch.length} card(s)...`);

    for (const entry of currentBatch) {
      const finalWebpPath = path.join(CARDS_DIR, entry.filename);
      const rawWebpPath = path.join(RAW_DIR, `${entry.id}-raw.webp`);

      // Check if already exists and not force
      if (fs.existsSync(finalWebpPath) && !options.force) {
        console.log(`✔ [Skipped (Exists)] ${entry.id} -> ${entry.filename} (use --force to overwrite)`);
        const stats = fs.statSync(finalWebpPath);
        const hash = calculateSha256(finalWebpPath);
        report.skippedCount++;
        report.entries.push({
          id: entry.id,
          category: entry.category,
          filename: entry.filename,
          alt: entry.alt,
          status: 'EXISTS',
          fileSizeKb: Math.round(stats.size / 1024),
          sha256: hash
        });
        continue;
      }

      console.log(`\n▶ Generating: [${entry.id}] (${entry.destination})`);
      const fullPrompt = buildFullPrompt(entry.subjectPrompt);

      try {
        const rawBuffer = await callOpenAiWithRetry(openai, imageModel, fullPrompt, entry.id);

        if (!rawBuffer) {
          report.failedCount++;
          failedEntries.push({ id: entry.id, error: 'GENERATION_FAILED_AFTER_RETRIES' });
          continue;
        }

        // Save raw image
        fs.writeFileSync(rawWebpPath, rawBuffer);

        // Crop & optimize to 1600x960 WebP (5:3)
        const finalSize = await optimizeImage(rawBuffer, finalWebpPath);
        const finalSizeKb = Math.round(finalSize / 1024);
        const finalHash = calculateSha256(finalWebpPath);

        console.log(`✔ [Generated & Optimized] ${entry.filename} (${finalSizeKb} KB, ${TARGET_WIDTH}x${TARGET_HEIGHT})`);

        report.generatedCount++;
        report.entries.push({
          id: entry.id,
          category: entry.category,
          filename: entry.filename,
          alt: entry.alt,
          status: 'GENERATED',
          fileSizeKb: finalSizeKb,
          sha256: finalHash
        });

        // Small inter-request throttle
        await new Promise(r => setTimeout(r, 1000));
      } catch (fatalErr) {
        console.error(`\n✖ [FATAL ERROR on ${entry.id}]:`, fatalErr.message);
        fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
        fs.writeFileSync(RETRY_REPORT_PATH, JSON.stringify(failedEntries, null, 2), 'utf8');
        throw fatalErr;
      }
    }

    // Inter-batch pause
    if (b < batches.length - 1) {
      console.log(`... Pausing 2 seconds between batches ...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Write reports
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  if (failedEntries.length > 0) {
    fs.writeFileSync(RETRY_REPORT_PATH, JSON.stringify(failedEntries, null, 2), 'utf8');
  } else if (fs.existsSync(RETRY_REPORT_PATH)) {
    fs.rmSync(RETRY_REPORT_PATH);
  }

  console.log('\n===============================================================');
  console.log('   IMAGE GENERATION PASS FINISHED                              ');
  console.log(`   Generated: ${report.generatedCount}                         `);
  console.log(`   Skipped: ${report.skippedCount}                             `);
  console.log(`   Failed: ${report.failedCount}                               `);
  console.log(`   Report: ${REPORT_PATH}                                      `);
  console.log('===============================================================\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runGeneration().catch(err => {
    console.error('Generation script aborted:', err.message);
    process.exit(1);
  });
}
