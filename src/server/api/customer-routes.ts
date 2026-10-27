import { createHash } from 'node:crypto';
import type { SecurityContext } from '../auth/rbac.ts';
import type { VacatinaStorageEngine } from '../db/storage.ts';
import type { BookingSagaService } from '../services/booking-saga.service.ts';
import type { PaymentGatewayService } from '../services/payment-gateway.service.ts';
import { globalUnifiedInventory } from '../inventory/unified-inventory.service.ts';
import { isSeedOffer } from '../inventory/commercial-truth.ts';
import { customerOffer } from './customer-offer.ts';

const products = new Set(['flights','hotels','visa','packages','cars','activities','sightseeing','rails','cruises','insurance']);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type':'application/json', 'Cache-Control':'no-store' } });
const fail = (status: number, code: string, detail: string) => new Response(JSON.stringify({ status,code,detail,title:detail }), { status,headers:{ 'Content-Type':'application/problem+json','Cache-Control':'no-store' } });
const safeConfigKeys = ['destination','origin','departureDate','returnDate','adults','children','infants','rooms','serviceType','pickup','dropoff','pickupTime','luggage','driverAge','cabinClass','roomType','boardBasis','timeSlot','language','cabinType','travellerAges','residenceCountry','acceptedPriceMinor','optionId','selectedFareFamilyCode','selectedRoomId','selectedPlanId'];

function cleanConfiguration(input: any): Record<string, any> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(safeConfigKeys.filter(k => ['string','number','boolean'].includes(typeof input[k])).map(k => [k, typeof input[k] === 'string' ? input[k].slice(0, 500) : input[k]]));
}

function configurationError(product: string, config: Record<string, any>): string | undefined {
  const adults = Number(config.adults ?? 1), children = Number(config.children ?? 0), infants = Number(config.infants ?? 0);
  if (![adults,children,infants].every(Number.isSafeInteger) || adults < 1 || children < 0 || infants < 0 || adults+children+infants > 9 || infants > adults) return 'Choose a valid travel party (1–9 travellers).';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.departureDate || '') || !Number.isFinite(Date.parse(config.departureDate))) return 'Choose a valid departure or service date.';
  if (config.returnDate && (!(Date.parse(config.returnDate) >= Date.parse(config.departureDate)))) return 'The return date must follow the departure date.';
  if (['hotels','packages','insurance'].includes(product) && !config.returnDate) return 'Choose the end date for this trip.';
  if (product === 'cars' && (!config.pickup || !config.dropoff || !config.pickupTime)) return 'Complete the pickup, drop-off and pickup time.';
  if (product === 'cars' && config.serviceType === 'car_hire' && (!Number.isInteger(Number(config.driverAge)) || Number(config.driverAge) < 18)) return 'Enter a valid driver age.';
  if (product === 'hotels' && (!config.roomType && !config.selectedRoomId)) return 'Choose a room and rate.';
  return undefined;
}

