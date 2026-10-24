/* ============================================================================
 * Vacatina 8-State Trip Bucket Candidate Engine
 * Authorities:
 * - Screen 03 Foundation v1.1 Locked (Recovered Undo Remove, Change Room, Draft Plan)
 * - Screen 04 Trip Bucket Component States v1.2 Locked (8 Canonical States)
 * - 04_DATA_STATE_MODEL.md
 *
 * Financial Invariant:
 * - ONLY items in state === 'ready' are summed in `readySubtotalLkr`.
 * - Default baseline:
 *     Flight (Ready): LKR 248,500
 *     Hotel (Ready):  LKR 256,500
 *     Visa (Needs Action): LKR 45,000 (Excluded)
 *     Ready items estimate = LKR 505,000
 * ============================================================================ */

import type {
  TripBucketCandidate,
  TripBucketItemState,
  TripBucketSummary
} from '../domain/types.ts';
import {
  CANONICAL_TRIP_BUCKET_BASELINE,
  SCREEN_04_CANONICAL_STATES
} from '../mock-data/catalog.ts';

export type TripBucketListener = (items: TripBucketCandidate[], summary: TripBucketSummary) => void;

export interface StateBadgeDescriptor {
  code: string;
  label: string;
  icon: string;
  badgeClasses: string;
  cardBorderClasses: string;
  includedInReadyTotal: boolean;
}

export const TRIP_BUCKET_STATE_DESCRIPTORS: Record<TripBucketItemState, StateBadgeDescriptor> = {
  draft: {
    code: '01',
    label: 'Draft',
    icon: '◌',
    badgeClasses: 'bg-slate-100 text-slate-700 border border-slate-300',
    cardBorderClasses: 'border-brand-border bg-brand-subtle/60 border-dashed',
    includedInReadyTotal: false
  },
  ready: {
    code: '02',
    label: 'Ready',
    icon: '✓',
    badgeClasses: 'bg-green-50 text-[#15803D] border border-green-200',
    cardBorderClasses: 'border-brand-border bg-white',
    includedInReadyTotal: true
  },
  needs_action: {
    code: '03',
    label: 'Needs Action',
    icon: '!',
    badgeClasses: 'bg-amber-50 text-[#B45309] border border-amber-200',
    cardBorderClasses: 'border-amber-300 bg-amber-50/30',
    includedInReadyTotal: false
  },
  refreshing_price: {
    code: '04',
    label: 'Refreshing Price',
    icon: '↻',
    badgeClasses: 'bg-blue-50 text-[#1D4ED8] border border-blue-200',
    cardBorderClasses: 'border-blue-300 bg-blue-50/20',
    includedInReadyTotal: false
  },
  price_changed: {
    code: '05',
    label: 'Price Changed',
    icon: '△',
    badgeClasses: 'bg-amber-50 text-[#B45309] border border-amber-300',
    cardBorderClasses: 'border-amber-300 bg-amber-50/30',
    includedInReadyTotal: false
  },
  recheck_required: {
    code: '06',
    label: 'Recheck Required',
    icon: '⏱',
    badgeClasses: 'bg-amber-50 text-[#B45309] border border-amber-200',
    cardBorderClasses: 'border-amber-300 bg-amber-50/20',
    includedInReadyTotal: false
  },
  offer_expired: {
    code: '07',
    label: 'Offer Expired',
    icon: '✕',
    badgeClasses: 'bg-red-50 text-[#B91C1C] border border-red-200',
    cardBorderClasses: 'border-red-300 bg-red-50/20',
    includedInReadyTotal: false
  },
  unavailable: {
    code: '08',
    label: 'Unavailable',
    icon: '⊘',
    badgeClasses: 'bg-red-50 text-[#B91C1C] border border-red-200',
    cardBorderClasses: 'border-red-300 bg-red-50/20',
    includedInReadyTotal: false
  }
};

