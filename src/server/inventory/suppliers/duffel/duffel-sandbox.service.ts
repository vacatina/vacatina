/* ============================================================================
 * Vacatina Duffel Sandbox Journey Service (server-only)
 *
 * Phase 16: real Duffel TEST MODE search, offer retrieval, revalidation,
 * ancillary/seat lookup and explicit sandbox order creation.
 *
 * Safety boundaries:
 * - Only a `duffel_test_` credential with DUFFEL_TEST_MODE_ENABLED=true can
 *   reach this service. Production/live runtimes are rejected upstream.
 * - Every offer and order must report live_mode=false.
 * - Orders are explicit, idempotent and never automatically retried after an
 *   ambiguous outcome.
 * - Raw provider error bodies are never returned to the browser.
 * ============================================================================ */

import { createHash } from 'node:crypto';
import type { CanonicalOfferEntity, RevalidationResult, SearchQueryCriteria } from '../../types.ts';
import type { FlightProductExtension } from '../../product-extensions.ts';
import { FlightsDuffelAdapter } from '../../adapters/flights-duffel.adapter.ts';
import { DuffelApiError, type DuffelOrder } from './duffel-client.ts';
import {
  getDuffelSandboxRuntimeStatus,
  isDuffelSandboxRuntimeEnabled,
  type DuffelTestModeState
} from './duffel-runtime.ts';
import { MemoryReadinessUnitOfWork } from '../../../persistence/readiness-repositories.ts';
import type { ReadinessUnitOfWork } from '../../../persistence/readiness-contracts.ts';

export type SandboxFailureCode =
  | 'SANDBOX_DISABLED'
  | 'SANDBOX_VALIDATION_FAILED'
  | 'SANDBOX_AUTH_FAILED'
  | 'SANDBOX_RATE_LIMITED'
  | 'SANDBOX_OFFER_NOT_FOUND'
  | 'SANDBOX_OFFER_EXPIRED'
  | 'SANDBOX_PRICE_CHANGED'
  | 'SANDBOX_OFFER_UNAVAILABLE'
  | 'SANDBOX_OUTCOME_UNKNOWN'
  | 'SANDBOX_UNAVAILABLE'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'ORDER_IN_PROGRESS';

export class DuffelSandboxError extends Error {
  public readonly code: SandboxFailureCode;
  public readonly status: number;
  public readonly retryable: boolean;

  constructor(code: SandboxFailureCode, status: number, message: string, retryable = false) {
    super(message);
    this.name = 'DuffelSandboxError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export interface SandboxSearchInput {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  tripType?: 'one_way' | 'round_trip' | 'multi_city';
  adults?: number;
  children?: number;
  infants?: number;
  cabinClass?: string;
  currency?: string;
}

export interface SandboxPassengerInput {
  offerPassengerId: string;
  title: string;
  givenName: string;
  familyName: string;
  bornOn: string;
  email: string;
  phoneNumber: string;
  /** Duffel requires gender for some carriers; the sandbox order flow always collects it. */
  gender: 'M' | 'F';
}

export interface SandboxOrderInput {
  offerId: string;
  supplierOfferId?: string;
  passengers: SandboxPassengerInput[];
  services?: Array<{ id: string; quantity: number }>;
  acceptedPriceMinor?: number;
}

export interface SandboxOrderResult {
  sandbox: true;
  nonProduction: true;
  liveMode: false;
  orderId: string;
  bookingReference?: string;
  ownerName?: string;
  totalAmountMinor: number;
  currency: string;
  createdAt: string;
  passengerCount: number;
  services: Array<{ id: string; quantity: number }>;
  replayed: boolean;
  message: string;
}

export interface SandboxQuoteResult {
  sandbox: true;
  nonProduction: true;
  liveMode: false;
  offerId: string;
  totalAmountMinor: number;
  currency: string;
  expiresAt?: string;
  services: Array<{ id: string; quantity: number }>;
  checkedAt: string;
  message: string;
}

export interface SandboxOrderFailure {
  state: 'FAILED' | 'UNKNOWN';
  code: SandboxFailureCode;
  message: string;
}

type SandboxOrderStored = SandboxOrderResult | SandboxOrderFailure;

export interface SandboxOrderServiceOptions {
  adapterFactory?: () => FlightsDuffelAdapter;
  unitOfWork?: ReadinessUnitOfWork;
  now?: () => number;
}

const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'dr']);
const SAFE_NAME = /^[\p{L}][\p{L}\p{M}' .-]{0,79}$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9 ()-]{7,24}$/;
const IATA = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const OFFER_REF = /^off_[A-Za-z0-9_]{4,200}$/;
const PASSENGER_REF = /^pas_[A-Za-z0-9_]{1,200}$/;
const SERVICE_REF = /^(?:ase|svc|sea)_[A-Za-z0-9_]{1,200}$/;

function fail(code: SandboxFailureCode, status: number, message: string, retryable = false): never {
  throw new DuffelSandboxError(code, status, message, retryable);
}

function safeText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function isFutureOrToday(value: string, now: number): boolean {
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time)) return false;
  const today = new Date(now).toISOString().slice(0, 10);
  return value >= today;
}

