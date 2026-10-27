/* ============================================================================
 * Vacatina Direct Consular Assistance Services Catalog
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.3)
 *
 * Invariants:
 * 1. Inventory source: MANUAL (Vacatina Consular Concierge Desk).
 * 2. isPinnedAboveApi: true (Direct consular advisory prioritized above third-party aggregators).
 * 3. isSeed: false (Strict SEED quarantine; real operational assistance contracts).
 * 4. Transparent pricing breakdown (Embassy fee + Vacatina Concierge fee).
 * ============================================================================ */

import type { CanonicalVisaOffer, DocumentChecklistItem } from '../domain/visa-models.ts';

const STANDARD_IDENTITY_DOCS: DocumentChecklistItem[] = [
  {
    id: 'doc-passport-bio',
    title: 'Passport Bio-Data Page',
    description: 'Clear color scan of passport information page valid for at least 6 months with 2 blank pages.',
    isRequired: true,
    acceptedFormats: 'PDF, JPG, PNG (Max 5MB)',
    category: 'IDENTITY'
  },
  {
    id: 'doc-photo',
    title: 'Recent Digital Photograph',
    description: 'Color studio photograph (35x45mm) taken within the last 3 months against a plain white background.',
    isRequired: true,
    acceptedFormats: 'JPG, PNG (Max 3MB)',
    category: 'IDENTITY'
  }
];

const STANDARD_TRAVEL_DOCS: DocumentChecklistItem[] = [
  {
    id: 'doc-flight-ticket',
    title: 'Confirmed Return Flight Ticket',
    description: 'Confirmed round-trip flight booking with flight numbers, dates, and passenger name matching passport.',
    isRequired: true,
    acceptedFormats: 'PDF (Max 5MB)',
    category: 'TRAVEL'
  },
  {
    id: 'doc-hotel-voucher',
    title: 'Proof of Accommodation / Hotel Voucher',
    description: 'Confirmed hotel reservations covering the entire duration of stay in the destination country.',
    isRequired: true,
    acceptedFormats: 'PDF (Max 5MB)',
    category: 'TRAVEL'
  }
];

