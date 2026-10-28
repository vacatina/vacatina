/* ============================================================================
 * Vacatina Duffel API Client (server-only)
 * Authority: https://duffel.com/docs/api/overview/welcome (Duffel API v2)
 *
 * This client is the ONLY place that knows Duffel HTTP details. It never
 * returns raw provider error bodies to callers, never logs the access token,
 * and is constructed exclusively on the server. Test-mode resources must
 * expose live_mode = false; callers assert this before creating an order.
 * ============================================================================ */

export const DUFFEL_API_BASE_URL = 'https://api.duffel.com';
export const DUFFEL_API_VERSION = 'v2';

export type DuffelErrorCategory =
  | 'AUTHENTICATION'
  | 'VALIDATION'
  | 'RATE_LIMIT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PROVIDER_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'UNKNOWN';

const SAFE_MESSAGES: Record<DuffelErrorCategory, string> = {
  AUTHENTICATION: 'Duffel test credentials were rejected. Verify the sandbox token.',
  VALIDATION: 'Duffel rejected the request as invalid.',
  RATE_LIMIT: 'Duffel rate limit reached. Try again shortly.',
  NOT_FOUND: 'The Duffel offer or order could not be found.',
  CONFLICT: 'The Duffel offer is no longer available in its current state.',
  PROVIDER_UNAVAILABLE: 'Duffel is temporarily unavailable.',
  TIMEOUT: 'Duffel did not respond in time.',
  NETWORK: 'Duffel could not be reached from the server.',
  UNKNOWN: 'The Duffel request could not be completed.'
};

/**
 * Sanitised Duffel failure. `code`/`type` are provider identifiers useful for
 * server-side mapping; `message` is always a safe Vacatina-authored string.
 */
export class DuffelApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly type: string;
  public readonly category: DuffelErrorCategory;
  public readonly retryable: boolean;
  /** Server-only diagnostic field path. Never serialise this to the browser. */
  public readonly pointer?: string;
  /** Server-only diagnostic parameter name. Never serialise this to the browser. */
  public readonly parameter?: string;

  constructor(input: {
    status: number;
    code?: string;
    type?: string;
    category?: DuffelErrorCategory;
    retryable?: boolean;
    pointer?: string;
    parameter?: string;
  }) {
    const category = input.category || DuffelApiError.categoryFor(input.status, input.type, input.code);
    super(SAFE_MESSAGES[category]);
    this.name = 'DuffelApiError';
    this.status = input.status;
    this.code = input.code || 'duffel_error';
    this.type = input.type || 'api_error';
    this.category = category;
    this.retryable = input.retryable ?? (category === 'RATE_LIMIT' || category === 'PROVIDER_UNAVAILABLE' || category === 'TIMEOUT' || category === 'NETWORK');
    this.pointer = input.pointer;
    this.parameter = input.parameter;
  }

  static categoryFor(status: number, type?: string, code?: string): DuffelErrorCategory {
    if (type === 'authentication_error' || status === 401 || status === 403) return 'AUTHENTICATION';
    if (type === 'rate_limit_error' || status === 429) return 'RATE_LIMIT';
    if (type === 'validation_error' || type === 'invalid_request_error') return 'VALIDATION';
    if (status === 404) return 'NOT_FOUND';
    if (type === 'invalid_state_error' || status === 409) return 'CONFLICT';
    if (code === 'offer_expired' || code === 'offer_no_longer_available' || code === 'price_changed' || code === 'duplicate_booking') return 'CONFLICT';
    if (type === 'airline_error' && status === 422) return 'CONFLICT';
    if (status >= 500) return 'PROVIDER_UNAVAILABLE';
    if (status === 422) return 'VALIDATION';
    return 'UNKNOWN';
  }
}

export interface DuffelRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
}

export interface DuffelResponse<T> {
  data: T;
  status: number;
  meta?: Record<string, unknown>;
}

export interface DuffelOfferRequestInput {
  slices: Array<{ origin: string; destination: string; departure_date: string }>;
  passengers: Array<{ type: 'adult' } | { type: 'child'; age: number } | { type: 'infant_without_seat'; age: number }>;
  cabin_class?: 'economy' | 'premium_economy' | 'business' | 'first';
  supplier_timeout?: number;
}

export interface DuffelOfferRequestResult {
  id: string;
  live_mode: boolean;
  offers: DuffelOffer[];
  created_at?: string;
}

export interface DuffelAirport {
  id?: string;
  iata_code?: string;
  iata_city_code?: string;
  city_name?: string;
  name?: string;
  time_zone?: string;
  iata_country_code?: string;
}

export interface DuffelCarrier {
  id?: string;
  iata_code?: string;
  name?: string;
}

export interface DuffelBaggage {
  type: string;
  quantity: number;
}

export interface DuffelSegmentPassenger {
  passenger_id?: string;
  cabin_class?: 'economy' | 'premium_economy' | 'business' | 'first';
  cabin_class_marketing_name?: string;
  fare_basis_code?: string;
  baggages?: DuffelBaggage[];
}

