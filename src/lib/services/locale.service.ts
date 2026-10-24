/* ============================================================================
 * Vacatina Internationalization (i18n), Language & Multi-Currency Service
 * Authorities:
 * - ANTIGRAVITY ULTRA MASTER INSTRUCTION (§33–§41)
 * - Screen 03 Foundation v1.1 Locked (#nav-locale-menu & mobile locale controls)
 *
 * Features:
 * - Independent Language (EN, SI, TA + global) & Currency (LKR, USD, AED, EUR, GBP + global)
 * - Searchable catalogs with Suggested vs. All sections
 * - Automatic <html lang="..." dir="ltr|rtl"> synchronization
 * - Live DOM price conversion across all discovery cards & Trip Bucket with tabular-nums
 * - Persistent storage via localStorage ('vacatina_locale_v4')
 * ============================================================================ */

import type { SupportedCurrency, SupportedLanguage } from '../domain/types.ts';
import { CURRENCY_RATES_FROM_LKR, formatCurrencyAmount } from '../mock-data/catalog.ts';
import { searchCommandService } from './search.service.ts';

export interface LanguageDescriptor {
  code: SupportedLanguage;
  htmlLang: string;
  name: string;
  nativeName: string;
  regionHint: string;
  dir: 'ltr' | 'rtl';
  suggested?: boolean;
}

export interface CurrencyDescriptor {
  code: SupportedCurrency;
  symbol: string;
  name: string;
  rateFromLkr: number;
  suggested?: boolean;
}

export const SUPPORTED_LANGUAGES: LanguageDescriptor[] = [
  { code: 'EN', htmlLang: 'en', name: 'English', nativeName: 'English', regionHint: 'International · Full Production', dir: 'ltr', suggested: true },
  { code: 'SI', htmlLang: 'si', name: 'Sinhala', nativeName: 'සිංහල', regionHint: 'Sri Lanka · Prototype Localization (Phase 1)', dir: 'ltr', suggested: true },
  { code: 'TA', htmlLang: 'ta', name: 'Tamil', nativeName: 'தமிழ்', regionHint: 'Sri Lanka / SG · Prototype Localization (Phase 1)', dir: 'ltr', suggested: true },
  { code: 'AR', htmlLang: 'ar', name: 'Arabic', nativeName: 'العربية', regionHint: 'UAE / Middle East · Architecture Ready', dir: 'rtl' },
  { code: 'FR', htmlLang: 'fr', name: 'French', nativeName: 'Français', regionHint: 'Europe · Architecture Ready', dir: 'ltr' },
  { code: 'DE', htmlLang: 'de', name: 'German', nativeName: 'Deutsch', regionHint: 'Europe · Architecture Ready', dir: 'ltr' },
  { code: 'ZH', htmlLang: 'zh', name: 'Chinese', nativeName: '中文 (简体)', regionHint: 'East Asia · Architecture Ready', dir: 'ltr' },
  { code: 'JA', htmlLang: 'ja', name: 'Japanese', nativeName: '日本語', regionHint: 'Japan · Architecture Ready', dir: 'ltr' },
  { code: 'RU', htmlLang: 'ru', name: 'Russian', nativeName: 'Русский', regionHint: 'Eurasia · Architecture Ready', dir: 'ltr' },
  { code: 'HI', htmlLang: 'hi', name: 'Hindi', nativeName: 'हिन्दी', regionHint: 'India · Architecture Ready', dir: 'ltr' }
];

export const SUPPORTED_CURRENCIES: CurrencyDescriptor[] = (
  Object.keys(CURRENCY_RATES_FROM_LKR) as SupportedCurrency[]
).map(code => {
  const entry = CURRENCY_RATES_FROM_LKR[code];
  return {
    code,
    symbol: entry.symbol.trim(),
    name: entry.name,
    rateFromLkr: entry.rate,
    suggested: Boolean(entry.suggested)
  };
});

