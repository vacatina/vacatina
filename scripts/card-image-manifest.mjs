/* ============================================================================
 * Vacatina Canonical 40-Card Image Manifest (scripts/card-image-manifest.mjs)
 *
 * Authorities:
 * 1. VACATINA — COMPLETE API-POWERED 40 IMAGE GENERATION MASTER INSTRUCTION
 * 2. Sections 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18
 *
 * Structure per entry:
 * - id: unique string identifier
 * - category: product category (flights, visa, packages, hotels, activities, sightseeing, cars-transfers, cruises, rails, insurance)
 * - destination: destination or scenario context
 * - filename: final production WebP filename
 * - alt: customer-facing accessible alt text
 * - subjectPrompt: core subject art direction
 * ============================================================================ */

export const MASTER_ART_DIRECTION =
  'Premium international travel editorial photography for a world-class OTA. Photorealistic, believable real-world scene, natural daylight or authentic golden-hour light, realistic architecture, realistic vehicles and realistic people, subtle sophisticated color grading, restrained saturation, strong photographic composition, premium travel-magazine quality, natural depth, no fantasy styling. Landscape composition designed for a 5:3 travel card with the primary subject inside the central safe area and sufficient breathing room around edges.';

export const MASTER_NEGATIVE_PROMPT =
  'No text, no captions, no typography, no logos, no watermark, no UI, no badge, no price, no brand names, no fabricated signage, no malformed architecture, no distorted faces, no extra limbs, no surreal objects, no excessive HDR, no neon AI aesthetic, no fake airline liveries.';

