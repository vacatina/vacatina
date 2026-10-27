/* ============================================================================
 * Vacatina Visa Destination Catalog & Consular Rules
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.3)
 * ============================================================================ */

import type { VisaRequirementRule, VisaRequirementStatus } from '../domain/visa-search-models.ts';

export interface VisaDestinationItem {
  countryCode: string;
  countryName: string;
  region: 'Middle East' | 'Europe' | 'Asia-Pacific' | 'North America' | 'South Asia' | 'Africa' | 'Americas';
  flagEmoji: string;
  heroImage: string;
  popularFor: string;
  defaultStatus: VisaRequirementStatus;
  statusLabel: string;
  typicalSlaDays: number;
  startingFeeMinor: number;
  currency: string;
}

export const POPULAR_VISA_DESTINATIONS: VisaDestinationItem[] = [
  {
    countryCode: 'AE',
    countryName: 'United Arab Emirates',
    region: 'Middle East',
    flagEmoji: '🇦🇪',
    heroImage: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&auto=format&fit=crop&q=80',
    popularFor: 'Dubai, Abu Dhabi, Desert Safari & Luxury Shopping',
    defaultStatus: 'EVISA_AVAILABLE',
    statusLabel: 'e-Visa Available (Online)',
    typicalSlaDays: 2,
    startingFeeMinor: 3850000, // 38,500 LKR
    currency: 'LKR'
  },
  {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    region: 'Europe',
    flagEmoji: '🇬🇧',
    heroImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&auto=format&fit=crop&q=80',
    popularFor: 'London, Edinburgh, Academic & Family Visits',
    defaultStatus: 'VISA_REQUIRED',
    statusLabel: 'Biometric Visa Required',
    typicalSlaDays: 15,
    startingFeeMinor: 7200000, // 72,000 LKR
    currency: 'LKR'
  },
  {
    countryCode: 'SG',
    countryName: 'Singapore',
    region: 'Asia-Pacific',
    flagEmoji: '🇸🇬',
    heroImage: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&auto=format&fit=crop&q=80',
    popularFor: 'Marina Bay, Sentosa Island, Gardens by the Bay',
    defaultStatus: 'EVISA_AVAILABLE',
    statusLabel: 'e-Visa Authorized Desk',
    typicalSlaDays: 3,
    startingFeeMinor: 2450000, // 24,500 LKR
    currency: 'LKR'
  },
  {
    countryCode: 'IN',
    countryName: 'India',
    region: 'South Asia',
    flagEmoji: '🇮🇳',
    heroImage: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&auto=format&fit=crop&q=80',
    popularFor: 'New Delhi, Chennai, Pilgrimage & Cultural Tours',
    defaultStatus: 'EVISA_AVAILABLE',
    statusLabel: 'Double Entry e-Tourist',
    typicalSlaDays: 3,
    startingFeeMinor: 1650000, // 16,500 LKR
    currency: 'LKR'
  },
  {
    countryCode: 'TH',
    countryName: 'Thailand',
    region: 'Asia-Pacific',
    flagEmoji: '🇹🇭',
    heroImage: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=800&auto=format&fit=crop&q=80',
    popularFor: 'Bangkok, Phuket, Tropical Escapes & Culinary Trips',
    defaultStatus: 'EVISA_AVAILABLE',
    statusLabel: 'e-Visa / VoA Guidance',
    typicalSlaDays: 3,
    startingFeeMinor: 2100000, // 21,000 LKR
    currency: 'LKR'
  },
  {
    countryCode: 'FR',
    countryName: 'France (Schengen Area)',
    region: 'Europe',
    flagEmoji: '🇫🇷',
    heroImage: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&auto=format&fit=crop&q=80',
    popularFor: 'Paris, Côte d’Azur, 29 European Schengen States',
    defaultStatus: 'VISA_REQUIRED',
    statusLabel: 'Schengen Short-Stay VFS',
    typicalSlaDays: 15,
    startingFeeMinor: 6800000, // 68,000 LKR
    currency: 'LKR'
  },
  {
    countryCode: 'JP',
    countryName: 'Japan',
    region: 'Asia-Pacific',
    flagEmoji: '🇯🇵',
    heroImage: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80',
    popularFor: 'Tokyo, Kyoto, Cherry Blossoms & Tech Hubs',
    defaultStatus: 'VISA_REQUIRED',
    statusLabel: 'Consular Visa Support',
    typicalSlaDays: 7,
    startingFeeMinor: 2900000, // 29,000 LKR
    currency: 'LKR'
  },
  {
    countryCode: 'AU',
    countryName: 'Australia',
    region: 'Asia-Pacific',
    flagEmoji: '🇦🇺',
    heroImage: 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?w=800&auto=format&fit=crop&q=80',
    popularFor: 'Sydney, Melbourne, Great Barrier Reef & Family Visits',
    defaultStatus: 'EVISA_AVAILABLE',
    statusLabel: 'Subclass 600 ImmiAccount',
    typicalSlaDays: 18,
    startingFeeMinor: 8900000, // 89,000 LKR
    currency: 'LKR'
  },
  {
    countryCode: 'LK',
    countryName: 'Sri Lanka (Inbound ETA)',
    region: 'South Asia',
    flagEmoji: '🇱🇰',
    heroImage: 'https://images.unsplash.com/photo-1588598198321-9735fd52455b?w=800&auto=format&fit=crop&q=80',
    popularFor: 'Colombo, Sigiriya, Mirissa & Hill Country Safaris',
    defaultStatus: 'EVISA_AVAILABLE',
    statusLabel: 'Inbound 30-Day ETA',
    typicalSlaDays: 1,
    startingFeeMinor: 2200000, // 22,000 LKR
    currency: 'LKR'
  }
];