export function computeTripBucketSummary(items: TripBucketCandidate[]): TripBucketSummary {
  let readyCount = 0;
  let needsActionCount = 0;
  let draftCount = 0;
  let issueCount = 0;
  let readySubtotalLkr = 0;
  let excludedSubtotalLkr = 0;

  const pillParts: string[] = [];

  for (const item of items) {
    if (item.state === 'ready') {
      readyCount += 1;
      readySubtotalLkr += item.priceLkr;
      pillParts.push(`${item.productLabel} ✓`);
    } else {
      excludedSubtotalLkr += item.priceLkr;
      if (item.state === 'needs_action') {
        needsActionCount += 1;
        pillParts.push(`${item.productLabel} — Needs action`);
      } else if (item.state === 'draft') {
        draftCount += 1;
        pillParts.push(`${item.productLabel} — Draft`);
      } else {
        issueCount += 1;
        const desc = TRIP_BUCKET_STATE_DESCRIPTORS[item.state];
        pillParts.push(`${item.productLabel} — ${desc.label}`);
      }
    }
  }

  const statusSegments: string[] = [];
  if (readyCount > 0) statusSegments.push(`${readyCount} ready`);
  if (needsActionCount > 0) statusSegments.push(`${needsActionCount} needs action`);
  if (draftCount > 0) statusSegments.push(`${draftCount} draft`);
  if (issueCount > 0) statusSegments.push(`${issueCount} to review`);
  if (statusSegments.length === 0) statusSegments.push('0 items');

  return {
    totalItems: items.length,
    readyCount,
    needsActionCount,
    draftCount,
    issueCount,
    readySubtotalLkr,
    excludedSubtotalLkr,
    statusHeadline: statusSegments.join(' · '),
    itemPillsSummary: pillParts.length > 0 ? pillParts.join(' · ') : 'No travel items staged yet'
  };
}

function cloneItems(items: TripBucketCandidate[]): TripBucketCandidate[] {
  return items.map(item => ({ ...item }));
}

export class TripBucketService {
  private items: TripBucketCandidate[];
  private listeners: Set<TripBucketListener> = new Set();
  private lastRemovedEntry: { item: TripBucketCandidate; index: number } | null = null;

  constructor(initialItems: TripBucketCandidate[] = CANONICAL_TRIP_BUCKET_BASELINE) {
    this.items = cloneItems(initialItems);
  }

  public getItems(): TripBucketCandidate[] {
    return cloneItems(this.items);
  }

  public getSummary(): TripBucketSummary {
    return computeTripBucketSummary(this.items);
  }

  public getLastRemovedItem(): TripBucketCandidate | null {
    return this.lastRemovedEntry ? { ...this.lastRemovedEntry.item } : null;
  }

  public subscribe(listener: TripBucketListener): () => void {
    this.listeners.add(listener);
    listener(this.getItems(), this.getSummary());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snapshot = this.getItems();
    const summary = this.getSummary();
    this.listeners.forEach(fn => fn(snapshot, summary));
  }

  public resetToCanonicalBaseline(): void {
    this.items = cloneItems(CANONICAL_TRIP_BUCKET_BASELINE);
    this.lastRemovedEntry = null;
    this.emit();
  }

  public loadAllEightStatesDemo(): void {
    this.items = cloneItems(SCREEN_04_CANONICAL_STATES);
    this.lastRemovedEntry = null;
    this.emit();
  }

  public stageCandidate(candidate: TripBucketCandidate): void {
    const existingIdx = this.items.findIndex(i => i.id === candidate.id);
    if (existingIdx >= 0) {
      this.items[existingIdx] = { ...candidate };
    } else {
      this.items.push({ ...candidate });
    }
    this.emit();
  }

  /**
   * Recovered from Screen 03 Foundation v1.1 (#draft-trip-preview):
   * Stages a `01 · Draft` item into the Trip Bucket (excluded from Ready subtotal until configured).
   */
  public stageDraftTripPlan(
    destination = 'London (LHR), United Kingdom',
    components: string[] = ['Flights', 'Hotels', 'Visa Assistance']
  ): TripBucketCandidate {
    const draftCandidate: TripBucketCandidate = {
      id: 'tb-draft-trip-plan',
      productType: 'packages',
      productLabel: 'Draft Bundle',
      title: `Draft Trip Plan: ${destination}`,
      subtitle: `${components.join(' + ')} · Select specific options to lock rate`,
      dateSummary: 'Dates flexible · Pending selection',
      travellerSummary: '1–2 Adults · Options pending',
      state: 'draft',
      priceLkr: 0,
      actionRequiredText: '01 · Draft: Choose specific flight and room options to include in Ready subtotal.',
      primaryActionLabel: 'Choose Options',
      supplierName: 'Vacatina Bundle Orchestrator',
      integrationMode: 'ADAPTER-READY'
    };
    this.stageCandidate(draftCandidate);
    return draftCandidate;
  }