export interface TranslationCatalog {
  navHome: string;
  navFlights: string;
  navHotels: string;
  navVisa: string;
  navPackages: string;
  navCars: string;
  navMore: string;
  navResources: string;
  navActivities: string;
  navSightseeing: string;
  navRails: string;
  navCruises: string;
  navInsurance: string;
  tabBundle: string;
  tabFlights: string;
  tabHotels: string;
  tabVisa: string;
  tabPackages: string;
  tabCars: string;
  tabRails: string;
  tabCruises: string;
  tabActivities: string;
  tabSightseeing: string;
  tabInsurance: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroCompare: string;
  heroPricing: string;
  heroOnePlace: string;
  tripBucketLabel: string;
  tripBucketEstimate: string;
  reviewTrip: string;
  favorites: string;
  signIn: string;
  signUp: string;
  searchFlightsBtn: string;
  searchHotelsBtn: string;
  checkVisaBtn: string;
  explorePackagesBtn: string;
  buildTripBtn: string;
  headingFlights: string;
  headingHotels: string;
  headingVisa: string;
  headingPackages: string;
  mobileQuickActions: string;
  mobileExploreProducts: string;
  footerAbout: string;
  footerTerms: string;
  footerPrivacy: string;
  footerCookies: string;
  footerAccessibility: string;
  footerSecurity: string;
  footerFollow: string;
}

