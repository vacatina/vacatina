/* ============================================================================
 * Vacatina Server API Router & HTTP Request Dispatcher
 * Authority: docs/11_PRODUCTION_IMPLEMENTATION_CHARTER.md, ADR-001 & ADR-002
 * Implements RFC 7807 Problem Details and Web-Standard Request/Response APIs.
 * ============================================================================ */

import { globalStorageEngine, type VacatinaStorageEngine } from '../db/storage.ts';
import { AuthorizationEngine, type SecurityContext } from '../auth/rbac.ts';
import { globalBookingSagaService, type BookingSagaService } from '../services/booking-saga.service.ts';
import { globalPaymentGatewayService, type PaymentGatewayService } from '../services/payment-gateway.service.ts';
import { searchAggregatorService } from '../../lib/services/search-aggregator.service.ts';
import { manualInventoryService } from '../../lib/services/manual-inventory.service.ts';
import { globalUnifiedInventory } from '../inventory/unified-inventory.service.ts';

export interface ApiProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  invalidParams?: Array<{ name: string; reason: string }>;
}

export function createProblemResponse(
  status: number,
  title: string,
  detail: string,
  instance: string,
  code: string
): Response {
  const body: ApiProblemDetails = {
    type: `https://vacatina.com/errors/${code.toLowerCase().replace(/_/g, '-')}`,
    title,
    status,
    detail,
    instance,
    code
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/problem+json' }
  });
}