export const CARD_IMAGE_MANIFEST = [
  // --- BATCH 1: FLIGHTS (01 - 04) ---
  {
    id: 'flight-dubai',
    category: 'flights',
    destination: 'Dubai, UAE',
    filename: 'flight-dubai.webp',
    alt: 'Dubai skyline with Burj Khalifa',
    subjectPrompt:
      'Dubai, United Arab Emirates, premium panoramic city travel photograph with Burj Khalifa and modern Downtown Dubai skyline in authentic golden-hour light, sophisticated international travel editorial composition. If a commercial passenger aircraft can appear naturally and realistically in the distant sky, include it subtly; otherwise prioritize the authentic Dubai skyline.'
  },
  {
    id: 'flight-male',
    category: 'flights',
    destination: 'Maldives',
    filename: 'flight-male.webp',
    alt: 'Aerial view of Maldives islands and turquoise lagoons',
    subjectPrompt:
      'Aerial travel photograph of the Maldives, brilliant but natural turquoise Indian Ocean water, coral atolls, small tropical islands and elegant resort context, authentic aerial perspective, premium international destination photography. A distant seaplane may appear only if completely natural.'
  },
  {
    id: 'flight-bangkok',
    category: 'flights',
    destination: 'Bangkok, Thailand',
    filename: 'flight-bangkok.webp',
    alt: 'Bangkok skyline and Chao Phraya River',
    subjectPrompt:
      'Authentic Bangkok, Thailand city travel photography with Chao Phraya River and recognizable urban or temple skyline, warm natural evening light, sophisticated city-destination editorial composition, realistic atmosphere.'
  },
  {
    id: 'flight-london',
    category: 'flights',
    destination: 'London, UK',
    filename: 'flight-london.webp',
    alt: 'London skyline beside the River Thames',
    subjectPrompt:
      'Premium authentic London destination photography showing River Thames with Westminster, Tower Bridge, or another unmistakably London city composition, natural atmospheric light, world-class travel editorial photography.'
  },

  // --- BATCH 2: VISA ASSISTANCE (05 - 08) ---
  {
    id: 'visa-uae',
    category: 'visa',
    destination: 'Dubai, UAE',
    filename: 'visa-uae.webp',
    alt: 'Dubai skyline in the United Arab Emirates',
    subjectPrompt:
      'Elegant authentic UAE destination photography, sophisticated Dubai architecture and skyline, premium clean travel editorial image appropriate for UAE travel planning and visa-assistance context, calm trustworthy mood.'
  },
  {
    id: 'visa-uk',
    category: 'visa',
    destination: 'London, UK',
    filename: 'visa-uk.webp',
    alt: 'London destination view in the United Kingdom',
    subjectPrompt:
      'Elegant authentic London and United Kingdom destination photography, Westminster and Thames or another unmistakable London composition, refined natural travel-editorial atmosphere appropriate for visitor travel planning.'
  },
  {
    id: 'visa-thailand',
    category: 'visa',
    destination: 'Bangkok, Thailand',
    filename: 'visa-thailand.webp',
    alt: 'Thailand heritage destination',
    subjectPrompt:
      'Authentic Thailand destination photography, elegant Bangkok heritage architecture or refined Thai cultural destination environment, natural sunlight, sophisticated premium travel editorial style.'
  },
  {
    id: 'visa-singapore',
    category: 'visa',
    destination: 'Singapore',
    filename: 'visa-singapore.webp',
    alt: 'Singapore Marina Bay skyline',
    subjectPrompt:
      'Authentic Singapore destination photography featuring Marina Bay skyline or another unmistakable Singapore cityscape, clean architectural lines, natural daylight, premium international travel editorial photography.'
  },

  // --- BATCH 3: HOLIDAY PACKAGES (09 - 12) ---
  {
    id: 'package-maldives',
    category: 'packages',
    destination: 'Maldives',
    filename: 'package-maldives.webp',
    alt: 'Luxury Maldives island holiday',
    subjectPrompt:
      'Exceptional luxury Maldives holiday photography, crystal-clear turquoise lagoon, pristine white sand, tasteful overwater villas and tropical island resort atmosphere, premium aspirational travel-magazine quality, natural sunlight.'
  },
  {
    id: 'package-dubai',
    category: 'packages',
    destination: 'Dubai, UAE',
    filename: 'package-dubai.webp',
    alt: 'Luxury Dubai city holiday atmosphere',
    subjectPrompt:
      'Premium Dubai leisure holiday atmosphere, impressive skyline combined naturally with elegant waterfront or luxury leisure environment, refined city-break mood, aspirational but realistic travel editorial photography.'
  },
  {
    id: 'package-bali',
    category: 'packages',
    destination: 'Bali, Indonesia',
    filename: 'package-bali.webp',
    alt: 'Tropical Bali holiday landscape',
    subjectPrompt:
      'Authentic premium Bali holiday photography, lush tropical greenery, traditional Balinese landscape or temple architecture, refined resort or rice-terrace atmosphere, natural soft sunlight, sophisticated travel editorial style.'
  },
  {
    id: 'package-thailand',
    category: 'packages',
    destination: 'Phang Nga / Thailand',
    filename: 'package-thailand.webp',
    alt: 'Thailand tropical island holiday',
    subjectPrompt:
      'Premium Thailand leisure holiday photography with dramatic tropical coastal scenery, limestone islands, clear blue-green water and authentic Thai destination atmosphere, natural travel-magazine quality.'
  },

  // --- BATCH 4: HOTELS & STAYS (13 - 16) ---
  {
    id: 'hotel-maldives',
    category: 'hotels',
    destination: 'Maldives',
    filename: 'hotel-maldives.webp',
    alt: 'Luxury Maldives resort accommodation',
    subjectPrompt:
      'Luxury representative Maldives beachfront or overwater resort accommodation, elegant villa architecture, tranquil lagoon, tasteful premium hospitality photography, realistic natural resort environment.'
  },
  {
    id: 'hotel-dubai',
    category: 'hotels',
    destination: 'Dubai, UAE',
    filename: 'hotel-dubai.webp',
    alt: 'Luxury hotel stay in Dubai',
    subjectPrompt:
      'Representative luxury Dubai hotel environment, elegant modern architecture, sophisticated room terrace or resort pool with believable Dubai city context, premium hospitality editorial photography.'
  },
  {
    id: 'hotel-srilanka',
    category: 'hotels',
    destination: 'Sri Lanka',
    filename: 'hotel-srilanka.webp',
    alt: 'Premium resort stay in Sri Lanka',
    subjectPrompt:
      'Representative premium Sri Lankan resort, elegant tropical hospitality architecture, lush natural surroundings, pool or coastal/hill-country atmosphere, warm authentic Sri Lankan travel photography.'
  },
  {
    id: 'hotel-bali',
    category: 'hotels',
    destination: 'Bali, Indonesia',
    filename: 'hotel-bali.webp',
    alt: 'Luxury tropical villa in Bali',
    subjectPrompt:
      'Representative luxury Bali villa or boutique resort, tropical greenery, private pool, beautiful natural materials and calm sophisticated hospitality atmosphere, photorealistic.'
  },

  // --- BATCH 5: ACTIVITIES (17 - 20) ---
  {
    id: 'activity-snorkelling',
    category: 'activities',
    destination: 'Maldives',
    filename: 'activity-snorkelling.webp',
    alt: 'Travelers snorkeling over a tropical coral reef',
    subjectPrompt:
      'Authentic underwater travel photography of travelers snorkeling above a healthy tropical coral reef in the Maldives, realistic water, marine life and human proportions, natural underwater light, premium adventure editorial photography.'
  },
  {
    id: 'activity-desert-safari',
    category: 'activities',
    destination: 'Dubai, UAE',
    filename: 'activity-desert-safari.webp',
    alt: 'Four-wheel-drive desert safari in Dubai',
    subjectPrompt:
      'Authentic Dubai desert safari action photography, realistic 4x4 vehicle driving dynamically across natural golden sand dunes, tasteful dust trail, dramatic but believable late-afternoon light.'
  },
  {
    id: 'activity-wildlife',
    category: 'activities',
    destination: 'Sri Lanka',
    filename: 'activity-wildlife.webp',
    alt: 'Wildlife safari with elephants in Sri Lanka',
    subjectPrompt:
      'Authentic Sri Lankan wildlife safari photography, safari vehicle observing wild elephants in a genuine national-park landscape, respectful distance, lush natural setting, premium wildlife travel photography.'
  },
  {
    id: 'activity-culinary',
    category: 'activities',
    destination: 'Bali / Southeast Asia',
    filename: 'activity-culinary.webp',
    alt: 'Hands-on local culinary experience',
    subjectPrompt:
      'Authentic hands-on Balinese or Southeast Asian cooking experience, traveler and local culinary host preparing colorful fresh ingredients in a beautiful natural kitchen environment, candid documentary travel photography.'
  },

  // --- BATCH 6: SIGHTSEEING (21 - 24) ---
  {
    id: 'sightseeing-dubai',
    category: 'sightseeing',
    destination: 'Dubai, UAE',
    filename: 'sightseeing-dubai.webp',
    alt: 'Burj Khalifa and Downtown Dubai',
    subjectPrompt:
      'Authentic Downtown Dubai sightseeing photography centered on Burj Khalifa and surrounding city architecture, elegant daytime or golden-hour composition, realistic city atmosphere.'
  },
  {
    id: 'sightseeing-bangkok',
    category: 'sightseeing',
    destination: 'Bangkok, Thailand',
    filename: 'sightseeing-bangkok.webp',
    alt: 'Historic Bangkok temple and heritage architecture',
    subjectPrompt:
      'Authentic Bangkok sightseeing photography featuring Grand Palace, Wat Arun, or another major historic landmark, beautiful natural light and accurate Thai architectural detail.'
  },
  {
    id: 'sightseeing-london',
    category: 'sightseeing',
    destination: 'London, UK',
    filename: 'sightseeing-london.webp',
    alt: 'Historic London landmarks',
    subjectPrompt:
      'Authentic London sightseeing photograph featuring Westminster, Big Ben, Tower Bridge or Thames landmark composition, sophisticated real-world city travel photography.'
  },
  {
    id: 'sightseeing-singapore',
    category: 'sightseeing',
    destination: 'Singapore',
    filename: 'sightseeing-singapore.webp',
    alt: 'Gardens by the Bay in Singapore',
    subjectPrompt:
      'Authentic Singapore sightseeing photography featuring Gardens by the Bay and/or Marina Bay city architecture, clean daylight, accurate recognizable destination.'
  },

  // --- BATCH 7: CARS & TRANSFERS (25 - 28) ---
  {
    id: 'transfer-dubai',
    category: 'cars-transfers',
    destination: 'Dubai, UAE',
    filename: 'transfer-dubai.webp',
    alt: 'Executive airport transfer vehicle in Dubai',
    subjectPrompt:
      'Professional premium airport-transfer scene in Dubai, elegant unbranded black executive sedan or MPV in a realistic modern airport arrival environment, clean professional chauffeur-service mood, photorealistic.'
  },
  {
    id: 'transfer-london',
    category: 'cars-transfers',
    destination: 'London, UK',
    filename: 'transfer-london.webp',
    alt: 'Executive chauffeur transfer in London',
    subjectPrompt:
      'Professional London airport chauffeur transfer, refined unbranded executive sedan in a believable Heathrow or London airport environment, premium business-travel photography.'
  },
  {
    id: 'carhire-srilanka',
    category: 'cars-transfers',
    destination: 'Sri Lanka',
    filename: 'carhire-srilanka.webp',
    alt: 'Rental vehicle on a scenic Sri Lankan road',
    subjectPrompt:
      'Modern practical unbranded SUV or comfortable rental vehicle traveling through a beautiful authentic Sri Lankan scenic road environment, tropical mountains or coast, realistic self-drive travel photography.'
  },
  {
    id: 'transfer-bangkok',
    category: 'cars-transfers',
    destination: 'Bangkok, Thailand',
    filename: 'transfer-bangkok.webp',
    alt: 'Private airport transfer vehicle in Bangkok',
    subjectPrompt:
      'Clean unbranded premium passenger MPV or van in a realistic Bangkok airport-transfer setting, professional ground transportation, authentic urban Thailand background.'
  },

  // --- BATCH 8: CRUISES & SEA VOYAGES (29 - 32) ---
  {
    id: 'cruise-dubai',
    category: 'cruises',
    destination: 'Dubai / Arabian Gulf',
    filename: 'cruise-dubai.webp',
    alt: 'Cruise ship in Dubai and the Arabian Gulf',
    subjectPrompt:
      'Large modern unbranded cruise ship in a believable Dubai or Arabian Gulf port environment, Dubai skyline subtly visible, blue water, premium cruise travel editorial photography.'
  },
  {
    id: 'cruise-singapore',
    category: 'cruises',
    destination: 'Singapore',
    filename: 'cruise-singapore.webp',
    alt: 'Cruise ship at Singapore',
    subjectPrompt:
      'Large modern cruise vessel near Singapore cruise terminal with recognizable Singapore skyline context, photorealistic maritime travel photography, clean tropical daylight.'
  },
  {
    id: 'cruise-mediterranean',
    category: 'cruises',
    destination: 'Mediterranean',
    filename: 'cruise-mediterranean.webp',
    alt: 'Cruise ship sailing in the Mediterranean',
    subjectPrompt:
      'Large elegant modern unbranded cruise ship sailing through spectacular but realistic Mediterranean coastal scenery, deep blue sea, sunlit cliffs or historic coastal town, premium cruise editorial photography.'
  },
  {
    id: 'cruise-indianocean',
    category: 'cruises',
    destination: 'Indian Ocean',
    filename: 'cruise-indianocean.webp',
    alt: 'Cruise vessel in the Indian Ocean',
    subjectPrompt:
      'Modern unbranded cruise vessel in beautiful tropical Indian Ocean waters near lush island landscape, believable premium sea-voyage photography, natural tropical light.'
  },

  // --- BATCH 9: RAIL JOURNEYS (33 - 36) ---
  {
    id: 'rail-london-paris',
    category: 'rails',
    destination: 'London / Paris',
    filename: 'rail-london-paris.webp',
    alt: 'Modern high-speed European passenger train',
    subjectPrompt:
      'Modern European high-speed passenger train traveling through a believable intercity rail environment, sleek aerodynamic train, no carrier logo, premium rail travel editorial photography.'
  },
  {
    id: 'rail-tokyo-kyoto',
    category: 'rails',
    destination: 'Japan',
    filename: 'rail-tokyo-kyoto.webp',
    alt: 'Japanese Shinkansen high-speed train',
    subjectPrompt:
      'Authentic Japanese Shinkansen high-speed train traveling through a realistic Japanese landscape, clean modern rail infrastructure, premium natural travel photography.'
  },
  {
    id: 'rail-kandy-ella',
    category: 'rails',
    destination: 'Sri Lanka',
    filename: 'rail-kandy-ella.webp',
    alt: 'Sri Lankan train through the hill country',
    subjectPrompt:
      'Authentic blue Sri Lankan passenger train traveling through lush green hill-country scenery, tea plantations, misty mountains and realistic railway environment, classic Kandy to Ella atmosphere.'
  },
  {
    id: 'rail-swiss-alps',
    category: 'rails',
    destination: 'Swiss Alps',
    filename: 'rail-swiss-alps.webp',
    alt: 'Panoramic train in the Swiss Alps',
    subjectPrompt:
      'Beautiful panoramic passenger train traveling through authentic Swiss Alpine scenery, dramatic mountains, valleys and realistic railway infrastructure, premium European travel photography.'
  },

  // --- BATCH 10: TRAVEL INSURANCE (37 - 40) ---
  {
    id: 'insurance-single',
    category: 'insurance',
    destination: 'Airport Departure',
    filename: 'insurance-single.webp',
    alt: 'Solo traveler with luggage at an airport',
    subjectPrompt:
      'Solo international traveler with luggage in a bright sophisticated airport departure environment, calm prepared travel mood, premium realistic lifestyle travel photography.'
  },
  {
    id: 'insurance-comprehensive',
    category: 'insurance',
    destination: 'Airport Terminal',
    filename: 'insurance-comprehensive.webp',
    alt: 'Traveler preparing for an international journey',
    subjectPrompt:
      'International traveler preparing for a journey in a modern airport terminal, luggage and calm travel environment, realistic premium lifestyle photography emphasizing preparation and confidence.'
  },
  {
    id: 'insurance-family',
    category: 'insurance',
    destination: 'Airport Family Travel',
    filename: 'insurance-family.webp',
    alt: 'Family traveling together at an airport',
    subjectPrompt:
      'Natural candid family traveling together through a modern international airport with luggage, warm calm atmosphere, realistic family travel photography, not posed stock style.'
  },
  {
    id: 'insurance-annual',
    category: 'insurance',
    destination: 'Business Airport Travel',
    filename: 'insurance-annual.webp',
    alt: 'Frequent business traveler at an airport',
    subjectPrompt:
      'Frequent professional traveler with rolling luggage walking through a sophisticated international airport, authentic business-travel atmosphere, clean premium editorial photography.'
  }
];

export function buildFullPrompt(subjectPrompt) {
  return `${subjectPrompt.trim()} ${MASTER_ART_DIRECTION} ${MASTER_NEGATIVE_PROMPT}`;
}
