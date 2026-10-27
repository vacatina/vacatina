import { journeyConfigurationFromQuery, validateJourneyConfiguration, type JourneyConfiguration } from '../../journeys/domain/journey-models.ts';

export const VISA_DEMO_DISCLOSURE = 'Canonical demo assistance catalog — eligibility is not verified. Fees, checklist and processing examples are not current government advice. Manual review required; visa decisions belong to the relevant authority. No approval is guaranteed.';
let remembered: JourneyConfiguration | null = null;

export function visaContextFromQuery(query: URLSearchParams): JourneyConfiguration {
  const config = journeyConfigurationFromQuery(query);
  config.citizenshipCountry = query.get('citizenship') || config.citizenshipCountry;
  config.adults = Number(query.get('applicants') ?? query.get('adults') ?? 1);
  config.purpose = config.purpose === 'tourist' ? 'tourism' : config.purpose;
  return config;
}
export function validateVisaContext(context: JourneyConfiguration): string[] {
  const errors = Object.values(validateJourneyConfiguration('visa', context));
  if (!['tourism', 'business', 'transit', 'family'].includes(context.purpose)) errors.push('Choose a travel purpose.');
  if (context.departureDate < new Date().toISOString().slice(0, 10)) errors.push('Choose a future travel date.');
  return errors;
}
export function rememberVisaContext(context: JourneyConfiguration): void { remembered = { ...context }; }
export function getVisaContext(): JourneyConfiguration | null { return remembered ? { ...remembered } : null; }
export function visaContextQuery(context: JourneyConfiguration): string {
  return new URLSearchParams({ destination: context.destination, citizenship: context.citizenshipCountry, residenceCountry: context.residenceCountry, purpose: context.purpose, departureDate: context.departureDate, applicants: String(context.adults), children: String(context.children), infants: String(context.infants) }).toString();
}