  /**
   * Recovered from Screen 03 Foundation v1.1:
   * Toggles the Hotel room selection between Deluxe King Room (LKR 256,500) and
   * Executive Twin Room (LKR 260,000), updating Ready subtotal live (LKR 505,000 <-> LKR 508,500).
   */
  public toggleHotelRoomTier(id: string): TripBucketCandidate | null {
    const item = this.items.find(i => i.id === id);
    if (!item) return null;

    if (item.priceLkr === 256500) {
      item.title = 'London Executive Twin Room';
      item.subtitle = '7 Nights · Central London · Executive Lounge + Breakfast';
      item.priceLkr = 260000;
      item.holdStatusText = 'Upgraded room selected · Indicative rate · Free cancellation until 10 Nov';
    } else {
      item.title = 'London Deluxe King Room';
      item.subtitle = '7 Nights · Central London · Breakfast Included';
      item.priceLkr = 256500;
      item.holdStatusText = 'Deluxe room selected · Indicative rate · Free cancellation until 10 Nov';
    }
    this.emit();
    return { ...item };
  }

  public removeItem(id: string): TripBucketCandidate | null {
    const idx = this.items.findIndex(item => item.id === id);
    if (idx === -1) return null;
    const [removed] = this.items.splice(idx, 1);
    this.lastRemovedEntry = { item: { ...removed }, index: idx };
    this.emit();
    return { ...removed };
  }

  public undoLastRemove(): TripBucketCandidate | null {
    if (!this.lastRemovedEntry) return null;
    const { item, index } = this.lastRemovedEntry;
    this.lastRemovedEntry = null;
    const insertIdx = Math.min(Math.max(0, index), this.items.length);
    this.items.splice(insertIdx, 0, { ...item });
    this.emit();
    return { ...item };
  }

  public transitionItemState(id: string, nextState: TripBucketItemState, note?: string): void {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    item.state = nextState;
    if (nextState === 'ready') {
      item.holdStatusText = note || 'Configuration ready · Included in Ready subtotal';
      delete item.actionRequiredText;
    } else if (note) {
      item.actionRequiredText = note;
    }
    this.emit();
  }

  public resolveItemAction(id: string): TripBucketCandidate | null {
    const item = this.items.find(i => i.id === id);
    if (!item) return null;

    switch (item.state) {
      case 'draft':
        item.state = 'ready';
        if (item.priceLkr === 0) item.priceLkr = 185000;
        item.dateSummary = '05 Dec – 09 Dec 2026';
        item.travellerSummary = '2 Adults · Confirmed Selection';
        item.holdStatusText = 'Configuration completed · Indicative rate staged';
        delete item.actionRequiredText;
        break;
      case 'needs_action':
        item.state = 'ready';
        item.holdStatusText = 'Passport details uploaded · Ready for submission';
        delete item.actionRequiredText;
        break;
      case 'refreshing_price':
        item.state = 'ready';
        item.holdStatusText = 'Rate refreshed · Indicative basket window active';
        delete item.actionRequiredText;
        break;
      case 'price_changed':
        item.state = 'ready';
        delete item.previousPriceLkr;
        item.holdStatusText = 'Updated fare accepted · Indicative basket window active';
        delete item.actionRequiredText;
        break;
      case 'recheck_required':
        item.state = 'ready';
        item.holdStatusText = 'Availability rechecked · Indicative basket window active';
        delete item.actionRequiredText;
        break;
      case 'offer_expired':
        item.state = 'ready';
        item.priceLkr = item.priceLkr + 12000;
        item.holdStatusText = 'Updated stateroom option selected · Indicative rate staged';
        delete item.actionRequiredText;
        break;
      case 'unavailable':
        item.state = 'ready';
        item.subtitle = item.subtitle.replace('09:31', '10:24');
        item.holdStatusText = 'Switched to 10:24 departure · Indicative allocation staged';
        delete item.actionRequiredText;
        break;
      default:
        break;
    }

    this.emit();
    return { ...item };
  }

  public revalidateAllReadyItems(onComplete?: () => void): void {
    const readyIds = this.items.filter(i => i.state === 'ready' || i.state === 'recheck_required').map(i => i.id);
    for (const item of this.items) {
      if (readyIds.includes(item.id)) {
        item.state = 'refreshing_price';
        item.actionRequiredText = 'Revalidating tariff and allocation…';
      }
    }
    this.emit();

    setTimeout(() => {
      for (const item of this.items) {
        if (readyIds.includes(item.id)) {
          item.state = 'ready';
          item.holdStatusText = 'Rate rechecked · Indicative basket window active';
          delete item.actionRequiredText;
        }
      }
      this.emit();
      if (onComplete) onComplete();
    }, 450);
  }
}

export const tripBucketService = new TripBucketService();