function mapDuffelFailure(error: DuffelApiError): DuffelSandboxError {
  if (error.code === 'offer_expired') {
    return new DuffelSandboxError('SANDBOX_OFFER_EXPIRED', 409, 'This Duffel TEST MODE offer has expired. Run a fresh search.');
  }
  if (error.code === 'price_changed') {
    return new DuffelSandboxError('SANDBOX_PRICE_CHANGED', 409, 'The Duffel TEST MODE fare changed. Revalidate and confirm the new sandbox quote.');
  }
  if (error.code === 'offer_no_longer_available' || error.code === 'duplicate_booking') {
    return new DuffelSandboxError('SANDBOX_OFFER_UNAVAILABLE', 409, 'This Duffel TEST MODE offer is no longer available.');
  }
  switch (error.category) {
    case 'AUTHENTICATION':
      return new DuffelSandboxError('SANDBOX_AUTH_FAILED', 502, error.message);
    case 'VALIDATION':
      return new DuffelSandboxError('SANDBOX_VALIDATION_FAILED', 400, error.message);
    case 'RATE_LIMIT':
      return new DuffelSandboxError('SANDBOX_RATE_LIMITED', 429, error.message, true);
    case 'NOT_FOUND':
      return new DuffelSandboxError('SANDBOX_OFFER_NOT_FOUND', 404, error.message);
    case 'CONFLICT':
      return new DuffelSandboxError('SANDBOX_OFFER_UNAVAILABLE', 409, error.message);
    case 'TIMEOUT':
    case 'NETWORK':
    case 'PROVIDER_UNAVAILABLE':
      return new DuffelSandboxError('SANDBOX_UNAVAILABLE', 503, error.message, true);
    default:
      return new DuffelSandboxError('SANDBOX_UNAVAILABLE', 502, error.message);
  }
}

function safeOrder(order: DuffelOrder, services: Array<{ id: string; quantity: number }>, replayed: boolean): SandboxOrderResult {
  const amount = Number(order.total_amount);
  return {
    sandbox: true,
    nonProduction: true,
    liveMode: false,
    orderId: order.id,
    bookingReference: order.booking_reference,
    ownerName: order.owner?.name,
    totalAmountMinor: Number.isFinite(amount) ? Math.round(amount * 100) : 0,
    currency: order.total_currency,
    createdAt: order.created_at || new Date().toISOString(),
    passengerCount: Array.isArray(order.passengers) ? order.passengers.length : 0,
    services,
    replayed,
    message: 'Duffel TEST MODE order created in the sandbox. No live ticket was issued and no payment was captured.'
  };
}

