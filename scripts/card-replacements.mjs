/* ============================================================================
 * Vacatina Canonical Card Image Replacement Map (scripts/card-replacements.mjs)
 * Authority: VACATINA — COMPLETE API-POWERED 40 IMAGE GENERATION MASTER INSTRUCTION
 *
 * Synchronized with scripts/card-image-manifest.mjs:
 * Maps cards 1..40 to final 1600x960 WebP production assets and authoritative alt text.
 * ============================================================================ */

import { CARD_IMAGE_MANIFEST } from './card-image-manifest.mjs';

export const CARD_REPLACEMENTS = {};

CARD_IMAGE_MANIFEST.forEach((card, index) => {
  const cardIndex = index + 1;
  CARD_REPLACEMENTS[cardIndex] = {
    index: cardIndex,
    id: card.id,
    category: card.category,
    destination: card.destination,
    newSrc: `./public/cards/${card.filename}`,
    newAlt: card.alt,
    subjectPrompt: card.subjectPrompt
  };
});