export const MESSAGE_CATALOG: Record<'EN' | 'SI' | 'TA', TranslationCatalog> = {
  EN: {
    navHome: 'Home',
    navFlights: 'Flights',
    navHotels: 'Hotels',
    navVisa: 'Visa Assistance',
    navPackages: 'Holiday Packages',
    navCars: 'Cars & Transfers',
    navMore: 'More',
    navResources: 'Resources',
    navActivities: 'Activities',
    navSightseeing: 'Sightseeing Tours',
    navRails: 'Rails',
    navCruises: 'Cruises',
    navInsurance: 'Travel Insurance',
    tabBundle: 'Build Your Bundle',
    tabFlights: 'Flights',
    tabHotels: 'Hotels',
    tabVisa: 'Visa Assistance',
    tabPackages: 'Holiday Packages',
    tabCars: 'Cars & Transfers',
    tabRails: 'Rails',
    tabCruises: 'Cruises',
    tabActivities: 'Activities',
    tabSightseeing: 'Sightseeing Tours',
    tabInsurance: 'Travel Insurance',
    heroHeadline: 'Book Everything in One Place',
    heroSubheadline:
      'Discover, compare, plan, combine, and manage your complete journey from one place—flights, stays, visa assistance, transfers, and curated experiences.',
    heroCompare: '⌕ Compare options',
    heroPricing: '◇ Transparent pricing',
    heroOnePlace: '✓ One place for your trip',
    tripBucketLabel: 'Trip Bucket',
    tripBucketEstimate: 'Ready items estimate',
    reviewTrip: 'Review Trip',
    favorites: 'Saved Favorites',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    searchFlightsBtn: 'Search Flights',
    searchHotelsBtn: 'Search Hotels',
    checkVisaBtn: 'Check Visa Options',
    explorePackagesBtn: 'Explore Packages',
    buildTripBtn: 'Build My Trip',
    headingFlights: 'POPULAR FLIGHTS',
    headingHotels: 'FEATURED STAYS & HOTELS',
    headingVisa: 'VISA ASSISTANCE',
    headingPackages: 'HOLIDAY PACKAGES',
    mobileQuickActions: 'Quick Actions',
    mobileExploreProducts: 'Explore Travel Products',
    footerAbout: 'About Vacatina',
    footerTerms: 'Terms of Service',
    footerPrivacy: 'Privacy Policy',
    footerCookies: 'Cookie Preferences',
    footerAccessibility: 'Accessibility Statement',
    footerSecurity: 'Security & Trust',
    footerFollow: 'Follow Vacatina'
  },
  SI: {
    navHome: 'මුල් පිටුව',
    navFlights: 'ගුවන් ගමන්',
    navHotels: 'හෝටල්',
    navVisa: 'වීසා සහාය',
    navPackages: 'නිවාඩු පැකේජ',
    navCars: 'ප්‍රවාහන සේවා',
    navMore: 'තවත්',
    navResources: 'තොරතුරු',
    navActivities: 'ක්‍රියාකාරකම්',
    navSightseeing: 'සංචාරක චාරිකා',
    navRails: 'දුම්රිය ගමන්',
    navCruises: 'නෞකා චාරිකා',
    navInsurance: 'සංචාරක රක්ෂණ',
    tabBundle: 'සංචාරක පැකේජය සකසන්න',
    tabFlights: 'ගුවන් ගමන්',
    tabHotels: 'හෝටල්',
    tabVisa: 'වීසා සහාය',
    tabPackages: 'නිවාඩු පැකේජ',
    tabCars: 'ප්‍රවාහන සේවා',
    tabRails: 'දුම්රිය ගමන්',
    tabCruises: 'නෞකා චාරිකා',
    tabActivities: 'ක්‍රියාකාරකම්',
    tabSightseeing: 'සංචාරක චාරිකා',
    tabInsurance: 'සංචාරක රක්ෂණ',
    heroHeadline: 'සියලුම ගමන් පහසුකම් එකම තැනකින් වෙන්කරවා ගන්න',
    heroSubheadline:
      'ගුවන් ගමන්, හෝටල්, වීසා සහාය, නිවාඩු පැකේජ, ප්‍රවාහන, දුම්රිය සහ රක්ෂණ එකම විශ්වාසනීය පද්ධතියකින් සැලසුම් කරන්න.',
    heroCompare: '⌕ විකල්ප සසඳන්න',
    heroPricing: '◇ විනිවිදභාවයෙන් යුතු මිල',
    heroOnePlace: '✓ සියල්ල එකම තැනකින්',
    tripBucketLabel: 'සංචාරක ගොනුව',
    tripBucketEstimate: 'සූදානම් අයිතම ඇස්තමේන්තුව',
    reviewTrip: 'ගමන සමාලෝචනය',
    favorites: 'සුරකින ලද අයිතම',
    signIn: 'ඇතුල් වන්න',
    signUp: 'ලියාපදිංචි වන්න',
    searchFlightsBtn: 'ගුවන් ගමන් සොයන්න',
    searchHotelsBtn: 'හෝටල් සොයන්න',
    checkVisaBtn: 'වීසා විකල්ප බලන්න',
    explorePackagesBtn: 'පැකේජ සොයන්න',
    buildTripBtn: 'සංචාරය සකසන්න',
    headingFlights: 'ජනප්‍රිය ගුවන් ගමන්',
    headingHotels: 'තෝරාගත් නවාතැන් සහ හෝටල්',
    headingVisa: 'වීසා සහාය සේවා',
    headingPackages: 'නිවාඩු පැකේජ',
    mobileQuickActions: 'ක්ෂණික ක්‍රියා',
    mobileExploreProducts: 'සංචාරක සේවා ගවේෂණය',
    footerAbout: 'වැකැටීනා ගැන',
    footerTerms: 'සේවා කොන්දේසි',
    footerPrivacy: 'පෞද්ගලිකත්ව ප්‍රතිපත්තිය',
    footerCookies: 'කුකී මනාපයන්',
    footerAccessibility: 'ප්‍රවේශ්‍යතා ප්‍රකාශය',
    footerSecurity: 'ආරක්ෂාව සහ විශ්වාසය',
    footerFollow: 'වැකැටීනා සමඟ එක්වන්න'
  },
  TA: {
    navHome: 'முகப்பு',
    navFlights: 'விமானங்கள்',
    navHotels: 'தங்குமிடங்கள்',
    navVisa: 'விசா உதவி',
    navPackages: 'சுற்றுலா தொகுப்புகள்',
    navCars: 'கார்கள் & இடமாற்றங்கள்',
    navMore: 'மேலும்',
    navResources: 'வளங்கள்',
    navActivities: 'செயல்பாடுகள்',
    navSightseeing: 'சுற்றுலாக்கள்',
    navRails: 'ரயில் பயணங்கள்',
    navCruises: 'கப்பல் பயணங்கள்',
    navInsurance: 'பயணக் காப்பீடு',
    tabBundle: 'தொகுப்பை உருவாக்குங்கள்',
    tabFlights: 'விமானங்கள்',
    tabHotels: 'தங்குமிடங்கள்',
    tabVisa: 'விசா உதவி',
    tabPackages: 'சுற்றுலா தொகுப்புகள்',
    tabCars: 'கார்கள் & இடமாற்றங்கள்',
    tabRails: 'ரயில் பயணங்கள்',
    tabCruises: 'கப்பல் பயணங்கள்',
    tabActivities: 'செயல்பாடுகள்',
    tabSightseeing: 'சுற்றுலாக்கள்',
    tabInsurance: 'பயணக் காப்பீடு',
    heroHeadline: 'உங்கள் அனைத்து பயணத் தேவைகளையும் ஒரே இடத்தில் முன்பதிவு செய்யுங்கள்',
    heroSubheadline:
      'விமானங்கள், தங்குமிடங்கள், விசா உதவி, சுற்றுலா தொகுப்புகள், இடமாற்றங்கள் மற்றும் காப்பீட்டை ஒரே தளத்தில் ஒப்பிட்டு திட்டமிடுங்கள்.',
    heroCompare: '⌕ விருப்பங்களை ஒப்பிடுக',
    heroPricing: '◇ வெளிப்படையான விலை',
    heroOnePlace: '✓ ஒரே இடத்தில் அனைத்தும்',
    tripBucketLabel: 'பயணத் தொகுப்பு',
    tripBucketEstimate: 'தயாராக உள்ள உருப்படிகள்',
    reviewTrip: 'மதிப்பாய்வு செய்க',
    favorites: 'விருப்பங்கள்',
    signIn: 'உள்நுழைக',
    signUp: 'பதிவு செய்க',
    searchFlightsBtn: 'விமானங்களைத் தேடுங்கள்',
    searchHotelsBtn: 'ஹோட்டல்களைத் தேடுங்கள்',
    checkVisaBtn: 'விசா விருப்பங்களைச் சரிபார்க்கவும்',
    explorePackagesBtn: 'தொகுப்புகளை ஆராயுங்கள்',
    buildTripBtn: 'பயணத்தை உருவாக்குங்கள்',
    headingFlights: 'பிரபலமான விமான சேவைகள்',
    headingHotels: 'சிறப்பு தங்குமிடங்கள் & ஹோட்டல்கள்',
    headingVisa: 'விசா உதவி சேவைகள்',
    headingPackages: 'சுற்றுலா தொகுப்புகள்',
    mobileQuickActions: 'விரைவு நடவடிக்கைகள்',
    mobileExploreProducts: 'பயண சேவைகளை ஆராய்க',
    footerAbout: 'Vacatina பற்றி',
    footerTerms: 'சேவை விதிமுறைகள்',
    footerPrivacy: 'தனியுரிமைக் கொள்கை',
    footerCookies: 'குக்கீ விருப்பங்கள்',
    footerAccessibility: 'அணுகல்தன்மை அறிக்கை',
    footerSecurity: 'பாதுகாப்பு & நம்பிக்கை',
    footerFollow: 'Vacatina உடன் இணையுங்கள்'
  }
};

