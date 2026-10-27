/* ============================================================================
 * Vacatina Canonical Offer Mappers & Normalizers
 * Authority: VACATINA SUPPLIER & LISTING ARCHITECTURE v1.0
 *
 * Responsibilities:
 * 1. Transforms persistent Manual Inventory records into UnifiedCanonicalOffer.
 * 2. Transforms external raw supplier payloads into UnifiedCanonicalOffer.
 * 3. Constructs Hybrid offers by applying Vacatina commercial markup & perks
 *    over an immutable supplier availability and net cost foundation.
 * 4. Stale offer detection based on lastCheckedAt and freshness TTL.
 * ============================================================================ */

import type {
  CanonicalInventoryListing,
  CanonicalOfferLifecycleStatus,
  UnifiedCanonicalOffer
} from './canonical-offer.ts';
import type { TravelProductSlug } from '../types.ts';

export class CanonicalOfferMapper {
  /**
   * Transforms a persistent Manual Listing into a UnifiedCanonicalOffer.
   * Enforces that only PUBLISHED listings with quota > 0 and stop-sale OFF become AVAILABLE.
   */
  public static mapManualListingToOffer(listing: CanonicalInventoryListing): UnifiedCanonicalOffer {
    const now = Date.now();
    const validUntilMs = new Date(listing.validTo).getTime();

    // Determine availability status
    let availabilityStatus: CanonicalOfferLifecycleStatus = 'AVAILABLE';
    if (listing.status !== 'PUBLISHED' || listing.isStopSaleActive || listing.availableQuota <= 0) {
      availabilityStatus = 'UNAVAILABLE';
    } else if (now > validUntilMs) {
      availabilityStatus = 'EXPIRED';
    }

    const price = Math.round(listing.sellingPriceMinor / 100);

    return {
      offerId: `vct-man-${listing.productType}-${listing.listingId}`,
      productId: listing.canonicalEntityId || `prod-${listing.productType}-${listing.destination.toLowerCase().replace(/[^a-z0-9]/g, '')}-${listing.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`,
      productType: listing.productType,
      sourceType: 'MANUAL',
      supplierId: listing.supplierId || 'VACATINA_DIRECT',
      providerId: listing.providerId || 'manual_cms',
      sourceListingId: listing.listingId,
      title: listing.title,
      subtitle: listing.description ? listing.description.slice(0, 120) : 'Vacatina Direct Contract',
      destinationId: listing.destination,
      destinationIds: [listing.destination],
      originId: listing.origin,
      travelDates: {
        departureDate: listing.validFrom,
        returnDate: listing.validTo
      },
      location: {
        city: listing.destination,
        country: listing.market === 'LK' ? 'Sri Lanka' : listing.market === 'AE' ? 'United Arab Emirates' : 'International'
      },
      price,
      currency: listing.currency || 'LKR',
      basePrice: Math.round(listing.contractedBaseCostMinor / 100),
      taxAmount: 0,
      feeAmount: 0,
      priceBreakdown: {
        baseMinor: listing.contractedBaseCostMinor,
        taxesMinor: 0,
        markupMinor: listing.markupMinor,
        totalMinor: listing.sellingPriceMinor,
        currency: listing.currency || 'LKR'
      },
      pricing: {
        baseCostMinor: listing.contractedBaseCostMinor,
        sellingPriceMinor: listing.sellingPriceMinor,
        currency: listing.currency || 'LKR',
        taxInclusive: true,
        markupMinor: listing.markupMinor,
        breakdown: {
          baseMinor: listing.contractedBaseCostMinor,
          taxesMinor: 0,
          markupMinor: listing.markupMinor,
          totalMinor: listing.sellingPriceMinor,
          currency: listing.currency || 'LKR'
        }
      },
      markup: {
        markupType: 'FIXED',
        markupValue: listing.markupMinor / 100,
        appliedMarkupMinor: listing.markupMinor
      },
      isTaxInclusive: true,
      availabilityStatus,
      lastCheckedAt: listing.lastCheckedAt || new Date().toISOString(),
      lastSyncedAt: listing.lastSyncedAt || new Date().toISOString(),
      validUntil: listing.validTo,
      revalidateAt: listing.validTo,
      freshnessTtlSeconds: 3600, // 1 hour for manual catalog items
      isStale: this.isStale(listing.lastCheckedAt, 3600),
      inclusions: listing.inclusions || [],
      exclusions: listing.exclusions || [],
      cancellationPolicy: {
        isRefundable: listing.refundability === 'REFUNDABLE',
        policyText: listing.cancellationPolicy || 'Standard Vacatina Direct cancellation rules apply.'
      },
      cancellationTerms: {
        policyType: listing.refundability,
        isRefundable: listing.refundability === 'REFUNDABLE',
        deadlineIso: listing.validTo,
        description: listing.cancellationPolicy || 'Standard Vacatina Direct cancellation rules apply.'
      },
      confirmationMode: listing.totalQuota > 0 ? 'INSTANT' : 'ON_REQUEST',
      bookingMode: 'DIRECT_BOOKING',
      fulfilmentMode: 'DIRECT_VOUCHER_DISPATCH',
      status: 'ACTIVE',
      travelCreditPolicy: {
        eligible: true,
        applicableCreditTypes: ['REFUND_CREDIT', 'SERVICE_CREDIT', 'PROMOTIONAL_CREDIT']
      },
      badges: [{ text: 'Vacatina Exclusive', variant: 'exclusive' }],
      media: listing.media || {
        heroImageUrl: '/public/images/destinations/default.jpg',
        galleryUrls: []
      },
      revalidationSupported: true,
      metadata: {
        totalQuota: listing.totalQuota,
        availableQuota: listing.availableQuota,
        isStopSaleActive: listing.isStopSaleActive,
        contractedCostMinor: listing.contractedBaseCostMinor
      },
      isSeed: false
    };
  }

