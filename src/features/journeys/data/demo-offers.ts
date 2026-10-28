/** Explicit, non-sellable customer DTO fixtures. Never imported by the production supplier registry. */
import type { JourneyOffer, JourneyConfiguration } from '../domain/journey-models.ts';
import { journeyOfferId } from '../domain/journey-models.ts';
import type { TravelProductSlug } from '../../../lib/domain/types.ts';

export const JOURNEY_DEMO_DISCLOSURE = 'Planning reference - no live supplier, availability, reservation or confirmation. This selection is a local planning request only; current price and conditions require operator confirmation.';

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
  }),
  demoOffer('sightseeing', 'London guided sightseeing planning example', 'London', {
    sightseeing: {
      tourType: 'Guided sightseeing request',
      routeDescription: 'Route, stops and departure point have not been supplied. Request the operator itinerary before booking.',
      meetingPointAddress: 'Meeting point to be confirmed by operator',
      timeSlots: [{ id: 'OPERATOR_CONFIRM', label: 'Tour departure time to confirm' }],
      ticketTypes: [{ id: 'GUIDED_TOUR_REQUEST', label: 'Guided tour participant request' }],
      languages: [{ id: 'LANGUAGE_TO_CONFIRM', label: 'Guide language to confirm' }],
      confirmationNotes: 'Guide, language, route, meeting point, admission and tour departure require operator confirmation. No tour slot or guide is assigned.'
    }
  }),
  demoOffer('rails', 'Colombo to Kandy rail planning example', 'Kandy', {
    rail: {
      originStation: 'Colombo', destinationStation: 'Kandy',
      travelClasses: [{ id: 'standard', label: 'Standard class request' }, { id: 'first', label: 'First class request' }],
      confirmationNotes: 'Train number, schedule, fare conditions, class availability and seat assignment are not supplied. Operator confirmation is required; no rail seat is held.'
    }
  }),
  demoOffer('cruises', 'Mediterranean cruise planning example', 'Mediterranean', {
    cruise: {
      cabinCategories: [{ id: 'INTERIOR_REQUEST', label: 'Interior cabin preference · Allocation pending' }, { id: 'BALCONY_REQUEST', label: 'Balcony cabin preference · Allocation pending' }],
      confirmationNotes: 'Ship, sailing, embarkation port, ports of call, itinerary, cabin inventory and fare conditions have not been supplied. This is an operator request, not a cabin reservation.'
    }
  }),
  demoOffer('insurance', 'Travel insurance comparison request example', 'Worldwide', {
    insurance: {
      coverageOptions: [{ id: 'POLICY_REVIEW', label: 'Request actual policy wording and eligibility review' }],
      confirmationNotes: 'No insurer, coverage, limits, policy wording, exclusions, premium or eligibility decision is supplied by this fixture. No insurance cover is in force and no policy is issued.'
    }
  })
];

export function getDemoJourneyOffer(id: string): JourneyOffer | null {
  const offer = JOURNEY_DEMO_OFFERS.find(o => journeyOfferId(o) === id);
  return offer ? structuredClone(offer) : null;
}
export function searchDemoJourneyOffers(product: TravelProductSlug, configuration: JourneyConfiguration): JourneyOffer[] {
  const destination = configuration.destination.toLowerCase().trim();
  return JOURNEY_DEMO_OFFERS.filter(o => {
    if (o.productType !== product || !destination || !`${o.location?.city || ''} ${o.location?.country || ''}`.toLowerCase().includes(destination)) return false;
    if (product === 'rails') {
      const rail = o.productExtension?.rail as Record<string, unknown> | undefined;
      if (String(rail?.originStation || '').toLowerCase() !== configuration.origin.toLowerCase().trim()) return false;
    }
    return true;
  }).map(o => structuredClone(o));
}
