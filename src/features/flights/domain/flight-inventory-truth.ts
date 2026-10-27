/* ============================================================================
 * Vacatina Flight Inventory Truth Resolver
 * Phase 5: no live supplier is activated. Every surface must use this helper
 * instead of inferring "live" from a provider label or fixture.
 * ============================================================================ */

import type {
  CanonicalFlightOffer,
  FlightInventoryMode
} from './flight-models.ts';

export interface FlightInventoryTruth {
  mode: FlightInventoryMode;
  label: string;
  shortLabel: string;
  badgeClasses: string;
  panelClasses: string;
  requiresDeskConfirmation: boolean;
  isDemo: boolean;
  isManual: boolean;
  isLive: boolean;
  priceLabel: string;
  scheduleLabel: string;
  confirmationLabel: string;
  disclosure: string;
}

type TruthSource = Pick<
  CanonicalFlightOffer,
  'sourceType' | 'bookability' | 'inventoryMode' | 'manualInventoryMetadata'
>;

/**
 * Resolves the honest inventory mode. Supplier fixtures are demo inventory
 * unless an adapter has explicitly marked the offer as live supplier data.
 */
export function resolveFlightInventoryTruth(offer: TruthSource): FlightInventoryTruth {
  const mode: FlightInventoryMode =
    offer.inventoryMode ||
    (offer.sourceType === 'manual'
      ? 'manual_request'
      : offer.bookability === 'live_bookable'
        ? 'live_supplier'
        : 'demo_fixture');

  if (mode === 'manual_request') {
    const schedulePending =
      offer.manualInventoryMetadata?.scheduleStatus !== 'CONFIRMED';
    return {
      mode,
      label: 'Manual request-to-book',
      shortLabel: 'REQUEST',
      badgeClasses: 'bg-amber-50 text-[#B45309] border border-amber-200',
      panelClasses: 'bg-amber-50/70 border border-amber-200 text-[#7C2D12]',
      requiresDeskConfirmation: true,
      isDemo: false,
      isManual: true,
      isLive: false,
      priceLabel: 'Indicative manual price',
      scheduleLabel: schedulePending
        ? 'Schedule, carrier and baggage pending desk confirmation'
        : 'Schedule confirmed by the Vacatina desk',
      confirmationLabel: 'Request to book — desk confirmation required',
      disclosure: schedulePending
        ? 'Manual request-to-book inventory. Carrier, flight number, schedule, baggage and fare rules are not supplied yet and must be confirmed by the Vacatina flight desk before ticketing.'
        : 'Manual request-to-book inventory. The Vacatina flight desk must confirm availability and fare rules before ticketing.'
    };
  }

  if (mode === 'demo_fixture') {
    return {
      mode,
      label: 'Demo fixture (non-production)',
      shortLabel: 'DEMO',
      badgeClasses: 'bg-slate-100 text-slate-700 border border-slate-200',
      panelClasses: 'bg-slate-50 border border-slate-200 text-slate-700',
      requiresDeskConfirmation: true,
      isDemo: true,
      isManual: false,
      isLive: false,
      priceLabel: 'Illustrative demo price',
      scheduleLabel: 'Illustrative schedule — not live airline inventory',
      confirmationLabel: 'Demo fare — desk quote required',
      disclosure:
        'Demonstration fixture inventory for this phase. Schedules, fares, availability and baggage are illustrative, not live airline data. No seat hold, reservation or ticketing is created.'
    };
  }

  return {
    mode,
    label: 'Live supplier fare',
    shortLabel: 'LIVE',
    badgeClasses: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    panelClasses: 'bg-emerald-50/70 border border-emerald-200 text-emerald-900',
    requiresDeskConfirmation: false,
    isDemo: false,
    isManual: false,
    isLive: true,
    priceLabel: 'Supplier total price',
    scheduleLabel: 'Supplier-returned schedule',
    confirmationLabel: 'Live supplier confirmation',
    disclosure:
      'Supplier-returned fare. Availability and fare rules must be revalidated immediately before payment.'
  };
}

export function isNonLiveInventory(offer: TruthSource): boolean {
  return resolveFlightInventoryTruth(offer).mode !== 'live_supplier';
}