function validatePassenger(passenger: SandboxPassengerInput, now: number): void {
  if (!passenger || typeof passenger !== 'object') fail('SANDBOX_VALIDATION_FAILED', 400, 'Provide passenger details for every traveller.');
  if (!PASSENGER_REF.test(passenger.offerPassengerId || '')) fail('SANDBOX_VALIDATION_FAILED', 400, 'A valid Duffel passenger reference is required.');
  if (!TITLES.has(String(passenger.title || '').toLowerCase())) fail('SANDBOX_VALIDATION_FAILED', 400, 'Choose a valid passenger title.');
  if (!SAFE_NAME.test(passenger.givenName || '') || !SAFE_NAME.test(passenger.familyName || '')) {
    fail('SANDBOX_VALIDATION_FAILED', 400, 'Enter a valid given name and family name for every passenger.');
  }
  if (!DATE.test(passenger.bornOn || '') || Date.parse(`${passenger.bornOn}T00:00:00Z`) >= now) {
    fail('SANDBOX_VALIDATION_FAILED', 400, 'Enter a valid date of birth for every passenger.');
  }
  if (!EMAIL.test(passenger.email || '')) fail('SANDBOX_VALIDATION_FAILED', 400, 'Enter a valid contact email.');
  if (!PHONE.test(passenger.phoneNumber || '')) fail('SANDBOX_VALIDATION_FAILED', 400, 'Enter a valid contact phone number.');
  if (!['M', 'F'].includes(passenger.gender)) fail('SANDBOX_VALIDATION_FAILED', 400, 'Choose a gender for every passenger.');
}

export class DuffelSandboxService {
  private readonly adapterFactory: () => FlightsDuffelAdapter;
  private readonly unitOfWork: ReadinessUnitOfWork;
  private readonly now: () => number;
  private adapterInstance?: FlightsDuffelAdapter;

  constructor(options: SandboxOrderServiceOptions = {}) {
    this.adapterFactory = options.adapterFactory || (() => new FlightsDuffelAdapter({ enableTestMode: true }));
    this.unitOfWork = options.unitOfWork || new MemoryReadinessUnitOfWork();
    this.now = options.now || (() => Date.now());
  }

  private adapter(): FlightsDuffelAdapter {
    if (!this.adapterInstance) this.adapterInstance = this.adapterFactory();
    return this.adapterInstance;
  }

  public status(): DuffelTestModeState & { orderEndpoint: string; seatMaps: boolean; orders: boolean } {
    const state = getDuffelSandboxRuntimeStatus();
    return {
      ...state,
      orderEndpoint: '/api/v1/flights/sandbox/orders',
      seatMaps: state.enabled,
      orders: state.enabled
    };
  }

  private assertEnabled(): void {
    if (!isDuffelSandboxRuntimeEnabled()) {
      fail('SANDBOX_DISABLED', 503, 'Duffel TEST MODE is not enabled on this server.');
    }
  }