const HERO_TRANSLATIONS: Record<
  SupportedLanguage,
  { headline: string; subheadline: string; tripBucketLabel: string }
> = {
  EN: {
    headline: MESSAGE_CATALOG.EN.heroHeadline,
    subheadline: MESSAGE_CATALOG.EN.heroSubheadline,
    tripBucketLabel: MESSAGE_CATALOG.EN.tripBucketLabel
  },
  SI: {
    headline: MESSAGE_CATALOG.SI.heroHeadline,
    subheadline: MESSAGE_CATALOG.SI.heroSubheadline,
    tripBucketLabel: MESSAGE_CATALOG.SI.tripBucketLabel
  },
  TA: {
    headline: MESSAGE_CATALOG.TA.heroHeadline,
    subheadline: MESSAGE_CATALOG.TA.heroSubheadline,
    tripBucketLabel: MESSAGE_CATALOG.TA.tripBucketLabel
  },
  AR: {
    headline: 'احجز كل تفاصيل رحلتك في مكان واحد.',
    subheadline:
      'اكتشف وقارن ونسّق الطيران والفنادق والتأشيرات والباقات والتنقلات والرحلات البحرية والتأمين عبر نظام سفر متكامل.',
    tripBucketLabel: 'حقيبة الرحلة'
  },
  FR: {
    headline: 'Réservez tout votre voyage au même endroit.',
    subheadline:
      'Découvrez, comparez et combinez vols, hôtels, visas, forfaits, transferts, trains, croisières et assurances en toute sérénité.',
    tripBucketLabel: 'Panier Voyage'
  },
  DE: {
    headline: 'Buchen Sie Ihre gesamte Reise an einem Ort.',
    subheadline:
      'Flüge, Hotels, Visa-Service, Pakete, Transfers, Bahn, Kreuzfahrten und Reiseversicherung präzise kombinieren.',
    tripBucketLabel: 'Reise-Bucket'
  },
  ZH: {
    headline: '一站式预订您的全部行程。',
    subheadline: '在一个平静、透明的旅行操作系统中探索、比较并组合机票、酒店、签证、度假套餐与接送服务。',
    tripBucketLabel: '行程篮'
  },
  JA: {
    headline: 'すべての旅の手配を、ひとつの場所で。',
    subheadline: '航空券、ホテル、ビザ申請支援、パッケージ、送迎、鉄道、クルーズ、保険を統合管理。',
    tripBucketLabel: 'トリップバケット'
  },
  RU: {
    headline: 'Бронируйте всё путешествие в одном месте.',
    subheadline: 'Авиабилеты, отели, визовая поддержка, туры, трансферы, поезда и страховка в единой системе.',
    tripBucketLabel: 'Корзина поездки'
  },
  HI: {
    headline: 'अपनी पूरी यात्रा एक ही स्थान पर बुक करें।',
    subheadline: 'उड़ानें, होटल, वीज़ा सहायता, हॉलिडे पैकेज, ट्रांसफर और यात्रा बीमा एक ही शांत प्लेटफ़ॉर्म पर।',
    tripBucketLabel: 'ट्रिप बकेट'
  }
};