export function resolveVisaRequirement(citizenshipCode: string, destinationCode: string): VisaRequirementRule {
  const cCode = (citizenshipCode || 'LK').toUpperCase();
  const dCode = (destinationCode || 'AE').toUpperCase();

  const destination = POPULAR_VISA_DESTINATIONS.find(d => d.countryCode === dCode) || {
    countryCode: dCode,
    countryName: destinationCode,
    region: 'Middle East' as const,
    flagEmoji: '🌍',
    heroImage: '',
    popularFor: 'International Travel',
    defaultStatus: 'VISA_REQUIRED' as const,
    statusLabel: 'Consular Visa Required',
    typicalSlaDays: 7,
    startingFeeMinor: 4000000,
    currency: 'LKR'
  };

  // Same country check
  if (cCode === dCode) {
    return {
      destinationCountry: destination.countryName,
      destinationCountryCode: dCode,
      citizenshipCountry: destination.countryName,
      citizenshipCountryCode: cCode,
      status: 'VISA_FREE',
      statusLabel: 'No Visa Required (Citizen)',
      headline: `Citizens of ${destination.countryName} enjoy free entry with a valid national passport.`,
      description: 'You are travelling as a sovereign citizen; no consular visa application or entry authorization is needed.',
      allowedStayDays: 365,
      slaDaysMin: 0,
      slaDaysMax: 0,
      isSupportedByDesk: false
    };
  }

  // Specific rules for Sri Lankan Citizens (LK)
  if (cCode === 'LK') {
    switch (dCode) {
      case 'AE':
        return {
          destinationCountry: 'United Arab Emirates',
          destinationCountryCode: 'AE',
          citizenshipCountry: 'Sri Lanka',
          citizenshipCountryCode: 'LK',
          status: 'EVISA_AVAILABLE',
          statusLabel: 'e-Visa Available (2-3 Days)',
          headline: 'Sri Lankan passport holders require a pre-arranged UAE Tourist or Business e-Visa.',
          description: 'Vacatina handles complete document vetting, GDRFA/ICP portal filing, and delivers the approved electronic visa directly to your email.',
          allowedStayDays: 30,
          slaDaysMin: 2,
          slaDaysMax: 4,
          isSupportedByDesk: true
        };
      case 'GB':
        return {
          destinationCountry: 'United Kingdom',
          destinationCountryCode: 'GB',
          citizenshipCountry: 'Sri Lanka',
          citizenshipCountryCode: 'LK',
          status: 'VISA_REQUIRED',
          statusLabel: 'Biometric Consular Visa Required',
          headline: 'Standard Visitor Visa required with mandatory biometric appointment at VFS Colombo.',
          description: 'Vacatina prepares your complete financial dossier, employment verification, cover letter, and schedules your priority VFS biometric appointment.',
          allowedStayDays: 180,
          slaDaysMin: 12,
          slaDaysMax: 20,
          isSupportedByDesk: true
        };
      case 'SG':
        return {
          destinationCountry: 'Singapore',
          destinationCountryCode: 'SG',
          citizenshipCountry: 'Sri Lanka',
          citizenshipCountryCode: 'LK',
          status: 'EVISA_AVAILABLE',
          statusLabel: 'e-Visa Required (Authorized Desk)',
          headline: 'Singapore Entry Visa must be lodged through an authorized visa agent (SAVE portal).',
          description: 'Vacatina is an authorized document vetting partner. We submit your application through licensed Singapore channels with fast turnaround.',
          allowedStayDays: 30,
          slaDaysMin: 2,
          slaDaysMax: 4,
          isSupportedByDesk: true
        };
      case 'IN':
        return {
          destinationCountry: 'India',
          destinationCountryCode: 'IN',
          citizenshipCountry: 'Sri Lanka',
          citizenshipCountryCode: 'LK',
          status: 'EVISA_AVAILABLE',
          statusLabel: 'Double Entry e-Tourist Visa',
          headline: 'Sri Lankan nationals are eligible for Indian Electronic Travel Authorization (e-Visa).',
          description: 'Valid for 30 days from date of first entry. Double entry permitted. Fast 72-hour online processing.',
          allowedStayDays: 30,
          slaDaysMin: 2,
          slaDaysMax: 4,
          isSupportedByDesk: true
        };
      case 'TH':
        return {
          destinationCountry: 'Thailand',
          destinationCountryCode: 'TH',
          citizenshipCountry: 'Sri Lanka',
          citizenshipCountryCode: 'LK',
          status: 'EVISA_AVAILABLE',
          statusLabel: 'e-Visa Guidance & Royal Thai Consular Vetting',
          headline: 'Tourist visa required prior to arrival or via official e-Visa portal.',
          description: 'Vacatina audits financial solvency proof (USD 700/person), hotel reservations, flight tickets, and submits to Royal Thai Embassy.',
          allowedStayDays: 60,
          slaDaysMin: 3,
          slaDaysMax: 6,
          isSupportedByDesk: true
        };
      case 'FR':
        return {
          destinationCountry: 'France (Schengen)',
          destinationCountryCode: 'FR',
          citizenshipCountry: 'Sri Lanka',
          citizenshipCountryCode: 'LK',
          status: 'VISA_REQUIRED',
          statusLabel: 'Schengen Uniform Type C Visa',
          headline: 'Schengen Area Visa required with biometrics at VFS Global Colombo.',
          description: 'Grants access to 29 European countries. Vacatina compiles your compliant travel insurance, flight itinerary, sponsorship documents, and appointment slot.',
          allowedStayDays: 90,
          slaDaysMin: 15,
          slaDaysMax: 25,
          isSupportedByDesk: true
        };
      case 'JP':
        return {
          destinationCountry: 'Japan',
          destinationCountryCode: 'JP',
          citizenshipCountry: 'Sri Lanka',
          citizenshipCountryCode: 'LK',
          status: 'VISA_REQUIRED',
          statusLabel: 'Tourist Visa Filing Support',
          headline: 'Short-term tourist visa required from Embassy of Japan in Colombo.',
          description: 'Requires day-by-day itinerary schedule, tax clearance, and bank balance certificate. Vacatina vets all schedules for Japanese consular compliance.',
          allowedStayDays: 15,
          slaDaysMin: 5,
          slaDaysMax: 8,
          isSupportedByDesk: true
        };
      default:
        break;
    }
  }

  // General fallback rule
  return {
    destinationCountry: destination.countryName,
    destinationCountryCode: dCode,
    citizenshipCountry: cCode === 'LK' ? 'Sri Lanka' : cCode,
    citizenshipCountryCode: cCode,
    status: destination.defaultStatus,
    statusLabel: destination.statusLabel,
    headline: `Entry authorization required for travel to ${destination.countryName}.`,
    description: `Vacatina Consular Desk coordinates document preparation, application lodgement, and liaison with sovereign visa offices.`,
    allowedStayDays: 30,
    slaDaysMin: destination.typicalSlaDays,
    slaDaysMax: destination.typicalSlaDays + 3,
    isSupportedByDesk: true
  };
}