  public async search(input: SandboxSearchInput): Promise<{ offers: CanonicalOfferEntity[]; offerRequestId?: string }> {
    this.assertEnabled();
    const origin = safeText(input.origin, 3).toUpperCase();
    const destination = safeText(input.destination, 3).toUpperCase();
    if (!IATA.test(origin) || !IATA.test(destination) || origin === destination) {
      fail('SANDBOX_VALIDATION_FAILED', 400, 'Enter valid, different three-letter airport codes.');
    }
    if (!DATE.test(input.departureDate || '') || !isFutureOrToday(input.departureDate, this.now())) {
      fail('SANDBOX_VALIDATION_FAILED', 400, 'Choose a current or future departure date.');
    }
    const tripType = input.tripType || (input.returnDate ? 'round_trip' : 'one_way');
    if (tripType === 'round_trip') {
      if (!input.returnDate || !DATE.test(input.returnDate) || input.returnDate < input.departureDate) {
        fail('SANDBOX_VALIDATION_FAILED', 400, 'Choose a valid return date that follows departure.');
      }
    }
    const adults = Number(input.adults ?? 1);
    const children = Number(input.children ?? 0);
    const infants = Number(input.infants ?? 0);
    if (![adults, children, infants].every(Number.isSafeInteger) || adults < 1 || children < 0 || infants < 0 ||
      adults + children + infants > 9 || infants > adults) {
      fail('SANDBOX_VALIDATION_FAILED', 400, 'Choose a valid travel party (1-9 travellers).');
    }
    const cabin = ['economy', 'premium_economy', 'business', 'first'].includes(String(input.cabinClass))
      ? String(input.cabinClass)
      : 'economy';

    const slices = [{ origin, destination, departureDate: input.departureDate }];
    if (tripType === 'round_trip' && input.returnDate) {
      slices.push({ origin: destination, destination: origin, departureDate: input.returnDate });
    }

    const criteria: SearchQueryCriteria = {
      productType: 'flights',
      origin,
      destination,
      departureDate: input.departureDate,
      returnDate: input.returnDate,
      adults,
      children,
      infants,
      cabinClass: cabin,
      tripType,
      slices,
      currency: input.currency || 'USD',
      channel: 'B2C'
    };

    const offers = await this.adapter().search(criteria);
    if (offers.length === 0) {
      const error = this.adapter().getLastSearchError();
      if (error) {
        if (error.code === 'DUFFEL_TEST_MODE_DISABLED') fail('SANDBOX_DISABLED', 503, error.message);
        if (error.code === 'LIVE_MODE_BLOCKED') fail('SANDBOX_OFFER_UNAVAILABLE', 502, error.message);
        if (error.category === 'AUTHENTICATION') fail('SANDBOX_AUTH_FAILED', 502, error.message);
        if (error.category === 'VALIDATION') fail('SANDBOX_VALIDATION_FAILED', 400, error.message);
        if (error.category === 'RATE_LIMIT') fail('SANDBOX_RATE_LIMITED', 429, error.message, true);
        if (error.category === 'CONFLICT') fail('SANDBOX_OFFER_UNAVAILABLE', 409, error.message);
        if (error.category === 'NOT_FOUND') fail('SANDBOX_OFFER_NOT_FOUND', 404, error.message);
        fail('SANDBOX_UNAVAILABLE', 502, error.message, true);
      }
    }
    return { offers, offerRequestId: this.adapter().getLastOfferRequestId() };
  }

  public async getOffer(offerId: string, supplierOfferId?: string): Promise<CanonicalOfferEntity> {
    this.assertEnabled();
    if (!offerId || offerId.length > 300) fail('SANDBOX_OFFER_NOT_FOUND', 404, 'This sandbox offer was not found.');
    const adapter = this.adapter();
    let offer = adapter.getOffer(offerId);
    if (!offer) {
      try {
        offer = await adapter.fetchOfferFromSupplier(this.resolveRef(offerId, supplierOfferId)) || undefined;
      } catch (error) {
        if (error instanceof DuffelApiError) throw mapDuffelFailure(error);
        throw new DuffelSandboxError('SANDBOX_UNAVAILABLE', 502, 'The Duffel TEST MODE offer could not be loaded.');
      }
    }
    if (!offer || !this.isSandboxOffer(offer)) {
      fail('SANDBOX_OFFER_NOT_FOUND', 404, 'This sandbox offer was not found. Search Duffel TEST MODE again.');
    }
    return offer;
  }

  public async revalidate(offerId: string, supplierOfferId?: string): Promise<RevalidationResult> {
    this.assertEnabled();
    const adapter = this.adapter();
    if (!adapter.getOffer(offerId) && !supplierOfferId) {
      // Attempt an on-demand fetch so a page reload can still revalidate.
      await this.getOffer(offerId);
    }
    try {
      return await adapter.revalidate(this.resolveRef(offerId, supplierOfferId));
    } catch (error) {
      if (error instanceof DuffelApiError) throw mapDuffelFailure(error);
      return {
        offerId,
        status: 'RECHECK_REQUIRED',
        message: 'Duffel TEST MODE revalidation could not be completed.'
      };
    }
  }

