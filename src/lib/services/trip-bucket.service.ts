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
  TripBucketSummary,
  TravelProductSlug
} from '../domain/types.ts';
import type { VacatinaNormalizedOffer } from '../domain/inventory-models.ts';
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
    // Subtotals are LKR-denominated. Native-currency sandbox quotes must not be
    // added to an LKR total as if the numeric amount were LKR.
    const countsTowardLkrTotal = !item.currency || item.currency === 'LKR';
    if (item.state === 'ready') {
      readyCount += 1;
      if (countsTowardLkrTotal) readySubtotalLkr += item.priceLkr;
      pillParts.push(`${item.productLabel} ✓`);
    } else {
      if (countsTowardLkrTotal) excludedSubtotalLkr += item.priceLkr;
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
  return structuredClone(items).map(item => {
    if ((item.inventoryMode === 'demo_fixture' || item.inventoryMode === 'manual_request') && item.state === 'ready') return { ...item, state: 'needs_action', confirmationMode: 'REQUEST_TO_CONFIRM' };
    return item;
  });
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

  /** Replace the display snapshot with the authenticated server bucket. */
  public replaceCandidates(items: TripBucketCandidate[]): void {
    this.items = cloneItems(items);
    this.lastRemovedEntry = null;
    this.emit();
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
    if ((candidate.inventoryMode === 'demo_fixture' || candidate.inventoryMode === 'manual_request') && candidate.state === 'ready') {
      candidate = { ...candidate, state: 'needs_action', confirmationMode: 'REQUEST_TO_CONFIRM' };
    }
    const existingIdx = this.items.findIndex(i => i.id === candidate.id);
    if (existingIdx >= 0) {
      this.items[existingIdx] = structuredClone(candidate);
    } else {
      this.items.push(structuredClone(candidate));
    }
    this.emit();
  }

  public addItem(item: {
    type?: string;
    productType?: TravelProductSlug;
    title: string;
    route?: string;
    subtitle?: string;
    provider?: string;
    supplierName?: string;
    dates?: string;
    dateSummary?: string;
    priceLkr: number;
    state?: string;
  }): void {
    const pType = (item.productType || (item.type === 'flight' ? 'flights' : item.type === 'hotel' ? 'hotels' : item.type === 'visa' ? 'visa' : 'packages')) as TravelProductSlug;
    this.stageCandidate({
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productType: pType,
      productLabel: pType.toUpperCase(),
      title: item.title,
      subtitle: item.subtitle || item.provider || item.route || '',
      dateSummary: item.dateSummary || item.dates || 'Selected Dates',
      travellerSummary: '2 Adults',
      state: (item.state?.toLowerCase() === 'ready' ? 'ready' : 'needs_action') as any,
      priceLkr: item.priceLkr,
      supplierName: item.supplierName || item.provider || 'Vacatina Direct',
      integrationMode: 'ADAPTER-READY'
    });
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
    if (item.configuration || item.inventoryMode) return { ...item };

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

  /**
   * Stages a canonical normalized offer into the Trip Bucket.
   * Preserves offerId, sourceType, confirmationMode, raw supplier price, and pricing layers.
   */
  public stageNormalizedOffer(
    offer: VacatinaNormalizedOffer,
    customState?: TripBucketItemState
  ): TripBucketCandidate {
    const isRequestToConfirm = offer.confirmationMode === 'REQUEST_TO_CONFIRM';
    const isAssistedService = offer.confirmationMode === 'ASSISTED_SERVICE';
    const isSeed = offer.sourceType === 'SEED' || Boolean(offer.isSeedContent);

    let initialState: TripBucketItemState = customState || 'ready';
    let actionRequiredText: string | undefined = undefined;
    let holdStatusText: string = 'Instant confirmation eligible · Ready subtotal staged';

    if (isSeed) {
      // Enforce Part 5: Seed content MUST NOT enter checkout as Ready
      initialState = 'draft';
      actionRequiredText = 'Prototype Seed Content: Discovery sample only. Select from live search or promote to manual inventory before booking.';
      holdStatusText = 'Seed Content · Non-commercial draft';
    } else if (isRequestToConfirm) {
      initialState = 'needs_action';
      actionRequiredText = 'Request to Confirm: Supplier confirmation required before guaranteed booking.';
      holdStatusText = 'On Request · Subject to partner allocation';
    } else if (isAssistedService) {
      initialState = 'needs_action';
      actionRequiredText = 'Assisted Service: Applicant document upload required.';
      holdStatusText = 'Consular advisory desk staging';
    }

    const candidate: TripBucketCandidate = {
      id: `tb-${offer.offerId}`,
      productType: offer.productType,
      productLabel: offer.productType.charAt(0).toUpperCase() + offer.productType.slice(1),
      title: offer.title,
      subtitle: offer.subtitle,
      dateSummary: 'Travel window confirmed',
      travellerSummary: 'Standard party configuration',
      state: initialState,
      priceLkr: offer.pricing.customerSellingPriceLkr,
      holdStatusText,
      actionRequiredText,
      primaryActionLabel: isRequestToConfirm ? 'Check Request' : 'Complete Details',
      supplierName: offer.supplierName,
      integrationMode: offer.sourceType === 'API' ? 'LIVE' : 'ADAPTER-READY',
      offerId: offer.offerId,
      sourceType: offer.sourceType,
      confirmationMode: offer.confirmationMode,
      rawSupplierPrice: offer.pricing.supplierRawBasePrice,
      supplierBaseCurrency: offer.pricing.supplierBaseCurrency,
      markupAmountLkr: offer.pricing.vacatinaMarkup.amountLkr
    };

    this.stageCandidate(candidate);
    return candidate;
  }

  /**
   * Explicitly confirms a partner allocation for an on-request item,
   * permitting it to become Ready for booking.
   */
  public confirmOnRequestAllocation(id: string, partnerReference?: string): TripBucketCandidate | null {
    const item = this.items.find(i => i.id === id);
    if (!item) return null;
    if (item.inventoryMode === 'demo_fixture' || item.inventoryMode === 'manual_request') {
      item.state = 'needs_action';
      item.holdStatusText = 'No verified supplier allocation · Local request only';
      this.emit(); return { ...item };
    }
    item.state = 'ready';
    item.holdStatusText = partnerReference
      ? `Partner allocation confirmed (${partnerReference}) · Ready for booking`
      : 'Partner allocation confirmed · Ready for booking';
    delete item.actionRequiredText;
    this.emit();
    return { ...item };
  }

  /**
   * Resolves a 'needs_action' item (such as uploading visa applicant passport details or
   * completing mandatory room configuration), transitioning the item to 'ready'.
   */
  public resolveNeedsAction(id: string, metadata?: Record<string, unknown>): TripBucketCandidate | null {
    const item = this.items.find(i => i.id === id);
    if (!item) return null;

    // Request-to-book, demo and manual inventory cannot become Ready through a
    // generic resolver. Only an explicit desk-confirmed allocation may promote it.
    if (
      item.inventoryMode === 'demo_fixture' ||
      item.inventoryMode === 'manual_request' ||
      item.confirmationMode === 'REQUEST_TO_CONFIRM'
    ) {
      item.state = 'needs_action';
      item.holdStatusText = 'On request · No live supplier confirmation received';
      item.actionRequiredText =
        item.inventoryMode === 'demo_fixture'
          ? 'Demo fixture inventory — no supplier request or seat hold was created.'
          : item.productType === 'flights' ? 'Request-to-book: the Vacatina desk must confirm carrier, schedule, baggage and fare before ticketing.' : 'Request-to-confirm: the operator must verify the selected configuration, current price and conditions before booking.';
      if (metadata) {
        (item as any).metadata = { ...((item as any).metadata || {}), ...metadata };
      }
      this.emit();
      return { ...item };
    }

    item.state = 'ready';
    item.holdStatusText = 'Requirements satisfied · Ready for checkout';
    delete item.actionRequiredText;
    if (metadata) {
      (item as any).metadata = { ...((item as any).metadata || {}), ...metadata };
    }
    this.emit();
    return { ...item };
  }

  /**
   * Returns breakdown of inventory source modes and confirmation workflows
   * currently present in the active Trip Bucket.
   */
  public getMixedSourceBreakdown(): {
    apiCount: number;
    manualCount: number;
    hybridCount: number;
    instantCount: number;
    onRequestCount: number;
    assistedServiceCount: number;
  } {
    let apiCount = 0;
    let manualCount = 0;
    let hybridCount = 0;
    let instantCount = 0;
    let onRequestCount = 0;
    let assistedServiceCount = 0;

    for (const item of this.items) {
      if (item.sourceType === 'API') apiCount++;
      else if (item.sourceType === 'MANUAL') manualCount++;
      else if (item.sourceType === 'HYBRID') hybridCount++;

      if (item.confirmationMode === 'INSTANT_CONFIRM') instantCount++;
      else if (item.confirmationMode === 'REQUEST_TO_CONFIRM') onRequestCount++;
      else if (item.confirmationMode === 'ASSISTED_SERVICE') assistedServiceCount++;
    }

    return {
      apiCount,
      manualCount,
      hybridCount,
      instantCount,
      onRequestCount,
      assistedServiceCount
    };
  }

  public transitionItemState(id: string, nextState: TripBucketItemState, note?: string): void {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    // Integrity Guard (Part 5): Seed content MUST NOT enter checkout as Ready
    if (nextState === 'ready' && item.sourceType === 'SEED') {
      item.state = 'draft';
      item.actionRequiredText = note || 'Prototype Seed Content: Must be selected from live search or promoted to manual inventory before booking.';
      item.holdStatusText = 'Seed Content · Non-commercial draft';
      this.emit();
      return;
    }

    // Integrity Guard: An on-request item CANNOT falsely become 'ready' without confirmed allocation!
    if (nextState === 'ready' && item.confirmationMode === 'REQUEST_TO_CONFIRM') {
      item.state = 'needs_action';
      item.actionRequiredText = note || 'Request to Confirm pending: Partner confirmation required before booking.';
      item.holdStatusText = 'On Request · Pending partner response';
      this.emit();
      return;
    }

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

    // Part 5 Guard: Seed items cannot be resolved into Ready without inventory promotion
    if (item.sourceType === 'SEED') {
      item.actionRequiredText = 'Prototype Seed Content: Please select a verified live offer from search.';
      this.emit();
      return { ...item };
    }

    // Request-to-book, demo and manual inventory stay Needs Action even when a
    // customer reviews the fare. No live supplier message is sent by this build.
    if (
      item.inventoryMode === 'demo_fixture' ||
      item.inventoryMode === 'manual_request' ||
      item.confirmationMode === 'REQUEST_TO_CONFIRM'
    ) {
      item.state = 'needs_action';
      item.holdStatusText = 'On request · No live supplier confirmation received';
      item.actionRequiredText =
        item.inventoryMode === 'demo_fixture'
          ? 'Demo fixture inventory — no supplier request or seat hold was created. Request a desk quote before booking.'
          : item.productType === 'flights' ? 'Request-to-book: the Vacatina desk must confirm carrier, schedule, baggage and fare before ticketing.' : 'Request-to-confirm: the operator must verify the selected configuration, current price and conditions before booking.';
      item.primaryActionLabel = 'Request Desk Confirmation';
      this.emit();
      return { ...item };
    }

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
    const readyIds = this.items.filter(i => (i.state === 'ready' || i.state === 'recheck_required') && i.inventoryMode !== 'demo_fixture' && i.inventoryMode !== 'manual_request' && i.confirmationMode !== 'REQUEST_TO_CONFIRM').map(i => i.id);
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
