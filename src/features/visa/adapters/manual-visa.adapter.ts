/* ============================================================================
 * Vacatina Manual Consular Visa Adapter
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.3)
 *
 * Implements direct integration with Vacatina Consular Advisory Desk.
 * Invariants:
 * 1. Pin-Above-API ranking: isPinnedAboveApi is true.
 * 2. Strict SEED quarantine: isSeed is strictly false.
 * ============================================================================ */

import type { IVisaAdapter } from './visa-adapter.interface.ts';
import type { CanonicalVisaOffer } from '../domain/visa-models.ts';
import type { VisaSearchCriteria, VisaRevalidationResult } from '../domain/visa-search-models.ts';
import { MANUAL_VISA_SERVICES } from '../data/manual-visas.ts';
import type {
  IManualListingRepository,
  ProductionManualListingEntity
} from '../../../server/inventory/repository/manual-listing.repository.ts';

function mapListingToCanonicalVisaOffer(listing: ProductionManualListingEntity): CanonicalVisaOffer {
  return {
    visaId: listing.listingId,
    canonicalOfferId: listing.canonicalEntityId,
    sourceType: 'MANUAL',
    providerId: 'VACATINA_CONSULAR_DESK',
    supplierName: listing.operatorName || listing.partnerName,
    countryName: listing.location.country,
    countryCode: listing.destination.length === 2 ? listing.destination.toUpperCase() : 'LK',
    region: 'South Asia',
    title: listing.title,
    subtitle: listing.subtitle || 'Direct Consular Visa Assistance',
    description: listing.description,
    category: 'TOURIST_EVISA',
    entryType: 'SINGLE_ENTRY',
    durationDays: 30,
    validityDescription: 'Valid 30 days from approval',
    maxStayDescription: 'Up to 30 days per entry',
    processingSlaBusinessDays: 3,
    expressAvailable: true,
    heroImage: listing.media.heroImageUrl || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
    flagEmoji: '🇱🇰',
    pricing: {
      embassyFeeMinor: listing.contractedBaseCostMinor,
      vacatinaConciergeFeeMinor: listing.markupMinor,
      taxMinor: 0,
      totalPriceMinor: listing.sellingPriceMinor,
      currency: listing.currency
    },
    documentChecklist: (listing.inclusions || []).map((inc, i) => ({
      id: `doc_${i}`,
      title: inc,
      description: `Required document: ${inc}`,
      isRequired: true,
      acceptedFormats: 'PDF, JPG, PNG',
      category: 'IDENTITY'
    })),
    consularSteps: [
      'Document audit & biometrics check',
      'Electronic application submission',
      'Embassy liaison & tracking',
      'e-Visa / Passport dispatch'
    ],
    importantNotes: [listing.cancellationPolicy],
    isPinnedAboveApi: true,
    isSeed: false,
    availabilityStatus: (listing.isStopSaleActive || listing.availableQuota <= 0) ? 'UNAVAILABLE' : 'AVAILABLE',
    lastCheckedAt: new Date().toISOString(),
    validUntil: listing.validUntilIso
  };
}

export class ManualVisaAdapter implements IVisaAdapter {
  public readonly providerId: string = 'VACATINA_CONSULAR_DESK';
  public readonly supplierName: string = 'Vacatina Consular Advisory Service';
  public readonly isOperationallyLive: boolean = true;

  private offers: Map<string, CanonicalVisaOffer> = new Map();
  private repo?: IManualListingRepository;

  constructor(repo?: IManualListingRepository) {
    this.repo = repo;
    for (const offer of MANUAL_VISA_SERVICES) {
      this.offers.set(offer.canonicalOfferId, offer);
      this.offers.set(offer.visaId, offer);
      // Secondary key matching
      this.offers.set(`vct-vs-${offer.countryCode.toLowerCase()}`, offer);
    }
  }