/** Operational routes always execute on the server and use server-owned prices and identity. */
export async function handleCustomerRoutes(request: Request, context: SecurityContext | undefined,
  services: { storage: VacatinaStorageEngine; saga: BookingSagaService; payment: PaymentGatewayService }): Promise<Response | null> {
  const url = new URL(request.url), path = url.pathname, method = request.method.toUpperCase();
  const { storage, saga, payment } = services;
  const sessionId = context?.userId ? `user:${context.userId}` : request.headers.get('x-session-id');
  const bucketForSession = () => sessionId ? storage.getOrCreateTripBucket(sessionId, context?.userId, context?.organizationId) : undefined;
  const body = async () => {
    try { const value = await request.json(); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; }
    catch { throw Object.assign(new Error('Provide a valid JSON object.'), {status:400,code:'INVALID_JSON'}); }
  };

  if ((path === '/api/v1/search' || path.startsWith('/api/v1/search/')) && method === 'POST') {
    const input = await body();
    let productType = path.split('/')[4] || input.productType;
    productType = ({ transfers:'cars', visas:'visa', 'cars-transfers':'cars', 'visa-assistance':'visa', 'holiday-packages':'packages' } as any)[productType] || productType;
    if (!products.has(productType)) return fail(400,'INVALID_PRODUCT','Choose a supported travel product.');
    if (typeof input.destination !== 'string' || !input.destination.trim() || input.destination.length > 200) return fail(400,'INVALID_DESTINATION','Enter a destination.');
    const travellers = input.travellers || input.passengers || {};
    const offers = await globalUnifiedInventory.search({
      productType, destination:input.destination.trim(), origin:input.origin,
      departureDate:input.departureDate || input.dates?.departureDate, returnDate:input.returnDate || input.dates?.returnDate,
      checkInDate:input.checkInDate || input.departureDate, checkOutDate:input.checkOutDate || input.returnDate,
      adults:input.adults ?? travellers.adults ?? 1, children:input.children ?? travellers.children ?? 0,
      infants:input.infants ?? travellers.infants ?? 0, rooms:input.rooms ?? 1,
      cabinClass:input.cabinClass, tripType:input.tripType, slices:input.slices, currency:input.currency || 'LKR', channel:'B2C'
    });
    const eligible = offers.filter(offer => !isSeedOffer(offer) && !offer.isSandboxSimulated &&
      !['SEED','SANDBOX'].includes(offer.environmentClass) && offer.publicationStatus !== 'DRAFT' &&
      !['DISCOVERY_ONLY'].includes(offer.sellability));
    return json({ productType,totalResults:eligible.length,offers:eligible.map(customerOffer),
      warnings:eligible.length ? [] : ['No current options match this search. Try different dates or contact the travel team.'] });
  }

  const offerMatch = path.match(/^\/api\/v1\/offers\/([^/]+)(\/revalidate)?$/);
  if (offerMatch) {
    const offerId = decodeURIComponent(offerMatch[1]);
    const offer = await globalUnifiedInventory.getOfferById(offerId);
    if (!offer || isSeedOffer(offer) || offer.isSandboxSimulated) return fail(404,'OFFER_NOT_FOUND','This option is no longer available. Search again.');
    if (!offerMatch[2] && method === 'GET') return json({ offerId,offer:customerOffer(offer) });
    if (offerMatch[2] && method === 'POST') {
      const result = await globalUnifiedInventory.revalidateOffer(offerId);
      return json({ offerId,status:result.status,priceChanged:result.status === 'PRICE_CHANGED',
        currentPrice:result.newPriceMinor ?? offer.pricing.finalSellingPriceMinor,
        previousPrice:result.previousPriceMinor ?? offer.pricing.finalSellingPriceMinor,
        message:result.message,checkedAt:new Date().toISOString() });
    }
    return fail(405,'METHOD_NOT_ALLOWED','This action is not supported.');
  }

  if (path === '/api/v1/trip-buckets' || path.startsWith('/api/v1/trip-buckets/items')) {
    const bucket = bucketForSession();
    if (!bucket) return fail(401,'SESSION_REQUIRED','Start a travel session and try again.');
    const snapshot = () => {
      const items = storage.getTripBucketItems(bucket.id), ready = items.filter(i => i.state === 'READY');
      return { bucketId:bucket.id,currency:items[0]?.currency || bucket.currency,items,totalItems:items.length,
        readyCount:ready.length,needsActionCount:items.length-ready.length,
        readySubtotalMinor:ready.reduce((sum,i) => sum+i.unitSellingPriceMinor,0),
        journey:(bucket as any).journey,bundleProductTypes:(bucket as any).bundleProductTypes || [] };
    };
    if (path === '/api/v1/trip-buckets' && method === 'GET') return json(snapshot());
    if (path === '/api/v1/trip-buckets' && method === 'PATCH') {
      const input = await body();
      const journey = cleanConfiguration(input.journey);
      const error = configurationError('packages',journey);
      if (error) return fail(400,'INVALID_JOURNEY',error);
      const selected = Array.isArray(input.bundleProductTypes) ? [...new Set(input.bundleProductTypes)] : [];
      if (!selected.length || selected.some(p => !products.has(String(p)) || p === 'packages')) return fail(400,'INVALID_BUNDLE','Choose valid products for your bundle.');
      Object.assign(bucket,{ journey,bundleProductTypes:selected,updatedAt:new Date().toISOString() });
      return json(snapshot());
    }
    if (path === '/api/v1/trip-buckets/items' && method === 'POST') {
      const input = await body(), offerId = input.canonicalOfferId || input.offerId;
      if (typeof offerId !== 'string' || !offerId) return fail(400,'OFFER_REQUIRED','Choose a current travel option.');
      const offer = await globalUnifiedInventory.getOfferById(offerId);
      if (!offer || isSeedOffer(offer) || offer.isSandboxSimulated || offer.sellability === 'DISCOVERY_ONLY') return fail(409,'OFFER_NOT_SELLABLE','This option cannot be added. Search for a current option.');
      const configuration = cleanConfiguration(input.configuration);
      const error = configurationError(offer.productType,configuration);
      if (error) return fail(400,'CONFIGURATION_REQUIRED',error);
      const current = storage.getTripBucketItems(bucket.id);
      if (current.length && current[0].currency !== offer.pricing.currency) return fail(409,'MIXED_CURRENCY','Choose options in the same currency for one trip.');
      const reval = await globalUnifiedInventory.revalidateOffer(offerId);
      const price = reval.newPriceMinor ?? offer.pricing.finalSellingPriceMinor;
      if (!Number.isSafeInteger(price) || price < 0) return fail(409,'INVALID_PRICE','The price could not be verified. Search again.');
      let state: any = ({UNCHANGED:'READY',PRICE_CHANGED:'PRICE_CHANGED',UNAVAILABLE:'UNAVAILABLE',EXPIRED:'OFFER_EXPIRED',RECHECK_REQUIRED:'RECHECK_REQUIRED'} as any)[reval.status] || 'RECHECK_REQUIRED';
      if (reval.status === 'PRICE_CHANGED' && configuration.acceptedPriceMinor === price) state = 'READY';
      if (offer.bookingMode !== 'INSTANT_BOOK' || offer.sellability !== 'BOOKABLE') state = 'NEEDS_ACTION';
      const itemData = { canonicalOfferId:offerId,tripBucketId:bucket.id,productType:offer.productType,
        sourceType:offer.sourceType,bookingMode:offer.bookingMode,title:offer.title,
        configuration,travellerManifest:{adults:configuration.adults ?? 1,children:configuration.children ?? 0,infants:configuration.infants ?? 0},
        unitSellingPriceMinor:price,currency:offer.pricing.currency,state,
        environmentClass:offer.environmentClass,sellability:offer.sellability,lastRevalidatedAt:new Date().toISOString() };
      const existing = current.find(i => i.canonicalOfferId === offerId);
      const item = existing ? storage.updateTripBucketItem(existing.id,itemData) : storage.addTripBucketItem(itemData);
      return json({ success:true,item,...snapshot() },existing ? 200 : 201);
    }
    const itemId = path.match(/^\/api\/v1\/trip-buckets\/items\/([^/]+)(\/revalidate)?$/);
    if (itemId) {
      const item = storage.getTripBucketItems(bucket.id).find(i => i.id === decodeURIComponent(itemId[1]));
      if (!item) return fail(404,'ITEM_NOT_FOUND','This trip item was not found.');
      if (method === 'DELETE' && !itemId[2]) { storage.removeTripBucketItem(item.id); return json({success:true,...snapshot()}); }
      if (method === 'POST' && itemId[2]) {
        const result = await globalUnifiedInventory.revalidateOffer(item.canonicalOfferId);
        storage.updateTripBucketItem(item.id,{state:({UNCHANGED:'READY',PRICE_CHANGED:'PRICE_CHANGED',UNAVAILABLE:'UNAVAILABLE',EXPIRED:'OFFER_EXPIRED'} as any)[result.status] || 'RECHECK_REQUIRED',unitSellingPriceMinor:result.newPriceMinor ?? item.unitSellingPriceMinor,lastRevalidatedAt:new Date().toISOString()});
        return json(snapshot());
      }
    }
    return fail(405,'METHOD_NOT_ALLOWED','This trip action is not supported.');
  }

  if (path === '/api/v1/checkout/capabilities' && method === 'GET') return json((payment as any).getCapabilities());
  if ((path === '/api/v1/bookings' || path === '/api/v1/booking/checkout') && method === 'POST') {
    if (!context) return fail(401,'SIGN_IN_REQUIRED','Sign in to continue to booking.');
    const input = await body(), bucket = bucketForSession();
    if (!bucket || (input.tripBucketId && input.tripBucketId !== bucket.id)) return fail(404,'TRIP_NOT_FOUND','Your trip could not be found.');
    const key = request.headers.get('x-idempotency-key');
    if (!key || key.length < 8 || key.length > 200) return fail(400,'IDEMPOTENCY_KEY_MISSING','A booking request reference is required.');
    const result = await saga.executeBookingSaga({tripBucketId:bucket.id,userId:context.userId,organizationId:context.organizationId,
      checkoutSessionId:sessionId!,customerEmail:input.customerEmail || context.email,customerName:input.customerName,
      idempotencyKey:createHash('sha256').update(context.userId+':'+key).digest('hex')});
    return json(result);
  }

  if (path.startsWith('/api/v1/bookings/') || path === '/api/v1/checkout/payment-intent') {
    if (!context) return fail(401,'SIGN_IN_REQUIRED','Sign in to manage your booking.');
    const input = method === 'GET' ? {} : await body();
    const reference = path.split('/')[4];
    const group = input.bookingGroupId ? (storage as any).getBookingGroup(input.bookingGroupId) : storage.getBookingGroupByReference(reference);
    if (!group || group.userId !== context.userId) return fail(404,'BOOKING_NOT_FOUND','This booking could not be found for your account.');
    if (path === '/api/v1/checkout/payment-intent' && method === 'POST') {
      const key = request.headers.get('x-idempotency-key');
      if (!key) return fail(400,'IDEMPOTENCY_KEY_MISSING','A payment request reference is required.');
      return json(await (payment as any).createPaymentIntent({bookingGroupId:group.id,customerEmail:context.email,
        customerName:input.customerName,gatewayId:input.gatewayId,returnUrl:request.headers.get('origin') || url.origin,idempotencyKey:key}));
    }
    if (method === 'GET') return json({bookingGroup:group,items:storage.getBookingItems(group.id)});
    if (path.endsWith('/cancel') && method === 'POST') {
      return json(await (saga as any).requestCancellation(group.id,context.userId,input.reason));
    }
    return fail(405,'METHOD_NOT_ALLOWED','This booking action is not supported.');
  }

  if (path.startsWith('/webhooks/') || path.startsWith('/api/v1/webhooks/')) {
    if (method !== 'POST') return fail(405,'METHOD_NOT_ALLOWED','POST is required.');
    const provider = path.split('/').pop()!.toUpperCase();
    const result = await payment.handleWebhookEvent({gatewayId:provider,eventId:'',eventType:'',payloadString:await request.text(),
      signatureHeader:request.headers.get('stripe-signature') || request.headers.get('paypal-transmission-sig') || '',headers:Object.fromEntries(request.headers)} as any);
    return json(result,(result as any).status === 'ERROR' ? 400 : 200);
  }
  return null;
}