  public async seatMaps(offerId: string, supplierOfferId?: string): Promise<Array<Record<string, unknown>>> {
    this.assertEnabled();
    const adapter = this.adapter();
    let maps;
    try {
      maps = await adapter.fetchSeatMaps(this.resolveRef(offerId, supplierOfferId));
    } catch (error) {
      if (error instanceof DuffelApiError) throw mapDuffelFailure(error);
      throw new DuffelSandboxError('SANDBOX_UNAVAILABLE', 502, 'Duffel TEST MODE seat maps could not be loaded.', true);
    }
    if (!maps.length) return [];
    return maps.slice(0, 8).map(map => ({
      id: map.id,
      segmentId: map.segment_id,
      sliceId: map.slice_id,
      cabins: (map.cabins || []).slice(0, 4).map(cabin => ({
        deck: cabin.deck,
        aisles: cabin.aisles,
        rows: (cabin.rows || []).slice(0, 80).map(row => ({
          sections: (row.sections || []).map(section => ({
            elements: (section.elements || []).slice(0, 12).map(element => ({
              type: element.type,
              designator: element.designator,
              name: element.name,
              disclosures: element.disclosures || [],
              services: (element.available_services || []).map(service => ({
                id: service.id,
                passengerId: service.passenger_id,
                amountMinor: Math.round(Number(service.total_amount) * 100),
                currency: service.total_currency
              }))
            }))
          }))
        }))
      }))
    }));
  }

  /**
   * Re-prices a sandbox offer with the intended services without creating an
   * order. The review step uses this authoritative total before the explicit
   * order confirmation.
   */
  public async quote(input: {
    offerId: string;
    supplierOfferId?: string;
    services?: Array<{ id: string; quantity: number }>;
  }): Promise<SandboxQuoteResult> {
    this.assertEnabled();
    const offerId = safeText(input.offerId, 300);
    if (!offerId) fail('SANDBOX_VALIDATION_FAILED', 400, 'Choose a Duffel TEST MODE offer.');
    const services = Array.isArray(input.services)
      ? input.services.map(service => ({
          id: safeText(service?.id, 200),
          quantity: Number(service?.quantity ?? 1)
        }))
      : [];
    if (services.some(service => !SERVICE_REF.test(service.id) || !Number.isSafeInteger(service.quantity) || service.quantity < 1 || service.quantity > 9)) {
      fail('SANDBOX_VALIDATION_FAILED', 400, 'Choose valid optional services and quantities.');
    }
    if (new Set(services.map(service => service.id)).size !== services.length) {
      fail('SANDBOX_VALIDATION_FAILED', 400, 'Each optional service may be selected only once.');
    }
    const supplierOfferId = this.resolveSupplierRef(offerId, input.supplierOfferId);
    if (!OFFER_REF.test(supplierOfferId)) {
      fail('SANDBOX_OFFER_NOT_FOUND', 404, 'This sandbox offer reference is invalid. Search Duffel TEST MODE again.');
    }
    let prepared;
    try {
      prepared = await this.adapter().prepareSandboxOrder(offerId, services);
    } catch (error) {
      if (error instanceof DuffelApiError) throw mapDuffelFailure(error);
      throw new DuffelSandboxError('SANDBOX_UNAVAILABLE', 502, 'The Duffel TEST MODE quote could not be refreshed.', true);
    }
    if (!prepared) fail('SANDBOX_OFFER_NOT_FOUND', 404, 'This Duffel TEST MODE offer could not be re-priced.');
    if (prepared.liveMode !== false) {
      fail('SANDBOX_OFFER_UNAVAILABLE', 502, 'Duffel returned live inventory. TEST MODE refuses to quote it.');
    }
    if (prepared.expiresAt && Date.parse(prepared.expiresAt) <= this.now()) {
      fail('SANDBOX_OFFER_EXPIRED', 409, 'This Duffel TEST MODE offer has expired. Run a fresh search.');
    }
    return {
      sandbox: true,
      nonProduction: true,
      liveMode: false,
      offerId,
      totalAmountMinor: prepared.totalMinor,
      currency: prepared.currency,
      expiresAt: prepared.expiresAt,
      services,
      checkedAt: new Date(this.now()).toISOString(),
      message: 'Duffel TEST MODE quote refreshed. No seat hold, live ticket or payment has been created.'
    };
  }