  public async search(criteria: VisaSearchCriteria): Promise<CanonicalVisaOffer[]> {
    let dbOffers: CanonicalVisaOffer[] = [];
    if (this.repo) {
      try {
        const dbListings = await this.repo.search({
          productType: 'visa',
          onlySellable: true
        });
        dbOffers = dbListings.map(mapListingToCanonicalVisaOffer);
      } catch {
        dbOffers = [];
      }
    }

    const staticOffers = Array.from(new Set(this.offers.values()));
    const seenIds = new Set([
      ...dbOffers.map(o => o.visaId),
      ...dbOffers.map(o => o.canonicalOfferId)
    ]);
    const allAvailable = [
      ...dbOffers,
      ...staticOffers.filter(o => !seenIds.has(o.visaId) && !seenIds.has(o.canonicalOfferId))
    ];

    const destQuery = (criteria.destinationCountry || '').trim().toLowerCase();
    const destCode = (criteria.destinationCountryCode || '').trim().toUpperCase();
    const purpose = criteria.purpose || 'all';

    let matches = allAvailable.filter(offer => {
      // Must not be seed
      if ((offer as any).isSeed === true) return false;

      // Destination matching
      if (destCode && offer.countryCode.toUpperCase() === destCode) {
        return true;
      }
      if (destQuery) {
        const matchesName = offer.countryName.toLowerCase().includes(destQuery);
        const matchesCode = offer.countryCode.toLowerCase() === destQuery;
        const matchesTitle = offer.title.toLowerCase().includes(destQuery);
        const matchesRegion = offer.region.toLowerCase().includes(destQuery);
        if (!matchesName && !matchesCode && !matchesTitle && !matchesRegion) {
          return false;
        }
      }

      // Purpose filter
      if (purpose === 'tourist' && offer.category !== 'TOURIST_EVISA' && offer.category !== 'STICKER_VISA' && offer.category !== 'ETA') {
        return false;
      }
      if (purpose === 'business' && offer.category !== 'BUSINESS_VISA') {
        return false;
      }
      if (purpose === 'transit' && offer.category !== 'TRANSIT_VISA') {
        return false;
      }

      return true;
    });

    // If destination search was generic (empty), return all services
    if (!destQuery && !destCode) {
      matches = allAvailable;
    }

    // Always sort with direct consular desk first (pinned) and then by SLA
    return matches.sort((a, b) => {
      if (a.isPinnedAboveApi && !b.isPinnedAboveApi) return -1;
      if (!a.isPinnedAboveApi && b.isPinnedAboveApi) return 1;
      return a.processingSlaBusinessDays - b.processingSlaBusinessDays;
    });
  }

  public async getOffer(offerId: string): Promise<CanonicalVisaOffer | null> {
    if (this.repo) {
      try {
        const fromRepo = (await this.repo.findById(offerId)) || (await this.repo.findByCanonicalEntityId(offerId));
        if (fromRepo && fromRepo.workflowStatus === 'PUBLISHED' && !fromRepo.isStopSaleActive) {
          return mapListingToCanonicalVisaOffer(fromRepo);
        }
      } catch {
        // Fallback
      }
    }

    if (this.offers.has(offerId)) {
      return this.offers.get(offerId)!;
    }

    // Fuzzy fallback
    for (const [key, offer] of this.offers.entries()) {
      if (offer.canonicalOfferId === offerId || offer.visaId === offerId) {
        return offer;
      }
    }

    return null;
  }

  public async revalidate(offerId: string): Promise<VisaRevalidationResult> {
    const offer = await this.getOffer(offerId);
    if (!offer) {
      return {
        offerId,
        isValid: false,
        isPriceChanged: false,
        currency: 'LKR',
        revalidatedAt: new Date().toISOString(),
        recheckReason: 'Visa service not found in active consular catalog'
      };
    }

    return {
      offerId: offer.canonicalOfferId,
      isValid: true,
      isPriceChanged: false,
      newPriceMinor: offer.pricing.totalPriceMinor,
      currency: offer.pricing.currency,
      revalidatedAt: new Date().toISOString()
    };
  }
}