export interface DuffelSegment {
  id?: string;
  origin: DuffelAirport;
  destination: DuffelAirport;
  origin_terminal?: string;
  destination_terminal?: string;
  departing_at: string;
  arriving_at: string;
  duration?: string;
  marketing_carrier: DuffelCarrier;
  marketing_carrier_flight_number: string;
  operating_carrier?: DuffelCarrier;
  operating_carrier_flight_number?: string;
  aircraft?: { name?: string; iata_code?: string };
  passengers?: DuffelSegmentPassenger[];
}

export interface DuffelSlice {
  id?: string;
  origin: DuffelAirport;
  destination: DuffelAirport;
  departing_at: string;
  arriving_at: string;
  duration?: string;
  fare_brand_name?: string;
  segments: DuffelSegment[];
}

export interface DuffelService {
  id: string;
  type: string;
  total_amount: string;
  total_currency: string;
  maximum_quantity?: number;
  passenger_ids?: string[];
  segment_ids?: string[];
  metadata?: Record<string, unknown>;
}

export interface DuffelConditions {
  refund_before_departure?: { allowed: boolean; penalty_amount?: string; penalty_currency?: string };
  change_before_departure?: { allowed: boolean; penalty_amount?: string; penalty_currency?: string };
}

export interface DuffelOfferPassenger {
  id: string;
  type: 'adult' | 'child' | 'infant_without_seat';
  given_name?: string;
  family_name?: string;
  age?: number;
}

export interface DuffelOffer {
  id: string;
  live_mode: boolean;
  total_amount: string;
  total_currency: string;
  base_amount?: string;
  base_currency?: string;
  tax_amount?: string | null;
  tax_currency?: string | null;
  created_at?: string;
  expires_at?: string;
  owner?: DuffelCarrier;
  slices: DuffelSlice[];
  passengers?: DuffelOfferPassenger[];
  available_services?: DuffelService[];
  conditions?: DuffelConditions;
  payment_requirements?: {
    requires_instant_payment?: boolean;
    price_guarantee_expires_at?: string;
    payment_required_by?: string;
  };
  passenger_identity_documents_required?: boolean;
  supported_passenger_identity_document_types?: string[];
}

export interface DuffelOrderPassengerInput {
  id: string;
  title: string;
  given_name: string;
  family_name: string;
  born_on: string;
  email: string;
  phone_number: string;
  gender?: 'M' | 'F';
}

export interface DuffelOrderServiceInput {
  id: string;
  quantity: number;
}

export interface DuffelCreateOrderInput {
  type: 'instant';
  selected_offers: string[];
  passengers: DuffelOrderPassengerInput[];
  payments: Array<{ type: 'balance'; currency: string; amount: string }>;
  services?: DuffelOrderServiceInput[];
  metadata?: Record<string, string>;
}

export interface DuffelOrder {
  id: string;
  live_mode: boolean;
  type?: string;
  total_amount: string;
  total_currency: string;
  created_at?: string;
  booking_reference?: string;
  owner?: DuffelCarrier;
  passengers?: Array<Record<string, unknown>>;
  slices?: Array<Record<string, unknown>>;
  available_actions?: string[];
  cancelled_at?: string | null;
}

export interface DuffelSeatElement {
  type: string;
  designator?: string;
  name?: string;
  disclosures?: string[];
  available_services?: Array<{
    id: string;
    passenger_id: string;
    total_amount: string;
    total_currency: string;
  }>;
}

export interface DuffelSeatMap {
  id: string;
  segment_id: string;
  slice_id: string;
  cabins: Array<{
    id?: string;
    deck?: number;
    aisles?: number;
    rows: Array<{ sections: Array<{ elements: DuffelSeatElement[] }> }>;
  }>;
}