  /**
   * Creates an explicit Duffel TEST MODE order. The idempotency claim is written
   * before the provider call and the sanitized result under a separate immutable
   * key afterwards. A retry of an in-flight or unknown outcome is never sent to
   * Duffel again.
   */
  public async createOrder(input: SandboxOrderInput, ownerId: string, idempotencyKey: string): Promise<SandboxOrderResult> {
    this.assertEnabled();
    if (!ownerId || ownerId.length > 200) fail('SANDBOX_VALIDATION_FAILED', 400, 'A travel session is required for a sandbox order.');
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      fail('SANDBOX_VALIDATION_FAILED', 400, 'A sandbox order request reference is required.');
    }
    const offerId = safeText(input.offerId, 300);
    if (!offerId) fail('SANDBOX_VALIDATION_FAILED', 400, 'Choose a Duffel TEST MODE offer.');
    if (!Array.isArray(input.passengers) || input.passengers.length < 1 || input.passengers.length > 9) {
      fail('SANDBOX_VALIDATION_FAILED', 400, 'Provide passenger details for every traveller.');
    }
    const now = this.now();
    const passengers = input.passengers.map(passenger => ({
      offerPassengerId: safeText(passenger.offerPassengerId, 200),
      title: safeText(passenger.title, 10).toLowerCase(),
      givenName: safeText(passenger.givenName, 80),
      familyName: safeText(passenger.familyName, 80),
      bornOn: safeText(passenger.bornOn, 10),
      email: safeText(passenger.email, 200),
      phoneNumber: safeText(passenger.phoneNumber, 24),
      gender: passenger.gender
    }));
    passengers.forEach(passenger => validatePassenger(passenger, now));
    if (new Set(passengers.map(passenger => passenger.offerPassengerId)).size !== passengers.length) {
      fail('SANDBOX_VALIDATION_FAILED', 400, 'Each passenger reference may be used only once.');
    }

    const services = Array.isArray(input.services)
      ? input.services.map(service => ({
          id: safeText(service?.id, 200),
          quantity: Number(service?.quantity ?? 1)
        }))
      : [];
    if (services.some(service => !SERVICE_REF.test(service.id) || !Number.isSafeInteger(service.quantity) || service.quantity < 1 || service.quantity > 9)) {
      fail('SANDBOX_VALIDATION_FAILED', 400, 'Choose valid optional services and quantities.');
    }
    if (new Set(services.map(service => service.id)).size !== services.length) {
      fail('SANDBOX_VALIDATION_FAILED', 400, 'Each optional service may be selected only once.');
    }

    const adapter = this.adapter();
    const existing = adapter.getOffer(offerId);
    const supplierOfferId = this.resolveSupplierRef(offerId, input.supplierOfferId);
    if (!OFFER_REF.test(supplierOfferId)) {
      fail('SANDBOX_OFFER_NOT_FOUND', 404, 'This sandbox offer reference is invalid. Search Duffel TEST MODE again.');
    }

    const extension = (existing?.productExtension as { flight?: FlightProductExtension } | undefined)?.flight;
    const offerPassengerIds = new Set((extension?.passengers || []).map(passenger => passenger.passengerId));
    if (offerPassengerIds.size && passengers.some(passenger => !offerPassengerIds.has(passenger.offerPassengerId))) {
      fail('SANDBOX_VALIDATION_FAILED', 400, 'Passenger references do not match the selected Duffel offer.');
    }

    // Validate offered services before touching the provider.
    const offeredServices = new Set((extension?.services || []).map(service => service.serviceId));
    const unknown = services.filter(service => !offeredServices.has(service.id));
    if (unknown.length) {
      const seatMaps = await this.seatMaps(offerId, supplierOfferId).catch(() => []);
      const seatServiceIds = new Set<string>();
      for (const map of seatMaps) {
        for (const cabin of (map.cabins as any[]) || []) {
          for (const row of cabin.rows || []) {
            for (const section of row.sections || []) {
              for (const element of section.elements || []) {
                for (const service of element.services || []) if (service?.id) seatServiceIds.add(service.id);
              }
            }
          }
        }
      }
      if (unknown.some(service => !seatServiceIds.has(service.id))) {
        fail('SANDBOX_VALIDATION_FAILED', 400, 'One or more selected services are not available for this Duffel TEST MODE offer.');
      }
    }

