/* ============================================================================
 * Vacatina Validation Engine — Travellers, Cabin, Dates, and Newsletter
 * Enforces:
 * - Adults >= 1
 * - Total passengers (Adults + Children + Infants) <= 9
 * - Infants <= Adults (1 lap infant per adult safety regulation)
 * ============================================================================ */

import type { CabinClass, TravellerCounts, TravellerValidationResult } from '../domain/types.ts';

export const MIN_ADULTS = 1;
export const MAX_TOTAL_PASSENGERS = 9;
export const MAX_ROOMS = 5;

export function validateAndNormalizeTravellers(
  input: Partial<TravellerCounts>
): TravellerValidationResult {
  const errors: string[] = [];
  let notice: string | null = null;

  let adults = typeof input.adults === 'number' && !Number.isNaN(input.adults) ? Math.floor(input.adults) : 1;
  let children = typeof input.children === 'number' && !Number.isNaN(input.children) ? Math.floor(input.children) : 0;
  let infants = typeof input.infants === 'number' && !Number.isNaN(input.infants) ? Math.floor(input.infants) : 0;
  let rooms = typeof input.rooms === 'number' && !Number.isNaN(input.rooms) ? Math.floor(input.rooms) : 1;
  const cabin: CabinClass = input.cabin || 'Economy';

  // Rule 1: Minimum 1 Adult
  if (adults < MIN_ADULTS) {
    errors.push('At least 1 adult passenger (12+ yrs) is required.');
    adults = MIN_ADULTS;
  }

  if (children < 0) children = 0;
  if (infants < 0) infants = 0;
  if (rooms < 1) rooms = 1;
  if (rooms > MAX_ROOMS) rooms = MAX_ROOMS;

  // Rule 2: Infants cannot exceed Adults (airline lap-infant safety rule)
  if (infants > adults) {
    infants = adults;
    notice = `Infants adjusted to ${infants}: safety regulations allow at most 1 infant per adult passenger.`;
    errors.push(notice);
  }

  // Rule 3: Total passengers <= 9
  const total = adults + children + infants;
  if (total > MAX_TOTAL_PASSENGERS) {
    errors.push(`Maximum ${MAX_TOTAL_PASSENGERS} passengers allowed per online booking.`);
    let overflow = total - MAX_TOTAL_PASSENGERS;
    if (infants >= overflow) {
      infants -= overflow;
      overflow = 0;
    } else {
      overflow -= infants;
      infants = 0;
    }
    if (overflow > 0 && children >= overflow) {
      children -= overflow;
      overflow = 0;
    } else if (overflow > 0) {
      overflow -= children;
      children = 0;
    }
    if (overflow > 0) {
      adults = Math.max(MIN_ADULTS, adults - overflow);
    }
    if (infants > adults) {
      infants = adults;
    }
    notice = `Total passengers capped at ${MAX_TOTAL_PASSENGERS} per booking.`;
  }

  return {
    valid: errors.length === 0,
    adjusted: {
      adults,
      children,
      infants,
      cabin,
      rooms
    },
    errors,
    notice
  };
}

export function formatTravellerSummary(
  counts: TravellerCounts,
  includeCabin = true,
  includeRooms = false
): string {
  const totalPax = counts.adults + counts.children + counts.infants;
  const parts: string[] = [];

  if (includeRooms) {
    parts.push(`${counts.rooms} ${counts.rooms === 1 ? 'Room' : 'Rooms'}`);
  }

  if (counts.children === 0 && counts.infants === 0) {
    parts.push(`${counts.adults} ${counts.adults === 1 ? 'Adult' : 'Adults'}`);
  } else {
    parts.push(`${totalPax} Travellers (${counts.adults}A${counts.children ? `, ${counts.children}C` : ''}${counts.infants ? `, ${counts.infants}I` : ''})`);
  }

  if (includeCabin) {
    parts.push(counts.cabin);
  }

  return parts.join(' · ');
}

export function validateEmailAddress(email: string): { valid: boolean; message: string } {
  const trimmed = (email || '').trim();
  if (!trimmed) {
    return { valid: false, message: 'Please enter an email address.' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, message: 'Please enter a valid email address (e.g., traveller@example.com).' };
  }
  return { valid: true, message: 'Subscribed to Vacatina Travel Notes dispatches.' };
}