export const MANUAL_VISA_SERVICES: CanonicalVisaOffer[] = [
  // 1. UAE 30-Day Tourist e-Visa
  {
    visaId: 'vs-ae-tourist-30d',
    canonicalOfferId: 'vct-vs-consular-ae-30d',
    sourceType: 'MANUAL',
    providerId: 'VACATINA_CONSULAR_DESK',
    supplierName: 'Vacatina Consular Advisory Service',
    countryName: 'United Arab Emirates',
    countryCode: 'AE',
    region: 'Middle East',
    title: 'UAE 30-Day Tourist e-Visa Assistance',
    subtitle: 'Direct GDRFA / ICP Government Lodgement · Express 48-Hour Processing',
    description: 'Full-service electronic visa assistance for leisure travel to Dubai, Abu Dhabi, and the Northern Emirates. Includes automated document verification, immigration security pre-screening, and instant electronic issuance.',
    category: 'TOURIST_EVISA',
    entryType: 'SINGLE_ENTRY',
    durationDays: 30,
    validityDescription: 'Valid for 60 days from date of issuance',
    maxStayDescription: 'Permitted stay of up to 30 days',
    processingSlaBusinessDays: 2,
    expressAvailable: true,
    heroImage: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&auto=format&fit=crop&q=80',
    flagEmoji: '🇦🇪',
    pricing: {
      embassyFeeMinor: 2600000,          // 26,000 LKR official GDRFA fee
      vacatinaConciergeFeeMinor: 1250000,// 12,500 LKR concierge vetting
      taxMinor: 0,
      totalPriceMinor: 3850000,          // 38,500 LKR total
      currency: 'LKR'
    },
    documentChecklist: [
      ...STANDARD_IDENTITY_DOCS,
      ...STANDARD_TRAVEL_DOCS
    ],
    consularSteps: [
      'Document Audit: Vacatina specialist verifies passport clarity and photo specs within 3 hours.',
      'GDRFA Filing: Application lodged directly into the Dubai immigration clearance portal.',
      'Immigration Vetting: Official UAE security clearance review (typically 24 to 48 hours).',
      'Electronic Delivery: Approved PDF e-Visa with authentic QR code dispatched to your inbox.'
    ],
    importantNotes: [
      'Passport must have at least 6 months validity from the planned date of departure.',
      'Overstay fines in the UAE accrue daily at official sovereign government rates.',
      'Vacatina does not issue visas; sovereign approval remains solely with UAE General Directorate of Residency and Foreigners Affairs.'
    ],
    isPinnedAboveApi: true,
    isSeed: false,
    availabilityStatus: 'AVAILABLE',
    lastCheckedAt: '2026-10-26T00:00:00Z',
    validUntil: '2026-12-31T23:59:59Z'
  },

  // 2. UAE 60-Day Tourist e-Visa
  {
    visaId: 'vs-ae-tourist-60d',
    canonicalOfferId: 'vct-vs-consular-ae-60d',
    sourceType: 'MANUAL',
    providerId: 'VACATINA_CONSULAR_DESK',
    supplierName: 'Vacatina Consular Advisory Service',
    countryName: 'United Arab Emirates',
    countryCode: 'AE',
    region: 'Middle East',
    title: 'UAE 60-Day Extended Tourist e-Visa',
    subtitle: 'Extended Vacation & Family Visit Visa · Single Entry Clearance',
    description: 'Designed for travellers planning a prolonged holiday, family gathering, or exploring residence opportunities across the United Arab Emirates. Full application management and extension advisories included.',
    category: 'TOURIST_EVISA',
    entryType: 'SINGLE_ENTRY',
    durationDays: 60,
    validityDescription: 'Valid for 60 days from date of issuance',
    maxStayDescription: 'Permitted stay of up to 60 consecutive days',
    processingSlaBusinessDays: 3,
    expressAvailable: true,
    heroImage: 'https://images.unsplash.com/photo-1546412414-e1885259563a?w=800&auto=format&fit=crop&q=80',
    flagEmoji: '🇦🇪',
    pricing: {
      embassyFeeMinor: 4800000,
      vacatinaConciergeFeeMinor: 1650000,
      taxMinor: 0,
      totalPriceMinor: 6450000, // 64,500 LKR
      currency: 'LKR'
    },
    documentChecklist: [
      ...STANDARD_IDENTITY_DOCS,
      ...STANDARD_TRAVEL_DOCS,
      {
        id: 'doc-relative-id',
        title: 'UAE Host / Relative Emirates ID (Optional)',
        description: 'If staying with family or friends in the UAE, provide a copy of their resident Emirates ID.',
        isRequired: false,
        acceptedFormats: 'PDF, JPG (Max 5MB)',
        category: 'INVITATION'
      }
    ],
    consularSteps: [
      'Document Audit & Eligibility Assessment by senior visa manager.',
      'Sovereign ICP/GDRFA lodgement and fee payment.',
      'Security vetting and bio-verification.',
      'Issuance of official 60-day tourist entry permit.'
    ],
    importantNotes: [
      'Single entry visa: exiting the UAE immediately invalidates the remaining days of the permit.'
    ],
    isPinnedAboveApi: true,
    isSeed: false,
    availabilityStatus: 'AVAILABLE',
    lastCheckedAt: '2026-10-26T00:00:00Z',
    validUntil: '2026-12-31T23:59:59Z'
  },

  // 3. UAE Business / Commercial Entry Visa
  {
    visaId: 'vs-ae-biz-30d',
    canonicalOfferId: 'vct-vs-consular-ae-biz',
    sourceType: 'MANUAL',
    providerId: 'VACATINA_CONSULAR_DESK',
    supplierName: 'Vacatina Consular Advisory Service',
    countryName: 'United Arab Emirates',
    countryCode: 'AE',
    region: 'Middle East',
    title: 'UAE 30-Day Business & Investor Entry Visa',
    subtitle: 'Commercial Conferences, Trade Delegations & Company Formation',
    description: 'Priority corporate visa filing for entrepreneurs, trade delegates, and corporate executives attending summits or conducting commercial negotiations in the UAE.',
    category: 'BUSINESS_VISA',
    entryType: 'SINGLE_ENTRY',
    durationDays: 30,
    validityDescription: 'Valid for 60 days from issuance',
    maxStayDescription: '30 days entry permit',
    processingSlaBusinessDays: 2,
    expressAvailable: true,
    heroImage: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800&auto=format&fit=crop&q=80',
    flagEmoji: '🇦🇪',
    pricing: {
      embassyFeeMinor: 3500000,
      vacatinaConciergeFeeMinor: 2000000,
      taxMinor: 0,
      totalPriceMinor: 5500000, // 55,000 LKR
      currency: 'LKR'
    },
    documentChecklist: [
      ...STANDARD_IDENTITY_DOCS,
      ...STANDARD_TRAVEL_DOCS,
      {
        id: 'doc-company-invitation',
        title: 'UAE Sponsor / Host Company Invitation Letter',
        description: 'Official letter on UAE company letterhead outlining the purpose of visit, dates, and contact details.',
        isRequired: true,
        acceptedFormats: 'PDF (Max 5MB)',
        category: 'INVITATION'
      },
      {
        id: 'doc-employer-letter',
        title: 'Employer Deputation Letter / Trade Registration',
        description: 'Letter from current employer confirming position and purpose, or business registration certificate.',
        isRequired: true,
        acceptedFormats: 'PDF (Max 5MB)',
        category: 'OCCUPATIONAL'
      }
    ],
    consularSteps: [
      'Commercial documentation vetting and invitation letter compliance check.',
      'Expedited business channel lodgement via UAE commercial immigration registry.',
      'Immigration authority clearance.',
      'Delivery of verified commercial entry permit.'
    ],
    importantNotes: [
      'Does not permit employment or receipt of remuneration from a UAE entity.'
    ],
    isPinnedAboveApi: true,
    isSeed: false,
    availabilityStatus: 'AVAILABLE',
    lastCheckedAt: '2026-10-26T00:00:00Z',
    validUntil: '2026-12-31T23:59:59Z'
  },

  // 4. UK Standard Visitor Visa Assistance
  {
    visaId: 'vs-uk-visitor-6m',
    canonicalOfferId: 'vct-vs-consular-uk-6m',
    sourceType: 'MANUAL',
    providerId: 'VACATINA_CONSULAR_DESK',
    supplierName: 'Vacatina Consular Advisory Service',
    countryName: 'United Kingdom',
    countryCode: 'GB',
    region: 'Europe',
    title: 'UK Standard Visitor Visa Filing & Biometric Vetting',
    subtitle: '6-Month Multiple Entry · VFS Colombo Priority Appointment Coordination',
    description: 'Comprehensive consular preparation for UK tourism, family visits, or business meetings. Includes UKVI portal application completion, financial solvency audit, cover letter drafting, document uploading, and VFS Colombo biometric booking.',
    category: 'STICKER_VISA',
    entryType: 'MULTIPLE_ENTRY',
    durationDays: 180,
    validityDescription: 'Valid for 6 months (Multiple Entry)',
    maxStayDescription: 'Up to 180 days cumulative',
    processingSlaBusinessDays: 15,
    expressAvailable: true,
    heroImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&auto=format&fit=crop&q=80',
    flagEmoji: '🇬🇧',
    pricing: {
      embassyFeeMinor: 4800000,          // Approx UKVI £115 consular fee
      vacatinaConciergeFeeMinor: 2400000,// Document curation & VFS slot concierge
      taxMinor: 0,
      totalPriceMinor: 7200000,          // 72,000 LKR total
      currency: 'LKR'
    },
    documentChecklist: [
      ...STANDARD_IDENTITY_DOCS,
      ...STANDARD_TRAVEL_DOCS,
      {
        id: 'doc-bank-statements',
        title: '6 Months Certified Bank Statements',
        description: 'Original bank statements stamped by the bank with proof of regular income and sufficient funds.',
        isRequired: true,
        acceptedFormats: 'PDF (Max 10MB)',
        category: 'FINANCIAL'
      },
      {
        id: 'doc-employment-proof',
        title: 'Employment Letter & Leave Approval',
        description: 'Letter on company letterhead confirming designation, salary, date of joining, and approved leave dates.',
        isRequired: true,
        acceptedFormats: 'PDF (Max 5MB)',
        category: 'OCCUPATIONAL'
      },
      {
        id: 'doc-tax-returns',
        title: 'Personal Tax Returns / Property Deeds (Optional)',
        description: 'Recent TIN/IRAS income tax returns or local property documents demonstrating ties to Sri Lanka.',
        isRequired: false,
        acceptedFormats: 'PDF (Max 10MB)',
        category: 'FINANCIAL'
      }
    ],
    consularSteps: [
      'Comprehensive Consultation: Case review with UK consular specialist to evaluate financial eligibility.',
      'UKVI Portal Filing: Accurate completion of the official UK Visas and Immigration application form.',
      'Evidence Upload & Review: High-resolution scanning and categorized indexing of all supporting documents.',
      'VFS Biometric Coordination: Securing preferred biometric appointment date at VFS Global Colombo.',
      'Post-Submission Tracking: Real-time passport dispatch telemetry until safe return.'
    ],
    importantNotes: [
      'Applicants must attend the VFS Colombo biometric appointment in person for fingerprints and photo.',
      'Visa fees paid to UKVI are non-refundable once biometrics are submitted.',
      'Standard turnaround is 15 working days; priority 5-day service available at additional consular fee.'
    ],
    isPinnedAboveApi: true,
    isSeed: false,
    availabilityStatus: 'AVAILABLE',
    lastCheckedAt: '2026-10-26T00:00:00Z',
    validUntil: '2026-12-31T23:59:59Z'
  },

  // 5. Singapore 30-Day Tourist e-Visa Application
  {
    visaId: 'vs-sg-tourist-30d',
    canonicalOfferId: 'vct-vs-consular-sg-30d',
    sourceType: 'MANUAL',
    providerId: 'VACATINA_CONSULAR_DESK',
    supplierName: 'Vacatina Consular Advisory Service',
    countryName: 'Singapore',
    countryCode: 'SG',
    region: 'Asia-Pacific',
    title: 'Singapore 30-Day Tourist e-Visa Lodgement',
    subtitle: 'Official SAVE Portal Submission · Authorized Strategic Agent Channel',
    description: 'Immigration & Checkpoints Authority (ICA) Singapore e-Visa application managed through authorized travel desk. High approval success rate with swift 72-hour electronic delivery.',
    category: 'TOURIST_EVISA',
    entryType: 'SINGLE_ENTRY',
    durationDays: 30,
    validityDescription: 'Valid 30 to 60 days from date of grant',
    maxStayDescription: 'Stay duration determined by ICA upon entry (up to 30 days)',
    processingSlaBusinessDays: 3,
    expressAvailable: false,
    heroImage: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&auto=format&fit=crop&q=80',
    flagEmoji: '🇸🇬',
    pricing: {
      embassyFeeMinor: 1100000, // SGD 30 official ICA fee
      vacatinaConciergeFeeMinor: 1350000,
      taxMinor: 0,
      totalPriceMinor: 2450000, // 24,500 LKR
      currency: 'LKR'
    },
    documentChecklist: [
      ...STANDARD_IDENTITY_DOCS,
      ...STANDARD_TRAVEL_DOCS,
      {
        id: 'doc-ica-form-14a',
        title: 'Form 14A Signed Application',
        description: 'Completed and physically signed ICA Form 14A (Vacatina generates prefilled form for you).',
        isRequired: true,
        acceptedFormats: 'PDF (Max 5MB)',
        category: 'IDENTITY'
      }
    ],
    consularSteps: [
      'Pre-filing compliance check of passport clarity and background photo specifications.',
      'Lodgement on Singapore Immigration SAVE electronic system.',
      'ICA security and border control review.',
      'Approved electronic visa dispatched in printable PDF format.'
    ],
    importantNotes: [
      'Singapore requires all travellers to submit the Singapore Arrival Card (SGAC) within 3 days before arrival.'
    ],
    isPinnedAboveApi: true,
    isSeed: false,
    availabilityStatus: 'AVAILABLE',
    lastCheckedAt: '2026-10-26T00:00:00Z',
    validUntil: '2026-12-31T23:59:59Z'
  },

  // 6. India 30-Day Double Entry e-Tourist Visa
  {
    visaId: 'vs-in-tourist-30d',
    canonicalOfferId: 'vct-vs-consular-in-30d',
    sourceType: 'MANUAL',
    providerId: 'VACATINA_CONSULAR_DESK',
    supplierName: 'Vacatina Consular Advisory Service',
    countryName: 'India',
    countryCode: 'IN',
    region: 'South Asia',
    title: 'India 30-Day Double Entry e-Tourist Visa',
    subtitle: 'Indian Bureau of Immigration eVisa · 72-Hour Rapid Processing',
    description: 'Hassle-free electronic tourist visa assistance for pilgrimages, leisure trips, and family travel to India. Allows two separate entries within the 30-day validity window.',
    category: 'TOURIST_EVISA',
    entryType: 'DOUBLE_ENTRY',
    durationDays: 30,
    validityDescription: 'Valid 30 days starting from the date of first entry into India',
    maxStayDescription: '30 days total duration',
    processingSlaBusinessDays: 3,
    expressAvailable: true,
    heroImage: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&auto=format&fit=crop&q=80',
    flagEmoji: '🇮🇳',
    pricing: {
      embassyFeeMinor: 750000,
      vacatinaConciergeFeeMinor: 900000,
      taxMinor: 0,
      totalPriceMinor: 1650000, // 16,500 LKR
      currency: 'LKR'
    },
    documentChecklist: [
      ...STANDARD_IDENTITY_DOCS,
      ...STANDARD_TRAVEL_DOCS
    ],
    consularSteps: [
      'Verification of passport specifications and square aspect ratio photograph.',
      'Filing with the Indian Government e-Visa portal.',
      'Bureau of Immigration vetting and clearance.',
      'Delivery of Electronic Travel Authorization (ETA) confirmation document.'
    ],
    importantNotes: [
      'Arrival allowed at 31 designated international airports and 5 major seaports across India.'
    ],
    isPinnedAboveApi: true,
    isSeed: false,
    availabilityStatus: 'AVAILABLE',
    lastCheckedAt: '2026-10-26T00:00:00Z',
    validUntil: '2026-12-31T23:59:59Z'
  },

  // 7. France & Schengen 90-Day Short Stay VFS Dossier
  {
    visaId: 'vs-fr-schengen-90d',
    canonicalOfferId: 'vct-vs-consular-fr-schengen',
    sourceType: 'MANUAL',
    providerId: 'VACATINA_CONSULAR_DESK',
    supplierName: 'Vacatina Consular Advisory Service',
    countryName: 'France (Schengen Area)',
    countryCode: 'FR',
    region: 'Europe',
    title: 'France & Schengen 90-Day Short-Stay Visa Dossier',
    subtitle: 'Access 29 Schengen Countries · VFS Colombo Biometric Preparation',
    description: 'Expert consular dossier compilation for travel to France, Germany, Italy, Switzerland, and 25 other Schengen nations. Complete guidance on EUR 30,000 compliant travel insurance, detailed day-by-day itineraries, flight reservations, and financial proofs.',
    category: 'STICKER_VISA',
    entryType: 'MULTIPLE_ENTRY',
    durationDays: 90,
    validityDescription: 'Determined by Embassy (typically 90 to 180 days)',
    maxStayDescription: 'Up to 90 days within any 180-day rolling period',
    processingSlaBusinessDays: 15,
    expressAvailable: false,
    heroImage: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&auto=format&fit=crop&q=80',
    flagEmoji: '🇫🇷',
    pricing: {
      embassyFeeMinor: 4200000,          // EUR 90 official Schengen consular fee
      vacatinaConciergeFeeMinor: 2600000,// Complete dossier assembly & cover letter drafting
      taxMinor: 0,
      totalPriceMinor: 6800000,          // 68,000 LKR total
      currency: 'LKR'
    },
    documentChecklist: [
      ...STANDARD_IDENTITY_DOCS,
      ...STANDARD_TRAVEL_DOCS,
      {
        id: 'doc-schengen-insurance',
        title: 'EUR 30,000 Compliant Travel Medical Insurance',
        description: 'Mandatory travel medical insurance covering repatriation and medical expenses throughout the Schengen area.',
        isRequired: true,
        acceptedFormats: 'PDF (Max 5MB)',
        category: 'TRAVEL'
      },
      {
        id: 'doc-bank-statements',
        title: '3-6 Months Certified Bank Statements',
        description: 'Recent bank statements showing sufficient funds (min EUR 65 per day of stay) with official bank seal.',
        isRequired: true,
        acceptedFormats: 'PDF (Max 10MB)',
        category: 'FINANCIAL'
      },
      {
        id: 'doc-cover-letter',
        title: 'Personal Cover Letter & Travel Schedule',
        description: 'Detailed statement of purpose, accommodation addresses, and daily itinerary schedule (Vacatina drafts this with you).',
        isRequired: true,
        acceptedFormats: 'PDF (Max 5MB)',
        category: 'TRAVEL'
      }
    ],
    consularSteps: [
      'Initial consultation: Assessing main destination country and itinerary harmony under Schengen rules.',
      'Dossier compilation: Curating cover letters, verified flight itineraries, and hotel vouchers.',
      'Appointment scheduling: Securing the earliest biometric slot at VFS Global Colombo.',
      'Mock interview & document orientation prior to attending VFS.',
      'Post-biometric embassy processing and tracking.'
    ],
    importantNotes: [
      'Application must be lodged at the embassy of the country that constitutes your main destination in terms of length of stay.'
    ],
    isPinnedAboveApi: true,
    isSeed: false,
    availabilityStatus: 'AVAILABLE',
    lastCheckedAt: '2026-10-26T00:00:00Z',
    validUntil: '2026-12-31T23:59:59Z'
  },

  // 8. Sri Lanka 30-Day Inbound ETA Concierge
  {
    visaId: 'vs-lk-inbound-eta',
    canonicalOfferId: 'vct-vs-consular-lk-eta',
    sourceType: 'MANUAL',
    providerId: 'VACATINA_CONSULAR_DESK',
    supplierName: 'Vacatina Consular Advisory Service',
    countryName: 'Sri Lanka (Inbound ETA)',
    countryCode: 'LK',
    region: 'South Asia',
    title: 'Sri Lanka 30-Day Inbound Tourist ETA Concierge',
    subtitle: 'Electronic Travel Authorization for Foreign Tourists & Diaspora',
    description: 'Rapid inbound visa concierge for international travelers visiting Sri Lanka for tourism, holidays, medical wellness, or short business trips. Instant processing with government-approved receipt.',
    category: 'ETA',
    entryType: 'DOUBLE_ENTRY',
    durationDays: 30,
    validityDescription: 'Valid for 180 days from date of issue',
    maxStayDescription: '30 days initial stay (extendable at Department of Immigration Colombo)',
    processingSlaBusinessDays: 1,
    expressAvailable: true,
    heroImage: 'https://images.unsplash.com/photo-1588598198321-9735fd52455b?w=800&auto=format&fit=crop&q=80',
    flagEmoji: '🇱🇰',
    pricing: {
      embassyFeeMinor: 1500000,
      vacatinaConciergeFeeMinor: 700000,
      taxMinor: 0,
      totalPriceMinor: 2200000, // 22,000 LKR
      currency: 'LKR'
    },
    documentChecklist: [
      ...STANDARD_IDENTITY_DOCS,
      ...STANDARD_TRAVEL_DOCS
    ],
    consularSteps: [
      'Fast-track passport and bio-data review.',
      'Direct lodgement with the Department of Immigration & Emigration Sri Lanka.',
      'Automated border security clearance.',
      'ETA issuance notice sent with official QR barcode.'
    ],
    importantNotes: [
      'For inbound foreign passport holders only; Sri Lankan dual citizens or passport holders do not require an ETA.'
    ],
    isPinnedAboveApi: true,
    isSeed: false,
    availabilityStatus: 'AVAILABLE',
    lastCheckedAt: '2026-10-26T00:00:00Z',
    validUntil: '2026-12-31T23:59:59Z'
  }
];