    // Price first (no side effects), then claim the idempotency key.
    const prepared = await adapter.prepareSandboxOrder(offerId, services);
    if (!prepared) fail('SANDBOX_OFFER_NOT_FOUND', 404, 'This Duffel TEST MODE offer could not be re-priced.');
    if (prepared.liveMode !== false) fail('SANDBOX_OFFER_UNAVAILABLE', 502, 'Duffel returned live inventory. TEST MODE refuses to create an order.');
    if (prepared.expiresAt && Date.parse(prepared.expiresAt) <= now) {
      fail('SANDBOX_OFFER_EXPIRED', 409, 'This Duffel TEST MODE offer has expired. Run a fresh search.');
    }
    const accepted = Number(input.acceptedPriceMinor);
    if (input.acceptedPriceMinor !== undefined &&
      (!Number.isSafeInteger(accepted) || accepted !== prepared.totalMinor)) {
      fail('SANDBOX_PRICE_CHANGED', 409, 'The Duffel TEST MODE price changed. Review the new sandbox quote before ordering.');
    }
    const pricedPassengerIds = new Set(prepared.passengers.map(passenger => passenger.id));
    if (pricedPassengerIds.size && passengers.some(passenger => !pricedPassengerIds.has(passenger.offerPassengerId))) {
      fail('SANDBOX_VALIDATION_FAILED', 400, 'Passenger references changed during re-pricing. Review the offer again.');
    }

    const requestHash = createHash('sha256').update(JSON.stringify({
      offerId, supplierOfferId, passengers, services, amount: prepared.totalMinor, currency: prepared.currency
    })).digest('hex');
    const keyHash = createHash('sha256').update(`${ownerId}:${idempotencyKey}`).digest('hex');
    const resultId = `idem:duffel-sandbox-order-result:${keyHash}`;
    const claimId = `idem:duffel-sandbox-order-claim:${keyHash}`;
    const timestamp = new Date(now).toISOString();

    const claim = await this.unitOfWork.transaction(async repositories => {
      const previous = await repositories.idempotency.get(resultId);
      if (previous) {
        if (previous.requestHash !== requestHash) throw new DuffelSandboxError('IDEMPOTENCY_KEY_REUSED', 409, 'This order reference was already used for different details.');
        return { state: 'REPLAY' as const, result: previous.result as SandboxOrderStored };
      }
      const inFlight = await repositories.idempotency.get(claimId);
      if (inFlight) {
        if (inFlight.requestHash !== requestHash) throw new DuffelSandboxError('IDEMPOTENCY_KEY_REUSED', 409, 'This order reference was already used for different details.');
        return { state: 'IN_FLIGHT' as const };
      }
      await repositories.idempotency.put({
        id: claimId,
        ownerId,
        createdAt: timestamp,
        updatedAt: timestamp,
        scope: 'flights.sandbox.order.claim',
        requestHash,
        result: { state: 'CLAIMED', createdAt: timestamp }
      });
      return { state: 'CLAIMED' as const };
    });

    if (claim.state === 'REPLAY') {
      const stored = claim.result;
      if ('state' in stored) {
        throw new DuffelSandboxError(stored.code, stored.code === 'SANDBOX_OUTCOME_UNKNOWN' ? 502 : 409, stored.message);
      }
      return { ...(stored as SandboxOrderResult), replayed: true };
    }
    if (claim.state === 'IN_FLIGHT') {
      throw new DuffelSandboxError('ORDER_IN_PROGRESS', 409, 'A sandbox order for this reference is already being processed. Check your order history before retrying.');
    }