export function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export class VacatinaApiRouter {
  private storage: VacatinaStorageEngine;
  private sagaService: BookingSagaService;
  private paymentService: PaymentGatewayService;

  constructor(
    storage: VacatinaStorageEngine = globalStorageEngine,
    sagaService: BookingSagaService = globalBookingSagaService,
    paymentService: PaymentGatewayService = globalPaymentGatewayService
  ) {
    this.storage = storage;
    this.sagaService = sagaService;
    this.paymentService = paymentService;
  }

  /**
   * Dispatches incoming web-standard HTTP Request to appropriate domain route handler.
   */
  public async handleRequest(request: Request, securityContext?: SecurityContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    try {
      // ----------------------------------------------------------------------
      // 1. Health & Readiness Probe
      // ----------------------------------------------------------------------
      if (path === '/api/v1/health') {
        return createJsonResponse({
          status: 'HEALTHY',
          version: '1.0.0',
          timestamp: new Date().toISOString()
        });
      }

      // ----------------------------------------------------------------------
      // 1b. Supplier Inventory Health: GET /api/v1/inventory/health
      // ----------------------------------------------------------------------
      if (path === '/api/v1/inventory/health' && method === 'GET') {
        return createJsonResponse({
          status: 'OK',
          suppliers: globalUnifiedInventory.getSupplierHealth(),
          timestamp: new Date().toISOString()
        });
      }

      // ----------------------------------------------------------------------
      // 2. Search & Aggregation: POST /api/v1/search/:product
      // ----------------------------------------------------------------------
      if (path.startsWith('/api/v1/search/') && method === 'POST') {
        const productType = path.replace('/api/v1/search/', '') as any;
        const body = await request.json().catch(() => ({}));
        
        // Execute search across Unified Inventory Engine
        const unifiedOffers = await globalUnifiedInventory.search({
          productType,
          destination: body.destination || 'Dubai',
          origin: body.origin,
          departureDate: body.departureDate,
          cabinClass: body.cabinClass,
          currency: body.currency
        });

        // If unified inventory yields offers, return canonical offers
        if (unifiedOffers.length > 0) {
          return createJsonResponse({
            productType,
            totalResults: unifiedOffers.length,
            offers: unifiedOffers
          });
        }

        // Fallback to in-memory aggregator if no external adapter responded
        const fallbackResults = searchAggregatorService.search({
          productType,
          destination: body.destination,
          origin: body.origin,
          dates: body.dates,
          passengers: body.passengers
        });

        return createJsonResponse({
          productType,
          totalResults: fallbackResults.length,
          offers: fallbackResults
        });
      }

      // ----------------------------------------------------------------------
      // 3. Offer Revalidation: POST /api/v1/offers/:id/revalidate
      // ----------------------------------------------------------------------
      if (path.startsWith('/api/v1/offers/') && path.endsWith('/revalidate') && method === 'POST') {
        const offerId = path.split('/')[4];
        const reval = await globalUnifiedInventory.revalidateOffer(offerId);
        return createJsonResponse({
          offerId,
          status: reval.status,
          priceChanged: reval.status === 'PRICE_CHANGED',
          currentPrice: reval.newPriceMinor,
          previousPrice: reval.previousPriceMinor,
          message: reval.message,
          checkedAt: new Date().toISOString()
        });
      }

      // ----------------------------------------------------------------------
      // 4. Trip Bucket Operations: /api/v1/trip-buckets
      // ----------------------------------------------------------------------
      if (path === '/api/v1/trip-buckets' && method === 'GET') {
        const sessionId = url.searchParams.get('sessionId') || 'anon_session';
        const bucket = this.storage.getOrCreateTripBucket(sessionId, securityContext?.userId, securityContext?.organizationId);
        const items = this.storage.getTripBucketItems(bucket.id);
        const readyItems = items.filter(i => i.state === 'READY');
        const readySubtotalMinor = readyItems.reduce((acc, i) => acc + i.unitSellingPriceMinor, 0);

        return createJsonResponse({
          bucketId: bucket.id,
          currency: bucket.currency,
          totalItems: items.length,
          readyCount: readyItems.length,
          needsActionCount: items.length - readyItems.length,
          readySubtotalMinor,
          items
        });
      }

      if (path === '/api/v1/trip-buckets/items' && method === 'POST') {
        const body = await request.json();
        const sessionId = body.sessionId || 'anon_session';
        const bucket = this.storage.getOrCreateTripBucket(sessionId, securityContext?.userId, securityContext?.organizationId);

        // Strict Seed Guard: Seed items stage as DRAFT and cannot be pre-set to READY
        const isSeed = body.sourceType === 'SEED';
        const initialStatus = isSeed ? 'DRAFT' : (body.state || 'DRAFT');

        const item = this.storage.addTripBucketItem({
          tripBucketId: bucket.id,
          canonicalOfferId: body.canonicalOfferId,
          productType: body.productType,
          sourceType: body.sourceType || 'API',
          bookingMode: body.bookingMode || 'INSTANT_BOOK',
          title: body.title || 'Travel Reservation',
          configuration: body.configuration || {},
          travellerManifest: body.travellerManifest || {},
          unitSellingPriceMinor: body.unitSellingPriceMinor || 0,
          currency: body.currency || 'LKR',
          state: initialStatus
        });

        return createJsonResponse({ success: true, item }, 201);
      }

      // ----------------------------------------------------------------------
      // 5. Booking Saga Execution: POST /api/v1/bookings
      // ----------------------------------------------------------------------
      if (path === '/api/v1/bookings' && method === 'POST') {
        const body = await request.json();
        const idempotencyKey = request.headers.get('x-idempotency-key') || body.idempotencyKey;
        if (!idempotencyKey) {
          return createProblemResponse(400, 'Idempotency Key Required', 'Header x-idempotency-key is required for booking saga commands', path, 'IDEMPOTENCY_KEY_MISSING');
        }

        const sagaResult = await this.sagaService.executeBookingSaga({
          tripBucketId: body.tripBucketId,
          userId: securityContext?.userId,
          organizationId: securityContext?.organizationId,
          checkoutSessionId: body.checkoutSessionId || 'cs_test_session',
          customerEmail: body.customerEmail || 'traveler@example.com',
          customerName: body.customerName || 'Valued Traveler',
          idempotencyKey
        });

        return createJsonResponse(sagaResult, 200);
      }

      // ----------------------------------------------------------------------
      // 6. Booking Lookup: GET /api/v1/bookings/:reference
      // ----------------------------------------------------------------------
      if (path.startsWith('/api/v1/bookings/') && method === 'GET') {
        const ref = path.replace('/api/v1/bookings/', '');
        const group = this.storage.getBookingGroupByReference(ref);
        if (!group) {
          return createProblemResponse(404, 'Booking Not Found', `No active booking matching reference '${ref}' was found`, path, 'BOOKING_NOT_FOUND');
        }
        const items = this.storage.getBookingItems(group.id);
        return createJsonResponse({ bookingGroup: group, items });
      }

      // ----------------------------------------------------------------------
      // 7. B2B Partner Portal Endpoints: /api/v1/partner/*
      // ----------------------------------------------------------------------
      if (path.startsWith('/api/v1/partner/')) {
        // Enforce B2B Security Context & Tenant Ownership
        if (!securityContext || !securityContext.organizationId) {
          return createProblemResponse(401, 'Unauthorized', 'Valid B2B Partner authentication required', path, 'UNAUTHORIZED_B2B');
        }

        if (path === '/api/v1/partner/dashboard' && method === 'GET') {
          const auth = AuthorizationEngine.authorizeResourceAccess(securityContext, 'agency:view_dashboard', securityContext.organizationId);
          if (!auth.allowed) return createProblemResponse(403, 'Forbidden', auth.reason!, path, 'FORBIDDEN_AGENCY_ACCESS');

          const org = this.storage.getOrganization(securityContext.organizationId);
          const clients = this.storage.getClientsByOrg(securityContext.organizationId);
          const markupRules = this.storage.getMarkupRules(securityContext.organizationId);
          const commissions = this.storage.getCommissionLedger(securityContext.organizationId);

          return createJsonResponse({
            organization: org,
            totalClients: clients.length,
            activeMarkupRules: markupRules.length,
            totalCommissionsAccruedMinor: commissions.reduce((acc, c) => acc + c.commissionAmountMinor, 0),
            clients,
            markupRules,
            commissions
          });
        }

        if (path === '/api/v1/partner/clients' && method === 'POST') {
          const auth = AuthorizationEngine.authorizeResourceAccess(securityContext, 'agency:manage_clients', securityContext.organizationId);
          if (!auth.allowed) return createProblemResponse(403, 'Forbidden', auth.reason!, path, 'FORBIDDEN_CLIENT_CREATION');

          const body = await request.json();
          const client = this.storage.addClient({
            organizationId: securityContext.organizationId,
            clientType: body.clientType || 'INDIVIDUAL',
            corporateName: body.corporateName,
            primaryContactName: body.primaryContactName,
            email: body.email,
            phone: body.phone,
            creditLimitMinor: body.creditLimitMinor || 0,
            currency: body.currency || 'LKR',
            status: 'ACTIVE'
          });
          return createJsonResponse({ success: true, client }, 201);
        }
      }

      // ----------------------------------------------------------------------
      // 8. Admin Backoffice Endpoints: /api/v1/admin/*
      // ----------------------------------------------------------------------
      if (path.startsWith('/api/v1/admin/')) {
        // Enforce Admin Roles
        const isAdmin = securityContext?.role === 'PLATFORM_ADMIN' || securityContext?.role === 'FINANCE_OPS' || securityContext?.role === 'SUPPORT_STAFF';
        if (!isAdmin) {
          return createProblemResponse(403, 'Forbidden', 'Restricted to Vacatina Operations Administrators', path, 'ADMIN_ACCESS_REQUIRED');
        }

        if (path === '/api/v1/admin/triage' && method === 'GET') {
          const tickets = this.storage.getSupportTickets('OPEN');
          const auditLogs = this.storage.getAuditLogs().slice(0, 25);
          return createJsonResponse({
            openTriageQueueCount: tickets.length,
            tickets,
            recentAuditLogs: auditLogs
          });
        }

        if (path === '/api/v1/admin/listings' && method === 'GET') {
          const listings = manualInventoryService.getAllListings();
          return createJsonResponse({ totalListings: listings.length, listings });
        }
      }

      // ----------------------------------------------------------------------
      // 9. Payment & Supplier Webhooks: /webhooks/:provider
      // ----------------------------------------------------------------------
      if (path.startsWith('/webhooks/') && method === 'POST') {
        const provider = path.replace('/webhooks/', '');
        const payloadText = await request.text();
        const signature = request.headers.get('stripe-signature') || request.headers.get('x-signature') || 'sig_valid_mock';

        const webhookResult = await this.paymentService.handleWebhookEvent({
          gatewayId: provider.toUpperCase(),
          eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          eventType: 'payment_intent.succeeded',
          payloadString: payloadText,
          signatureHeader: signature
        });

        return createJsonResponse(webhookResult, 200);
      }

      // Unmatched Route
      return createProblemResponse(404, 'Endpoint Not Found', `The API endpoint '${method} ${path}' does not exist on this server`, path, 'ENDPOINT_NOT_FOUND');
    } catch (err: any) {
      return createProblemResponse(500, 'Internal Server Error', err.message || 'An unexpected server exception occurred', path, 'SERVER_EXCEPTION');
    }
  }
}

export const globalApiRouter = new VacatinaApiRouter();