export interface LocaleState {
  language: SupportedLanguage;
  currency: SupportedCurrency;
}

const STORAGE_KEY = 'vacatina_locale_v4';

export class LocaleService {
  private state: LocaleState = {
    language: 'EN',
    currency: 'LKR'
  };

  private listeners: Set<(state: LocaleState) => void> = new Set();
  private domPriceNodesTagged = false;

  constructor() {
    this.restoreFromStorage();
  }

  private restoreFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<LocaleState>;
      if (parsed.language && SUPPORTED_LANGUAGES.some(l => l.code === parsed.language)) {
        this.state.language = parsed.language;
      }
      if (parsed.currency && SUPPORTED_CURRENCIES.some(c => c.code === parsed.currency)) {
        this.state.currency = parsed.currency;
      }
    } catch {
      // Ignore storage errors
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore storage errors
    }
  }

  public getState(): LocaleState {
    return { ...this.state };
  }

  public getLanguageDescriptor(code: SupportedLanguage = this.state.language): LanguageDescriptor {
    return SUPPORTED_LANGUAGES.find(l => l.code === code) || SUPPORTED_LANGUAGES[0];
  }

  public getCurrencyDescriptor(code: SupportedCurrency = this.state.currency): CurrencyDescriptor {
    return SUPPORTED_CURRENCIES.find(c => c.code === code) || SUPPORTED_CURRENCIES[0];
  }

  public subscribe(listener: (state: LocaleState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snap = this.getState();
    this.listeners.forEach(fn => fn(snap));
  }

  public setLanguage(language: SupportedLanguage): void {
    if (!SUPPORTED_LANGUAGES.some(l => l.code === language)) return;
    this.state.language = language;
    this.saveToStorage();
    this.applyDocumentLocaleAttributes();
    this.applyTranslatedShellCopy();
    this.emit();
  }

  public setCurrency(currency: SupportedCurrency): void {
    if (!SUPPORTED_CURRENCIES.some(c => c.code === currency)) return;
    this.state.currency = currency;
    this.saveToStorage();
    searchCommandService.setCurrency(currency);
    this.convertAllTaggedDomPrices();
    this.emit();
  }

  public applyDocumentLocaleAttributes(): void {
    if (typeof document === 'undefined') return;
    const desc = this.getLanguageDescriptor(this.state.language);
    document.documentElement.setAttribute('lang', desc.htmlLang);
    document.documentElement.setAttribute('dir', desc.dir);
  }

  public applyTranslatedHeroCopy(): void {
    this.applyTranslatedShellCopy();
  }

  public applyTranslatedShellCopy(): void {
    if (typeof document === 'undefined') return;
    const langKey = this.state.language === 'SI' || this.state.language === 'TA' ? this.state.language : 'EN';
    const dict = MESSAGE_CATALOG[langKey];

    // 1. Hero headline & subheadline
    const heroH1 = document.querySelector<HTMLElement>('section[aria-label="Hero and Travel Intent"] h1');
    if (heroH1) heroH1.textContent = dict.heroHeadline;
    const heroP = document.querySelector<HTMLElement>('section[aria-label="Hero and Travel Intent"] p');
    if (heroP) heroP.textContent = dict.heroSubheadline;

    // 2. Search Command Center tabs
    const tabMap: Record<string, string> = {
      'tab-bundle': dict.tabBundle,
      'tab-flights': dict.tabFlights,
      'tab-hotels': dict.tabHotels,
      'tab-visa': dict.tabVisa,
      'tab-packages': dict.tabPackages,
      'tab-cars': dict.tabCars,
      'tab-rails': dict.tabRails,
      'tab-cruises': dict.tabCruises,
      'tab-activities': dict.tabActivities,
      'tab-sightseeing': dict.tabSightseeing,
      'tab-insurance': dict.tabInsurance
    };
    Object.entries(tabMap).forEach(([id, text]) => {
      const tabEl = document.getElementById(id);
      if (tabEl) tabEl.textContent = text;
    });

    // 3. Desktop nav links
    const desktopLinks = document.querySelectorAll<HTMLAnchorElement>('nav.desktop-nav a');
    if (desktopLinks.length >= 6) {
      if (desktopLinks[0]) desktopLinks[0].textContent = dict.navHome;
      if (desktopLinks[1]) desktopLinks[1].textContent = dict.navFlights;
      if (desktopLinks[2]) desktopLinks[2].textContent = dict.navHotels;
      if (desktopLinks[3]) desktopLinks[3].textContent = dict.navVisa;
      if (desktopLinks[4]) desktopLinks[4].textContent = dict.navPackages;
      if (desktopLinks[5]) desktopLinks[5].textContent = dict.navCars;
    }
    const moreBtnSpan = document.querySelector<HTMLElement>('#more-dropdown-btn span');
    if (moreBtnSpan) moreBtnSpan.textContent = dict.navMore;
    const resBtnSpan = document.querySelector<HTMLElement>('#resources-dropdown-btn span');
    if (resBtnSpan) resBtnSpan.textContent = dict.navResources;

    // 4. Trip Bucket header label
    const headerBucketSpan = document.querySelector<HTMLElement>('#header-trip-bucket-btn span.hidden.md\\:inline');
    if (headerBucketSpan) headerBucketSpan.textContent = dict.tripBucketLabel;

    // 5. Dock review trip btn
    const dockReviewBtn = document.getElementById('dock-review-trip-btn');
    if (dockReviewBtn) dockReviewBtn.textContent = dict.reviewTrip;

    // 6. Mobile summary review btn
    const mobReviewBtn = document.getElementById('mobile-summary-review-btn');
    if (mobReviewBtn) mobReviewBtn.textContent = dict.reviewTrip;

    // 7. Discovery Section category labels
    const allSecSpans = document.querySelectorAll<HTMLElement>('#main-content section span.uppercase');
    allSecSpans.forEach(span => {
      const txt = (span.textContent || '').trim().toUpperCase();
      if (txt.includes('FLIGHT')) span.textContent = dict.headingFlights;
      else if (txt.includes('HOTEL') || txt.includes('STAYS')) span.textContent = dict.headingHotels;
      else if (txt.includes('VISA')) span.textContent = dict.headingVisa;
      else if (txt.includes('PACKAGE')) span.textContent = dict.headingPackages;
    });

    // 8. Mobile drawer section headers
    const mobQuickHead = document.querySelector<HTMLElement>('#mobile-quick-actions div');
    if (mobQuickHead) mobQuickHead.textContent = dict.mobileQuickActions;

    // 9. Footer follow heading
    const footFollow = document.getElementById('footer-follow-heading');
    if (footFollow) footFollow.textContent = dict.footerFollow;
  }

  /**
   * Scans discovery card price elements containing `LKR <number>` once, stores their
   * canonical base LKR value in `data-base-lkr`, and updates them whenever currency changes.
   */
  public tagAndConvertDiscoveryPrices(): void {
    if (typeof document === 'undefined') return;

    if (!this.domPriceNodesTagged) {
      const candidates = document.querySelectorAll<HTMLElement>(
        '#main-content article span, #main-content article div'
      );
      const lkrRegex = /^LKR\s+([0-9,]+)(\*?)$/;
      candidates.forEach(el => {
        if (el.children.length > 0) return;
        const txt = (el.textContent || '').trim();
        const match = txt.match(lkrRegex);
        if (match) {
          const amount = parseInt(match[1].replace(/,/g, ''), 10);
          if (!Number.isNaN(amount) && amount > 0) {
            el.setAttribute('data-base-lkr', String(amount));
            el.setAttribute('data-price-suffix', match[2] || '');
            el.classList.add('tabular-nums');
          }
        }
      });
      this.domPriceNodesTagged = true;
    }

    this.convertAllTaggedDomPrices();
  }

  public convertAllTaggedDomPrices(): void {
    if (typeof document === 'undefined') return;
    const nodes = document.querySelectorAll<HTMLElement>('[data-base-lkr]');
    nodes.forEach(node => {
      const baseLkr = parseInt(node.getAttribute('data-base-lkr') || '0', 10);
      const suffix = node.getAttribute('data-price-suffix') || '';
      if (baseLkr > 0) {
        node.textContent = `${formatCurrencyAmount(baseLkr, this.state.currency)}${suffix}`;
      }
    });
  }
}

export const localeService = new LocaleService();