    const orderInput = {
      type: 'instant' as const,
      selected_offers: [prepared.supplierOfferId],
      passengers: passengers.map(passenger => ({
        id: passenger.offerPassengerId,
        title: passenger.title,
        given_name: passenger.givenName,
        family_name: passenger.familyName,
        born_on: passenger.bornOn,
        email: passenger.email,
        phone_number: passenger.phoneNumber,
        gender: passenger.gender
      })),
      payments: [{ type: 'balance' as const, currency: prepared.currency, amount: prepared.totalAmount }],
      ...(services.length ? { services } : {}),
      metadata: {
        vacatina_environment: 'sandbox',
        vacatina_offer: offerId.slice(0, 180)
      }
    };

    let order: DuffelOrder;
    try {
      order = await adapter.createSandboxOrder(orderInput);
    } catch (error) {
      const mapped = error instanceof DuffelApiError
        ? mapDuffelFailure(error)
        : new DuffelSandboxError('SANDBOX_OUTCOME_UNKNOWN', 502, 'The Duffel sandbox order outcome is unknown. Do not retry blindly; check Duffel before creating another order.');
      const ambiguous = !(error instanceof DuffelApiError) ||
        ['TIMEOUT', 'NETWORK', 'UNKNOWN', 'PROVIDER_UNAVAILABLE'].includes(error.category);
      const stored: SandboxOrderFailure = {
        state: ambiguous ? 'UNKNOWN' : 'FAILED',
        code: ambiguous ? 'SANDBOX_OUTCOME_UNKNOWN' : mapped.code,
        message: ambiguous
          ? 'The Duffel sandbox order outcome is unknown. Do not retry blindly; check Duffel before creating another order.'
          : mapped.message
      };
      await this.unitOfWork.transaction(async repositories => {
        await repositories.idempotency.put({
          id: resultId,
          ownerId,
          createdAt: timestamp,
          updatedAt: new Date(this.now()).toISOString(),
          scope: 'flights.sandbox.order.result',
          requestHash,
          result: stored
        });
      });
      throw new DuffelSandboxError(stored.code, ambiguous ? 502 : mapped.status, stored.message, false);
    }

    if (order.live_mode !== false) {
      // A live order must never be represented as a sandbox order. Refuse to
      // return provider details and leave the claim immutable for investigation.
      throw new DuffelSandboxError('SANDBOX_OFFER_UNAVAILABLE', 502, 'Duffel returned a live-mode order. It cannot be represented as a sandbox result.');
    }

    const result = safeOrder(order, services, false);
    await this.unitOfWork.transaction(async repositories => {
      await repositories.idempotency.put({
        id: resultId,
        ownerId,
        createdAt: timestamp,
        updatedAt: new Date(this.now()).toISOString(),
        scope: 'flights.sandbox.order.result',
        requestHash,
        result
      });
    });
    return result;
  }

  private isSandboxOffer(offer: CanonicalOfferEntity): boolean {
    return offer.environmentClass === 'SANDBOX' && offer.isSandboxSimulated === true &&
      Boolean((offer.productExtension as any)?.flight?.testMode?.enabled);
  }

  private resolveSupplierRef(offerId: string, supplied?: string): string {
    const adapter = this.adapter();
    const resolved = adapter.resolveSupplierOfferId(offerId);
    if (resolved) return resolved;
    const candidate = safeText(supplied, 200);
    return OFFER_REF.test(candidate) ? candidate : '';
  }

  private resolveRef(offerId: string, supplied?: string): string {
    const resolved = this.resolveSupplierRef(offerId, supplied);
    return resolved || offerId;
  }
}

let globalSandboxService: DuffelSandboxService | undefined;

export function getDuffelSandboxService(): DuffelSandboxService {
  if (!globalSandboxService) globalSandboxService = new DuffelSandboxService();
  return globalSandboxService;
}

/** Test-only hook: replaces the process singleton with a deterministic instance. */
export function setDuffelSandboxServiceForTests(service: DuffelSandboxService | undefined): void {
  globalSandboxService = service;
}
