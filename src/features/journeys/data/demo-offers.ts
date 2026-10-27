/** Explicit, non-sellable customer DTO fixtures. Never imported by the production supplier registry. */
import type { JourneyOffer, JourneyConfiguration } from '../domain/journey-models.ts';
import { journeyOfferId } from '../domain/journey-models.ts';
import type { TravelProductSlug } from '../../../lib/domain/types.ts';

export const JOURNEY_DEMO_DISCLOSURE = 'Canonical demo fixture — no live supplier, availability, reservation or confirmation. This selection is a local planning request only; current price and conditions require operator confirmation.';

export function demoOffer(productType: TravelProductSlug, title: string, destination: string, extension: Record<string, unknown>): JourneyOffer {
  return {
    offerId: `DEMO-${productType}-planning-v1`, canonicalOfferId: `DEMO-${productType}-planning-v1`, productType, title,
    subtitle: 'Illustrative planning option · Not sellable inventory', location: { city: destination },
    inventoryMode: 'demo_fixture', sourceType: 'MANUAL', sourceId: 'VACATINA_LOCAL_DEMO', providerName: 'Vacatina local demonstration catalog',
    currency: 'LKR', priceStatus: 'quote_required', availabilityStatus: 'ON_REQUEST', confirmationMode: 'REQUEST_TO_CONFIRM', bookingMode: 'REQUEST_TO_BOOK', sellable: false,
    lastCheckedAt: '2026-10-27T00:00:00.000Z', offerExpiresAt: '2028-12-31T23:59:59.000Z',
    cancellationPolicy: 'Not supplied for booking. Request the current operator cancellation terms before committing.',
    productExtension: extension
  };
}

export const JOURNEY_DEMO_OFFERS: JourneyOffer[] = [
  demoOffer('packages', 'Dubai holiday planning example', 'Dubai', {
    package: {
      packageTheme: 'Illustrative city break', itineraryDays: 5, itineraryNights: 4,
      packageStyles: [{ id: 'CUSTOM_QUOTE', label: 'Custom itinerary request' }],
      accommodationTiers: [{ id: 'TO_CONFIRM', label: 'Accommodation tier to confirm' }],
      itinerary: [
        { title: 'Arrival planning', summary: 'Request arrival arrangements. No flight, hotel or transfer is included or held.' },
        { title: 'Choose your experiences', summary: 'Discuss preferred activities with the operator. Tickets, meals and guided services are not confirmed.' },
        { title: 'Departure planning', summary: 'Review the proposed return arrangements before accepting a future quote.' }
      ]
    }
  }),
  demoOffer('cars', 'Dubai ground transport planning example', 'Dubai', {
    car: {
      serviceTypes: ['transfer', 'car-hire'],
      vehicleCategories: [{ id: 'STANDARD_REQUEST', label: 'Standard vehicle request · Allocation pending' }, { id: 'ACCESS_REQUEST', label: 'Accessibility requirements · Operator review' }],
      confirmationNotes: 'Vehicle, passenger/luggage capacity, driver assignment, hire eligibility and return arrangements require operator confirmation. No vehicle is reserved.'
    }
  }),
  demoOffer('activities', 'Dubai activity planning example', 'Dubai', {
    activity: {
      activityCategory: 'Experience request',
      timeSlots: [{ id: 'OPERATOR_CONFIRM', label: 'Time to be confirmed by operator' }],
      ticketTypes: [{ id: 'PARTICIPANT_REQUEST', label: 'Participant option request · Not a ticket' }],
      confirmationNotes: 'Date, session, participant eligibility, tickets and inclusions need operator confirmation. No time slot or ticket is reserved.'
    }
  })
];

export function getDemoJourneyOffer(id: string): JourneyOffer | null {
  const offer = JOURNEY_DEMO_OFFERS.find(o => journeyOfferId(o) === id);
  return offer ? structuredClone(offer) : null;
}
export function searchDemoJourneyOffers(product: TravelProductSlug, configuration: JourneyConfiguration): JourneyOffer[] {
  const destination = configuration.destination.toLowerCase().trim();
  return JOURNEY_DEMO_OFFERS.filter(o => o.productType === product && !!destination && `${o.location?.city || ''} ${o.location?.country || ''}`.toLowerCase().includes(destination)).map(o => structuredClone(o));
}