export interface DuffelClientOptions {
  accessToken: string;
  baseUrl?: string;
  timeoutMs?: number;
  orderTimeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readProviderError(payload: unknown): { type?: string; code?: string; pointer?: string; parameter?: string } {
  if (!isRecord(payload)) return {};
  const errors = payload.errors;
  if (!Array.isArray(errors) || !errors.length || !isRecord(errors[0])) return {};
  const first = errors[0];
  const source = isRecord(first.source) ? first.source : undefined;
  return {
    type: typeof first.type === 'string' ? first.type : undefined,
    code: typeof first.code === 'string' ? first.code : undefined,
    pointer: typeof source?.pointer === 'string' ? source.pointer : undefined,
    parameter: typeof source?.parameter === 'string' ? source.parameter : undefined
  };
}

export class DuffelClient {
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly orderTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: DuffelClientOptions) {
    if (!options.accessToken || !options.accessToken.startsWith('duffel_test_')) {
      throw new DuffelApiError({ status: 401, type: 'authentication_error', code: 'test_token_required', category: 'AUTHENTICATION' });
    }
    this.accessToken = options.accessToken;
    this.baseUrl = (options.baseUrl || DUFFEL_API_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.orderTimeoutMs = options.orderTimeoutMs ?? 180_000;
    this.fetchImpl = options.fetchImpl || globalThis.fetch.bind(globalThis);
  }

  public async createOfferRequest(input: DuffelOfferRequestInput): Promise<DuffelResponse<DuffelOfferRequestResult>> {
    return this.request<DuffelOfferRequestResult>('/air/offer_requests?return_offers=true', {
      method: 'POST',
      body: {
        data: {
          slices: input.slices,
          passengers: input.passengers,
          ...(input.cabin_class ? { cabin_class: input.cabin_class } : {}),
          ...(input.supplier_timeout ? { supplier_timeout: input.supplier_timeout } : {})
        }
      }
    });
  }

  public async getOffer(offerId: string, returnAvailableServices = true): Promise<DuffelResponse<DuffelOffer>> {
    if (!/^off_[A-Za-z0-9_]+$/.test(offerId)) {
      throw new DuffelApiError({ status: 400, type: 'invalid_request_error', code: 'invalid_offer_id', category: 'VALIDATION' });
    }
    const query = returnAvailableServices ? '?return_available_services=true' : '';
    return this.request<DuffelOffer>(`/air/offers/${encodeURIComponent(offerId)}${query}`);
  }

  /** Official price action: prices the offer with intended payment method/services. */
  public async priceOffer(
    offerId: string,
    input: { currency: string; services?: DuffelOrderServiceInput[] }
  ): Promise<DuffelResponse<DuffelOffer>> {
    if (!/^off_[A-Za-z0-9_]+$/.test(offerId)) {
      throw new DuffelApiError({ status: 400, type: 'invalid_request_error', code: 'invalid_offer_id', category: 'VALIDATION' });
    }
    return this.request<DuffelOffer>(`/air/offers/${encodeURIComponent(offerId)}/actions/price`, {
      method: 'POST',
      body: {
        data: {
          intended_payment_methods: [{ type: 'balance', currency: input.currency }],
          intended_services: input.services || []
        }
      }
    });
  }

  public async getSeatMaps(offerId: string): Promise<DuffelResponse<DuffelSeatMap[]>> {
    if (!/^off_[A-Za-z0-9_]+$/.test(offerId)) {
      throw new DuffelApiError({ status: 400, type: 'invalid_request_error', code: 'invalid_offer_id', category: 'VALIDATION' });
    }
    return this.request<DuffelSeatMap[]>(`/air/seat_maps?offer_id=${encodeURIComponent(offerId)}`);
  }

  /**
   * Creates a test-mode order. The caller must already have asserted that the
   * offer is live_mode=false and re-fetched its final price. Order calls use a
   * long timeout and are never automatically retried.
   */
  public async createOrder(input: DuffelCreateOrderInput): Promise<DuffelResponse<DuffelOrder>> {
    return this.request<DuffelOrder>('/air/orders', {
      method: 'POST',
      body: { data: input },
      timeoutMs: this.orderTimeoutMs
    });
  }

  public async getOrder(orderId: string): Promise<DuffelResponse<DuffelOrder>> {
    if (!/^ord_[A-Za-z0-9_]+$/.test(orderId)) {
      throw new DuffelApiError({ status: 400, type: 'invalid_request_error', code: 'invalid_order_id', category: 'VALIDATION' });
    }
    return this.request<DuffelOrder>(`/air/orders/${encodeURIComponent(orderId)}`);
  }

  private async request<T>(path: string, options: DuffelRequestOptions = {}): Promise<DuffelResponse<T>> {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: options.method || 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Duffel-Version': DUFFEL_API_VERSION,
          Accept: 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });
    } catch (error) {
      const aborted = (error as { name?: string })?.name === 'AbortError';
      throw new DuffelApiError({
        status: 0,
        type: aborted ? 'timeout' : 'network_error',
        code: aborted ? 'timeout' : 'network_error',
        category: aborted ? 'TIMEOUT' : 'NETWORK'
      });
    } finally {
      clearTimeout(timer);
    }

    let payload: unknown;
    const text = await response.text().catch(() => '');
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = undefined;
      }
    }

    if (!response.ok) {
      const provider = readProviderError(payload);
      throw new DuffelApiError({
        status: response.status,
        type: provider.type,
        code: provider.code,
        pointer: provider.pointer,
        parameter: provider.parameter
      });
    }

    if (!isRecord(payload) || !('data' in payload)) {
      throw new DuffelApiError({ status: response.status, type: 'invalid_response', code: 'invalid_response', category: 'UNKNOWN' });
    }

    return {
      data: (payload as { data: T }).data,
      status: response.status,
      meta: isRecord((payload as { meta?: unknown }).meta)
        ? ((payload as { meta: Record<string, unknown> }).meta)
        : undefined
    };
  }
}