  /**
   * Normalizes an external raw supplier API response into UnifiedCanonicalOffer.
   * Guarantees that the frontend never receives supplier-specific schema anomalies.
   */
  public static mapSupplierPayloadToOffer(
    raw: Record<string, any>,
    providerId: string,
    productType: TravelProductSlug
  ): UnifiedCanonicalOffer {
    const rawId = raw.id || raw.offerId || raw.rateId || `api-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const supplierId = raw.supplierId || raw.carrierCode || providerId.toUpperCase();
    const title = raw.title || raw.name || raw.marketingCarrier?.name || `${productType.toUpperCase()} by ${supplierId}`;
    const destination = raw.destination || raw.destinationAirport || raw.city || 'GLOBAL';
    const origin = raw.origin || raw.originAirport;

    // Normalize pricing into minor units
    let totalMinor = 0;
    let baseMinor = 0;
    let taxesMinor = 0;
    let currency = raw.currency || 'LKR';

    if (raw.price && typeof raw.price === 'object') {
      totalMinor = raw.price.totalMinor || Math.round((raw.price.total || raw.price.amount || 0) * 100);
      baseMinor = raw.price.baseMinor || raw.price.baseFareMinor || totalMinor;
      taxesMinor = raw.price.taxesMinor || 0;
      currency = raw.price.currency || currency;
    } else if (typeof raw.price === 'number') {
      totalMinor = Math.round(raw.price * 100);
      baseMinor = totalMinor;
    }

    const price = Math.round(totalMinor / 100);
    const ttl = productType === 'flights' ? 900 : 1800; // 15 mins for flights, 30 mins for hotels/activities
    const nowIso = new Date().toISOString();

    return {
      offerId: `vct-api-${productType}-${providerId}-${rawId}`,
      productId: raw.productId || `prod-${productType}-${destination.toLowerCase().replace(/[^a-z0-9]/g, '')}-${title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`,
      productType,
      sourceType: (raw.sourceType as any) || 'API',
      supplierId,
      providerId,
      externalOfferId: String(rawId),
      title,
      subtitle: raw.subtitle || raw.description || `Live inventory via ${supplierId}`,
      destinationId: destination,
      destinationIds: [destination],
      originId: origin,
      travelDates: raw.travelDates,
      location: {
        city: destination,
        country: raw.country || 'International',
        address: raw.address
      },
      price,
      currency,
      basePrice: Math.round(baseMinor / 100),
      taxAmount: Math.round(taxesMinor / 100),
      feeAmount: 0,
      priceBreakdown: {
        baseMinor,
        taxesMinor,
        markupMinor: 0,
        totalMinor,
        currency
      },
      pricing: {
        baseCostMinor: baseMinor,
        sellingPriceMinor: totalMinor,
        currency,
        taxInclusive: Boolean(raw.isTaxInclusive ?? true),
        markupMinor: 0,
        breakdown: {
          baseMinor,
          taxesMinor,
          markupMinor: 0,
          totalMinor,
          currency
        }
      },
      markup: {
        markupType: 'PERCENTAGE',
        markupValue: 0,
        appliedMarkupMinor: 0
      },
      isTaxInclusive: Boolean(raw.isTaxInclusive ?? true),
      availabilityStatus: (raw.availabilityStatus as CanonicalOfferLifecycleStatus) || 'AVAILABLE',
      lastCheckedAt: raw.lastCheckedAt || nowIso,
      lastSyncedAt: nowIso,
      validUntil: raw.validUntil || new Date(Date.now() + ttl * 1000).toISOString(),
      revalidateAt: raw.validUntil || new Date(Date.now() + ttl * 1000).toISOString(),
      freshnessTtlSeconds: ttl,
      isStale: this.isStale(raw.lastCheckedAt, ttl),
      inclusions: Array.isArray(raw.inclusions) ? raw.inclusions : [],
      exclusions: Array.isArray(raw.exclusions) ? raw.exclusions : [],
      cancellationPolicy: {
        isRefundable: Boolean(raw.isRefundable ?? true),
        policyText: raw.cancellationPolicyText || 'Subject to carrier / property fare rules.'
      },
      cancellationTerms: {
        policyType: raw.isRefundable ? 'REFUNDABLE' : 'NON_REFUNDABLE',
        isRefundable: Boolean(raw.isRefundable ?? true),
        description: raw.cancellationPolicyText || 'Subject to carrier / property fare rules.'
      },
      confirmationMode: 'INSTANT',
      bookingMode: 'DIRECT_BOOKING',
      fulfilmentMode: 'AUTOMATED_SUPPLIER_API',
      status: 'ACTIVE',
      travelCreditPolicy: {
        eligible: raw.travelCreditEligible ?? true,
        applicableCreditTypes: raw.applicableCreditTypes || ['REFUND_CREDIT', 'SERVICE_CREDIT', 'PROMOTIONAL_CREDIT'],
        exclusionReason: raw.travelCreditExclusionReason
      },
      badges: raw.badges || [],
      compositeComponents: raw.compositeComponents,
      rateOptions: raw.rateOptions,
      media: {
        heroImageUrl: raw.imageUrl || raw.heroImageUrl || '/public/images/destinations/default.jpg',
        galleryUrls: Array.isArray(raw.galleryUrls) ? raw.galleryUrls : []
      },
      revalidationSupported: true,
      metadata: raw.metadata || {},
      isSeed: false
    };
  }

  /**
   * Constructs a Hybrid Offer: Combines live supplier availability/cost
   * with Vacatina commercial markup and bespoke perks.
   *
   * Invariant: Supplier net cost and availability are authoritative.
   * Vacatina markup, merchandising title, and perks are authoritative.
   */
  public static createHybridOffer(
    supplierOffer: UnifiedCanonicalOffer,
    vacatinaMarkupMinor: number,
    overrides?: {
      exclusivePerks?: string[];
      bespokeTitle?: string;
      customCancellationTerms?: string;
    }
  ): UnifiedCanonicalOffer {
    const newTotalMinor = supplierOffer.priceBreakdown.totalMinor + vacatinaMarkupMinor;
    const newPrice = Math.round(newTotalMinor / 100);

    const mergedInclusions = [
      ...supplierOffer.inclusions,
      ...(overrides?.exclusivePerks || ['Vacatina Concierge VIP Assistance'])
    ];

    return {
      ...supplierOffer,
      offerId: supplierOffer.offerId.replace('vct-api-', 'vct-hyb-'),
      sourceType: 'HYBRID',
      title: overrides?.bespokeTitle || supplierOffer.title,
      price: newPrice,
      priceBreakdown: {
        ...supplierOffer.priceBreakdown,
        markupMinor: vacatinaMarkupMinor,
        totalMinor: newTotalMinor
      },
      inclusions: mergedInclusions,
      cancellationPolicy: {
        ...supplierOffer.cancellationPolicy,
        policyText: overrides?.customCancellationTerms || supplierOffer.cancellationPolicy.policyText
      },
      metadata: {
        ...supplierOffer.metadata,
        hybridProvenance: {
          supplierNetMinor: supplierOffer.priceBreakdown.totalMinor,
          vacatinaMarkupMinor,
          supplierProviderId: supplierOffer.providerId
        }
      }
    };
  }

  /**
   * Checks whether an offer's freshness has expired.
   */
  public static isStale(lastCheckedAtIso?: string, ttlSeconds = 1800): boolean {
    if (!lastCheckedAtIso) return true;
    const lastCheckedMs = new Date(lastCheckedAtIso).getTime();
    if (isNaN(lastCheckedMs)) return true;
    return Date.now() - lastCheckedMs > ttlSeconds * 1000;
  }
}
