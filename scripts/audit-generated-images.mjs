/* ============================================================================
 * Vacatina 40-Card Technical Audit (scripts/audit-generated-images.mjs)
 *
 * Section 22:
 * 40 expected files
 * 40 existing files
 * 40 unique filenames
 * 40 non-zero files
 * 40 correct dimensions (1600x960)
 * 40 WebP files
 * 0 duplicate file hashes
 * 0 broken paths
 * ============================================================================ */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { CARD_IMAGE_MANIFEST } from './card-image-manifest.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CARDS_DIR = path.join(ROOT_DIR, 'public', 'cards');

const EXPECTED_WIDTH = 1600;
const EXPECTED_HEIGHT = 960;

function calculateSha256(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function auditGeneratedImages() {
  console.log('===============================================================');
  console.log('   VACATINA 40-CARD TECHNICAL AUDIT                            ');
  console.log(`   Directory: ${CARDS_DIR}                                     `);
  console.log(`   Expected: 40 WebP files (${EXPECTED_WIDTH}x${EXPECTED_HEIGHT})`);
  console.log('===============================================================\n');

  const results = {
    expectedFiles: CARD_IMAGE_MANIFEST.length,
    existingFiles: 0,
    uniqueFilenames: 0,
    nonZeroFiles: 0,
    correctDimensions: 0,
    webpFiles: 0,
    duplicateHashes: 0,
    brokenPaths: 0,
    details: []
  };

  const filenameSet = new Set();
  const hashToFiles = new Map();

  for (const entry of CARD_IMAGE_MANIFEST) {
    filenameSet.add(entry.filename);
    const filePath = path.join(CARDS_DIR, entry.filename);

    const detail = {
      id: entry.id,
      filename: entry.filename,
      exists: false,
      sizeBytes: 0,
      width: 0,
      height: 0,
      format: null,
      sha256: null,
      issues: []
    };

    if (!fs.existsSync(filePath)) {
      results.brokenPaths++;
      detail.issues.push('FILE_MISSING');
      results.details.push(detail);
      continue;
    }

    detail.exists = true;
    results.existingFiles++;

    const stats = fs.statSync(filePath);
    detail.sizeBytes = stats.size;
    if (stats.size > 0) {
      results.nonZeroFiles++;
    } else {
      detail.issues.push('ZERO_BYTE_FILE');
    }

    try {
      const metadata = await sharp(filePath).metadata();
      detail.width = metadata.width;
      detail.height = metadata.height;
      detail.format = metadata.format;

      if (metadata.format === 'webp') {
        results.webpFiles++;
      } else {
        detail.issues.push(`FORMAT_MISMATCH_${metadata.format}`);
      }

      if (metadata.width === EXPECTED_WIDTH && metadata.height === EXPECTED_HEIGHT) {
        results.correctDimensions++;
      } else {
        detail.issues.push(`DIMENSION_MISMATCH_${metadata.width}x${metadata.height}`);
      }
    } catch (err) {
      detail.issues.push(`SHARP_METADATA_ERROR_${err.message}`);
    }

    const fileHash = calculateSha256(filePath);
    detail.sha256 = fileHash;
    if (hashToFiles.has(fileHash)) {
      hashToFiles.get(fileHash).push(entry.filename);
    } else {
      hashToFiles.set(fileHash, [entry.filename]);
    }

    results.details.push(detail);
  }

  results.uniqueFilenames = filenameSet.size;

  for (const [hash, fileList] of hashToFiles.entries()) {
    if (fileList.length > 1) {
      results.duplicateHashes += (fileList.length - 1);
      console.warn(`[Audit Warning] Duplicate content hash (${hash}) across files:`, fileList);
    }
  }

  console.log('--- AUDIT METRICS ---');
  console.log(`Expected Files:       ${results.expectedFiles} / 40`);
  console.log(`Existing Files:       ${results.existingFiles} / 40`);
  console.log(`Unique Filenames:     ${results.uniqueFilenames} / 40`);
  console.log(`Non-Zero Files:       ${results.nonZeroFiles} / 40`);
  console.log(`Correct Dimensions:   ${results.correctDimensions} / 40 (${EXPECTED_WIDTH}x${EXPECTED_HEIGHT})`);
  console.log(`WebP Files:           ${results.webpFiles} / 40`);
  console.log(`Duplicate Hashes:     ${results.duplicateHashes} (Expected: 0)`);
  console.log(`Broken Paths:         ${results.brokenPaths} (Expected: 0)`);

  const passed =
    results.expectedFiles === 40 &&
    results.existingFiles === 40 &&
    results.uniqueFilenames === 40 &&
    results.nonZeroFiles === 40 &&
    results.correctDimensions === 40 &&
    results.webpFiles === 40 &&
    results.duplicateHashes === 0 &&
    results.brokenPaths === 0;

  console.log(`\nTechnical Audit Result: ${passed ? '✔ PASS' : '✖ FAIL (Requires Generation)'}`);
  return { passed, results };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  auditGeneratedImages().then(({ passed }) => {
    if (!passed) process.exit(1);
  });
}
