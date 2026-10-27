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
import { manualInventoryService, SeparationOfDutiesViolationError } from '../../lib/services/manual-inventory.service.ts';
import { globalUnifiedInventory } from '../inventory/unified-inventory.service.ts';
import { isSeedOffer } from '../inventory/commercial-truth.ts';
import { globalTravelCreditLedgerService } from '../../features/travel-credit/services/travel-credit-ledger.service.ts';
import { handleCustomerRoutes } from './customer-routes.ts';

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
      const customerResponse = await handleCustomerRoutes(request, securityContext, {
        storage: this.storage, saga: this.sagaService, payment: this.paymentService
      });
      if (customerResponse) return customerResponse;
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
      // 2. Search & Aggregation: POST /api/v1/search or POST /api/v1/search/:product
      // ----------------------------------------------------------------------
      if ((path === '/api/v1/search' || path.startsWith('/api/v1/search/')) && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const productType = path.startsWith('/api/v1/search/')
          ? (path.replace('/api/v1/search/', '') as any)
          : (body.productType || 'hotels');
        
        // Execute search across Unified Inventory Engine
        const unifiedOffers = await globalUnifiedInventory.search({
          productType,
          destination: body.destination || 'Dubai',
          origin: body.origin,
          departureDate: body.departureDate,
          cabinClass: body.cabinClass,
          currency: body.currency,
          channel: body.channel || 'B2C'
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
      // 2b. Offer Details Dossier: GET /api/v1/offers/:id (CAP-02)
      // ----------------------------------------------------------------------
      if (path.startsWith('/api/v1/offers/') && !path.endsWith('/revalidate') && method === 'GET') {
        const offerId = path.replace('/api/v1/offers/', '').trim();
        const offer = await globalUnifiedInventory.getOfferById(offerId);
        if (!offer) {
          return createProblemResponse(404, 'Offer Not Found', `No active canonical offer found matching identifier '${offerId}'`, path, 'OFFER_NOT_FOUND');
        }
        return createJsonResponse({
          offerId: offer.canonicalOfferId,
          offer
        });
      }

      // ----------------------------------------------------------------------
      // 3. Offer Revalidation: POST /api/v1/offers/:id/revalidate (CAP-03)
      // ----------------------------------------------------------------------
      if (path.startsWith('/api/v1/offers/') && path.endsWith('/revalidate') && method === 'POST') {
        const parts = path.split('/');
        const offerId = parts[4];
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

        const targetOfferId = body.canonicalOfferId || body.offerId || '';
        // Strict Seed Guard: Seed items stage as DRAFT and cannot be pre-set to READY
        const isSeed = body.sourceType === 'SEED';
        let initialStatus: string = isSeed ? 'DRAFT' : (body.state || 'DRAFT');

        // Commercial Truth rule: the client may NOT self-assert READY. READY must be proven by the
        // authoritative source (revalidation); anything unverifiable lands in an honest non-Ready state.
        if (initialStatus === 'READY') {
          if (!targetOfferId) {
            initialStatus = 'RECHECK_REQUIRED';
          } else {
            const knownOffer = await globalUnifiedInventory.getOfferById(targetOfferId);
            if (knownOffer && isSeedOffer(knownOffer)) {
              initialStatus = 'DRAFT';
            } else {
              const reval = await globalUnifiedInventory.revalidateOffer(targetOfferId);
              const stateByRevalidation: Record<string, string> = {
                UNCHANGED: 'READY',
                PRICE_CHANGED: 'PRICE_CHANGED',
                UNAVAILABLE: 'UNAVAILABLE',
                EXPIRED: 'OFFER_EXPIRED',
                RECHECK_REQUIRED: 'RECHECK_REQUIRED'
              };
              initialStatus = stateByRevalidation[reval.status] ?? 'RECHECK_REQUIRED';
            }
          }
        }

        const item = this.storage.addTripBucketItem({
          tripBucketId: bucket.id,
          canonicalOfferId: targetOfferId,
          productType: body.productType,
          sourceType: body.sourceType || 'API',
          bookingMode: body.bookingMode || 'INSTANT_BOOK',
          title: body.title || 'Travel Reservation',
          configuration: body.configuration || {},
          travellerManifest: body.travellerManifest || {},
          unitSellingPriceMinor: body.unitSellingPriceMinor ?? (body.sellingPriceMinor ?? 0),
          currency: body.currency || 'LKR',
          state: initialStatus as any
        });

        return createJsonResponse({ success: true, item }, 201);
      }

      // ----------------------------------------------------------------------
      // 5. Booking Saga Execution: POST /api/v1/bookings or POST /api/v1/booking/checkout (CAP-12)
      // ----------------------------------------------------------------------
      if ((path === '/api/v1/bookings' || path === '/api/v1/booking/checkout') && method === 'POST') {
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
      // 6. Booking Lookup: GET /api/v1/bookings/:reference (CAP-13)
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
      // 6b. Consular Visa Desk Application Queue: /api/v1/visa/applications (CAP-14)
      // ----------------------------------------------------------------------
      if (path === '/api/v1/visa/applications' && method === 'POST') {
        const body = await request.json();
        if (!body.country || !body.applicantName || !body.passportNumber) {
          return createProblemResponse(400, 'Missing Mandatory Applicant Details', 'country, applicantName, and passportNumber are required', path, 'INVALID_VISA_APPLICATION');
        }
        const app = this.storage.createVisaApplication({
          userId: securityContext?.userId,
          organizationId: securityContext?.organizationId,
          travelerName: body.applicantName || body.travelerName,
          passportNumber: body.passportNumber,
          destinationCountry: body.country || body.destinationCountry || 'United Arab Emirates',
          visaType: body.visaCategory || body.visaType || 'TOURIST',
          status: 'SUBMITTED',
          submittedAt: new Date().toISOString()
        });
        return createJsonResponse({ success: true, applicationId: app.id, application: app }, 201);
      }

      if (path.startsWith('/api/v1/visa/applications/') && method === 'GET') {
        const appId = path.replace('/api/v1/visa/applications/', '');
        const app = this.storage.getVisaApplication(appId);
        if (!app) {
          return createProblemResponse(404, 'Application Not Found', `Visa application '${appId}' does not exist`, path, 'VISA_APPLICATION_NOT_FOUND');
        }
        return createJsonResponse({ application: app });
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
        // Enforce Admin Roles & Privileges
        const hasAdminAccess = securityContext?.role === 'PLATFORM_ADMIN' ||
          securityContext?.role === 'FINANCE_OPS' ||
          securityContext?.role === 'SUPPORT_STAFF' ||
          securityContext?.role === 'CONTENT_MARKETING' ||
          securityContext?.role === 'SUPER_ADMIN' ||
          Boolean(securityContext && (
            AuthorizationEngine.hasPermission(securityContext, 'cms:edit_listings') ||
            AuthorizationEngine.hasPermission(securityContext, 'cms:verify_commercial') ||
            AuthorizationEngine.hasPermission(securityContext, 'cms:approve_pricing') ||
            AuthorizationEngine.hasPermission(securityContext, 'cms:publish_listings') ||
            AuthorizationEngine.hasPermission(securityContext, 'ops:triage_queue')
          ));

        if (!hasAdminAccess) {
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

        // --------------------------------------------------------------------
        // 8a. Admin Manual Listings: GET /api/v1/admin/listings
        // --------------------------------------------------------------------
        if (path === '/api/v1/admin/listings' && method === 'GET') {
          const productType = url.searchParams.get('productType') as any || undefined;
          const status = url.searchParams.get('status') as any || undefined;
          const destination = url.searchParams.get('destination') || undefined;

          let listings = manualInventoryService.getAllListings();
          if (productType) {
            listings = listings.filter(l => l.productType === productType);
          }
          if (status) {
            listings = listings.filter(l => l.status === status);
          }
          if (destination) {
            const q = destination.toLowerCase();
            listings = listings.filter(l =>
              l.location.city.toLowerCase().includes(q) ||
              l.location.country.toLowerCase().includes(q)
            );
          }
          return createJsonResponse({ totalListings: listings.length, listings });
        }

        // --------------------------------------------------------------------
        // 8b. Create Manual Listing in DRAFT: POST /api/v1/admin/listings
        // --------------------------------------------------------------------
        if (path === '/api/v1/admin/listings' && method === 'POST') {
          const canEdit = securityContext?.role === 'PLATFORM_ADMIN' ||
            securityContext?.role === 'CONTENT_MARKETING' ||
            securityContext?.role === 'SUPER_ADMIN' ||
            (securityContext && AuthorizationEngine.hasPermission(securityContext, 'cms:edit_listings'));
          if (!canEdit) {
            return createProblemResponse(403, 'Forbidden', "User lacks 'cms:edit_listings' permission", path, 'FORBIDDEN_CMS_EDIT');
          }

          const body = await request.json();
          if (!body.title || !body.productType || !body.partnerSupplierId) {
            return createProblemResponse(400, 'Validation Error', 'Missing mandatory listing fields (title, productType, partnerSupplierId)', path, 'INVALID_LISTING_PAYLOAD');
          }

          const adminUser = {
            id: securityContext!.userId,
            name: securityContext!.email,
            permissions: [securityContext!.role]
          };

          const created = manualInventoryService.createListing(body, adminUser);
          return createJsonResponse({ success: true, listing: created }, 201);
        }

        // --------------------------------------------------------------------
        // 8c. Sub-routes under /api/v1/admin/listings/:id
        // --------------------------------------------------------------------
        if (path.startsWith('/api/v1/admin/listings/')) {
          const parts = path.split('/');
          const listingId = parts[5];
          const subAction = parts[6]; // e.g. 'audits', 'submit', 'verify-commercial', 'approve-pricing', 'publish', 'stop-sale', 'allotment', 'archive'

          if (!listingId) {
            return createProblemResponse(400, 'Invalid Request', 'Listing ID is required in URL path', path, 'MISSING_LISTING_ID');
          }

          const listing = manualInventoryService.getListingById(listingId);
          if (!listing) {
            return createProblemResponse(404, 'Listing Not Found', `No manual listing matching id '${listingId}' exists`, path, 'LISTING_NOT_FOUND');
          }

          // GET /api/v1/admin/listings/:id/audits
          if (subAction === 'audits' && method === 'GET') {
            return createJsonResponse({
              listingId,
              totalAudits: listing.auditTrail.length,
              audits: listing.auditTrail
            });
          }

          // GET /api/v1/admin/listings/:id
          if (!subAction && method === 'GET') {
            return createJsonResponse({
              listing,
              audits: listing.auditTrail
            });
          }

          // PATCH / PUT /api/v1/admin/listings/:id
          if (!subAction && (method === 'PATCH' || method === 'PUT')) {
            const canEdit = securityContext?.role === 'PLATFORM_ADMIN' ||
              securityContext?.role === 'CONTENT_MARKETING' ||
              securityContext?.role === 'SUPER_ADMIN' ||
              (securityContext && AuthorizationEngine.hasPermission(securityContext, 'cms:edit_listings'));
            if (!canEdit) {
              return createProblemResponse(403, 'Forbidden', "User lacks 'cms:edit_listings' permission", path, 'FORBIDDEN_CMS_EDIT');
            }

            const body = await request.json();
            const adminUser = { id: securityContext!.userId, name: securityContext!.email };
            const updated = manualInventoryService.updateListingAttributes(listingId, body, adminUser, body.reason);
            return createJsonResponse({ success: true, listing: updated });
          }

          // POST /api/v1/admin/listings/:id/submit
          if (subAction === 'submit' && method === 'POST') {
            const adminUser = { id: securityContext!.userId, name: securityContext!.email };
            try {
              manualInventoryService.submitForVerification(listingId, adminUser);
              return createJsonResponse({
                success: true,
                listing: manualInventoryService.getListingById(listingId),
                message: 'Submitted for independent commercial verification'
              });
            } catch (err: any) {
              return createProblemResponse(400, 'Invalid State Transition', err.message, path, 'INVALID_TRANSITION');
            }
          }

          // POST /api/v1/admin/listings/:id/verify-commercial (4-Eyes separation of duties)
          if (subAction === 'verify-commercial' && method === 'POST') {
            const body = await request.json();
            const verifier = {
              id: securityContext!.userId,
              name: securityContext!.email,
              permissions: securityContext!.role === 'PLATFORM_ADMIN' ? ['platform:system_admin', 'cms:verify_commercial'] : [securityContext!.role]
            };

            try {
              manualInventoryService.verifyCommercialContract(listingId, verifier, body.evidence);
              return createJsonResponse({
                success: true,
                listing: manualInventoryService.getListingById(listingId),
                message: 'Listing commercially verified'
              });
            } catch (err: any) {
              if (err instanceof SeparationOfDutiesViolationError || err.name === 'SeparationOfDutiesViolationError') {
                return createProblemResponse(403, 'Separation of Duties Violation', err.message, path, 'SEPARATION_OF_DUTIES_VIOLATION');
              }
              return createProblemResponse(400, 'Verification Failed', err.message, path, 'COMMERCIAL_VERIFICATION_FAILED');
            }
          }

          // POST /api/v1/admin/listings/:id/approve-pricing
          if (subAction === 'approve-pricing' && method === 'POST') {
            const body = await request.json();
            const approver = {
              id: securityContext!.userId,
              name: securityContext!.email,
              permissions: (securityContext!.role === 'PLATFORM_ADMIN' || securityContext!.role === 'FINANCE_OPS')
                ? ['cms:approve_pricing', 'platform:system_admin']
                : [securityContext!.role]
            };

            try {
              manualInventoryService.approvePricingStructure(listingId, approver, body);
              return createJsonResponse({
                success: true,
                listing: manualInventoryService.getListingById(listingId),
                message: 'Pricing structure approved'
              });
            } catch (err: any) {
              return createProblemResponse(400, 'Pricing Approval Failed', err.message, path, 'PRICING_APPROVAL_FAILED');
            }
          }

          // POST /api/v1/admin/listings/:id/publish (4-Eyes separation of duties)
          if (subAction === 'publish' && method === 'POST') {
            const publisher = {
              id: securityContext!.userId,
              name: securityContext!.email,
              permissions: securityContext!.role === 'PLATFORM_ADMIN' ? ['cms:publish_listings', 'platform:system_admin'] : [securityContext!.role]
            };

            try {
              manualInventoryService.publishListing(listingId, publisher);
              const publishedListing = manualInventoryService.getListingById(listingId)!;
              // Sync with unified inventory
              globalUnifiedInventory.syncManualListing(publishedListing);
              return createJsonResponse({
                success: true,
                listing: publishedListing,
                message: 'Listing published to live sales channel'
              });
            } catch (err: any) {
              if (err instanceof SeparationOfDutiesViolationError || err.name === 'SeparationOfDutiesViolationError') {
                return createProblemResponse(403, 'Separation of Duties Violation', err.message, path, 'SEPARATION_OF_DUTIES_VIOLATION');
              }
              return createProblemResponse(400, 'Publishing Failed', err.message, path, 'PUBLISHING_FAILED');
            }
          }

          // POST /api/v1/admin/listings/:id/stop-sale
          if (subAction === 'stop-sale' && method === 'POST') {
            const body = await request.json().catch(() => ({}));
            const adminUser = { id: securityContext!.userId, name: securityContext!.email };
            manualInventoryService.toggleStopSale(listingId, adminUser, body.reason);
            const currentListing = manualInventoryService.getListingById(listingId)!;
            globalUnifiedInventory.syncManualListing(currentListing);
            return createJsonResponse({
              success: true,
              isStopSaleActive: currentListing.isStopSaleActive,
              listing: currentListing
            });
          }

          // POST /api/v1/admin/listings/:id/allotment
          if (subAction === 'allotment' && method === 'POST') {
            const body = await request.json();
            if (body.quota === undefined || body.quota < 0) {
              return createProblemResponse(400, 'Invalid Quota', 'Quota must be a non-negative number', path, 'INVALID_QUOTA');
            }
            const adminUser = { id: securityContext!.userId, name: securityContext!.email };
            manualInventoryService.updateAllotment(listingId, body.quota, adminUser, body.reason);
            const currentListing = manualInventoryService.getListingById(listingId)!;
            globalUnifiedInventory.syncManualListing(currentListing);
            return createJsonResponse({
              success: true,
              availableQuota: currentListing.availableQuota,
              listing: currentListing
            });
          }

          // POST /api/v1/admin/listings/:id/archive
          if (subAction === 'archive' && method === 'POST') {
            const body = await request.json().catch(() => ({}));
            const adminUser = { id: securityContext!.userId, name: securityContext!.email };
            manualInventoryService.archiveListing(listingId, adminUser, body.reason);
            const currentListing = manualInventoryService.getListingById(listingId)!;
            globalUnifiedInventory.syncManualListing(currentListing);
            return createJsonResponse({
              success: true,
              listing: currentListing
            });
          }
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

      // ----------------------------------------------------------------------
      // 10. Vacatina Travel Credit & Refund Ledger Endpoints
      // Authority: CBSL Closed-Loop Compliance & Vacatina Travel Credit Architecture v1.0
      // ----------------------------------------------------------------------

      // 10a. GET /api/v1/travel-credit (Get customer travel credit balance summary)
      if (path === '/api/v1/travel-credit' && method === 'GET') {
        const customerId = url.searchParams.get('customerId') || securityContext?.email || 'traveller@vacatina.com';
        const balance = await globalTravelCreditLedgerService.getBalance(customerId);
        return createJsonResponse({
          success: true,
          balance
        });
      }

      // 10b. GET /api/v1/travel-credit/transactions (Get immutable ledger history)
      if (path === '/api/v1/travel-credit/transactions' && method === 'GET') {
        const customerId = url.searchParams.get('customerId') || securityContext?.email || 'traveller@vacatina.com';
        const creditType = url.searchParams.get('creditType') as any;
        const direction = url.searchParams.get('direction') as any;
        const status = url.searchParams.get('status') as any;

        const transactions = await globalTravelCreditLedgerService.getTransactions(customerId, {
          creditType,
          direction,
          status
        });
        return createJsonResponse({
          success: true,
          total: transactions.length,
          transactions
        });
      }

      // 10c. POST /api/v1/travel-credit/apply (Checkout partial-payment debit)
      if (path === '/api/v1/travel-credit/apply' && method === 'POST') {
        const body = await request.json();
        if (!body.customerId || !body.bookingGroupId || !body.orderTotalMinor) {
          return createProblemResponse(400, 'Invalid Redemption Request', 'customerId, bookingGroupId, and orderTotalMinor are mandatory fields', path, 'INVALID_REDEMPTION_REQUEST');
        }

        const result = await globalTravelCreditLedgerService.applyToCheckout({
          customerId: body.customerId,
          bookingGroupId: body.bookingGroupId,
          orderTotalMinor: body.orderTotalMinor,
          requestedCreditAmountMinor: body.requestedCreditAmountMinor,
          currency: body.currency,
          settlementCurrency: body.settlementCurrency,
          fxRate: body.fxRate
        });
        return createJsonResponse({
          success: result.success,
          result
        });
      }

      // 10d. POST /api/v1/travel-credit/refund (Credit booking refund to travel credit)
      if (path === '/api/v1/travel-credit/refund' && method === 'POST') {
        const body = await request.json();
        if (!body.customerId || !body.bookingReference || !body.amountMinor) {
          return createProblemResponse(400, 'Invalid Refund Request', 'customerId, bookingReference, and amountMinor are required', path, 'INVALID_REFUND_REQUEST');
        }

        const tx = await globalTravelCreditLedgerService.creditRefund({
          customerId: body.customerId,
          bookingId: body.bookingId || `bk_${body.bookingReference}`,
          bookingReference: body.bookingReference,
          refundId: body.refundId || `ref_${Date.now()}`,
          amountMinor: body.amountMinor,
          currency: body.currency,
          description: body.description,
          isPending: body.isPending
        });
        return createJsonResponse({
          success: true,
          transaction: tx
        }, 201);
      }

      // 10e. POST /api/v1/admin/travel-credit/issue-service-credit (Staff goodwill/service credit)
      if (path === '/api/v1/admin/travel-credit/issue-service-credit' && method === 'POST') {
        const canIssue = securityContext?.role === 'PLATFORM_ADMIN' ||
          securityContext?.role === 'SUPER_ADMIN' ||
          (securityContext && AuthorizationEngine.hasPermission(securityContext, 'platform:system_admin'));

        if (!canIssue) {
          return createProblemResponse(403, 'Forbidden', 'User lacks authority to issue privileged service credit', path, 'FORBIDDEN_SERVICE_CREDIT');
        }

        const body = await request.json();
        if (!body.customerId || !body.amountMinor || !body.reason) {
          return createProblemResponse(400, 'Invalid Service Credit Parameters', 'customerId, amountMinor, and reason are required', path, 'INVALID_SERVICE_CREDIT_PARAMS');
        }

        const staffActor = {
          id: securityContext!.userId,
          name: securityContext!.email,
          role: securityContext!.role,
          reason: body.reason
        };

        const tx = await globalTravelCreditLedgerService.issueServiceCredit({
          customerId: body.customerId,
          amountMinor: body.amountMinor,
          reason: body.reason,
          staffActor,
          referenceId: body.referenceId
        });
        return createJsonResponse({
          success: true,
          transaction: tx
        }, 201);
      }

      // 10f. POST /api/v1/admin/travel-credit/reverse (Privileged credit reversal)
      if (path === '/api/v1/admin/travel-credit/reverse' && method === 'POST') {
        const canReverse = securityContext?.role === 'PLATFORM_ADMIN' ||
          securityContext?.role === 'SUPER_ADMIN' ||
          (securityContext && AuthorizationEngine.hasPermission(securityContext, 'platform:system_admin'));

        if (!canReverse) {
          return createProblemResponse(403, 'Forbidden', 'User lacks authority to reverse credit transactions', path, 'FORBIDDEN_CREDIT_REVERSAL');
        }

        const body = await request.json();
        if (!body.customerId || !body.transactionId || !body.reason) {
          return createProblemResponse(400, 'Invalid Reversal Parameters', 'customerId, transactionId, and reason are required', path, 'INVALID_REVERSAL_PARAMS');
        }

        const staffActor = {
          id: securityContext!.userId,
          name: securityContext!.email,
          role: securityContext!.role,
          reason: body.reason
        };

        const tx = await globalTravelCreditLedgerService.reverseCredit({
          customerId: body.customerId,
          transactionId: body.transactionId,
          reason: body.reason,
          staffActor
        });
        return createJsonResponse({
          success: true,
          transaction: tx
        });
      }

      // 10g. CBSL Closed-Loop Protection Endpoints (Strictly Reject Cash-In, P2P, Cash-Out)
      if (path === '/api/v1/travel-credit/top-up' && method === 'POST') {
        return createProblemResponse(
          400,
          'Closed-Loop Regulatory Invariant',
          'Cash top-ups and stored-money loading are strictly prohibited under Vacatina Closed-Loop Travel Credit compliance (CBSL Regulatory Framework).',
          path,
          'CLOSED_LOOP_CASH_TOPUP_PROHIBITED'
        );
      }

      if (path === '/api/v1/travel-credit/p2p-transfer' && method === 'POST') {
        return createProblemResponse(
          400,
          'Closed-Loop Regulatory Invariant',
          'Peer-to-peer (P2P) transfers between customers are strictly prohibited under Vacatina Closed-Loop Travel Credit compliance.',
          path,
          'CLOSED_LOOP_P2P_TRANSFER_PROHIBITED'
        );
      }

      if (path === '/api/v1/travel-credit/withdraw' && method === 'POST') {
        return createProblemResponse(
          400,
          'Closed-Loop Regulatory Invariant',
          'Bank withdrawals, cash payouts, and monetary refunds of travel credit are strictly prohibited under Vacatina Closed-Loop Travel Credit compliance.',
          path,
          'CLOSED_LOOP_WITHDRAWAL_PROHIBITED'
        );
      }

      // Unmatched Route
      return createProblemResponse(404, 'Endpoint Not Found', `The API endpoint '${method} ${path}' does not exist on this server`, path, 'ENDPOINT_NOT_FOUND');
    } catch (err: any) {
      const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
      return createProblemResponse(status, status === 500 ? 'Service Unavailable' : 'Request Could Not Be Completed',
        status === 500 ? 'The travel service could not complete this request. Please retry.' : err.message,
        path, err.code || 'SERVER_EXCEPTION');
    }
  }
}

export const globalApiRouter = new VacatinaApiRouter();
