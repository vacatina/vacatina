/** Hosted API handler. Supports Duffel webhook verification and demo capabilities. */
import crypto from 'node:crypto';

export default function handler(request, response) {
  const pathname = new URL(request.url || '/', 'https://demo.invalid').pathname;
  const method = (request.method || 'GET').toUpperCase();
  const read = method === 'GET';

  const capabilities = { mode:'BROWSER_ONLY_PUBLIC_DEMO',planning:false,enquiries:false,operations:false,hosted:false,payments:false,bookings:false,sandboxOrders:false,piiCollection:false };

  // Duffel webhook endpoint
  if (pathname === '/api/webhooks/duffel') {
    if (method !== 'POST') {
      response.writeHead(405, {'Content-Type':'application/problem+json','Allow':'POST','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      response.end(JSON.stringify({status:405,code:'METHOD_NOT_ALLOWED',title:'Method not allowed',detail:'Only POST is accepted for webhook delivery.'}));
      return;
    }

    const secret = process.env.DUFFEL_WEBHOOK_SIGNING_SECRET;
    if (!secret) {
      response.writeHead(503, {'Content-Type':'application/problem+json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      response.end(JSON.stringify({status:503,code:'WEBHOOK_NOT_CONFIGURED',title:'Webhook not configured',detail:'Webhook signing secret is not configured.'}));
      return;
    }

    // Read raw body
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      const rawBody = Buffer.concat(chunks);
      const signatureHeader = request.headers['x-duffel-signature'] || '';

      // Parse signature header: t=<timestamp>,v1=<signature>
      const parts = signatureHeader.split(',').reduce((acc, part) => {
        const [key, val] = part.split('=');
        if (key && val) acc[key.trim()] = val.trim();
        return acc;
      }, {});

      const timestamp = parts.t;
      const providedSig = parts.v1;

      if (!timestamp || !providedSig) {
        response.writeHead(401, {'Content-Type':'application/problem+json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        response.end(JSON.stringify({status:401,code:'INVALID_SIGNATURE',title:'Invalid signature',detail:'Missing timestamp or signature in X-Duffel-Signature header.'}));
        return;
      }

      // Check timestamp freshness (within 5 minutes)
      const now = Math.floor(Date.now() / 1000);
      const ts = parseInt(timestamp, 10);
      if (isNaN(ts) || Math.abs(now - ts) > 300) {
        response.writeHead(401, {'Content-Type':'application/problem+json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        response.end(JSON.stringify({status:401,code:'STALE_TIMESTAMP',title:'Stale timestamp',detail:'Webhook timestamp is outside the acceptable window.'}));
        return;
      }

      // Compute expected signature
      const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
      const expectedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

      // Constant-time comparison
      let valid = false;
      try {
        valid = crypto.timingSafeEqual(Buffer.from(providedSig, 'hex'), Buffer.from(expectedSig, 'hex'));
      } catch {
        valid = false;
      }

      if (!valid) {
        response.writeHead(401, {'Content-Type':'application/problem+json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        response.end(JSON.stringify({status:401,code:'INVALID_SIGNATURE',title:'Invalid signature',detail:'Webhook signature verification failed.'}));
        return;
      }

      // Parse body
      let event;
      try {
        event = JSON.parse(rawBody.toString('utf8'));
      } catch {
        response.writeHead(400, {'Content-Type':'application/problem+json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        response.end(JSON.stringify({status:400,code:'INVALID_BODY',title:'Invalid body',detail:'Request body is not valid JSON.'}));
        return;
      }

      const eventType = event?.type || event?.event || '';

      // Handle ping.triggered
      if (eventType === 'ping.triggered') {
        response.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        response.end(JSON.stringify({received:true,type:eventType,processed:false,note:'Ping acknowledged. No durable backend configured.'}));
        return;
      }

      // Handle flight order events (idempotent acknowledgment without persistence)
      const supportedEvents = ['order.created','order.updated','order.cancelled','order.completed'];
      if (supportedEvents.includes(eventType)) {
        // Idempotency: in production this would check a durable store. Without backend, acknowledge but don't process.
        response.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        response.end(JSON.stringify({received:true,type:eventType,processed:false,note:'Event acknowledged. Durable processing requires backend configuration.'}));
        return;
      }

      // Unsupported event type
      response.writeHead(202, {'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      response.end(JSON.stringify({received:true,type:eventType,processed:false,note:'Event type not handled.'}));
    });
    request.on('error', () => {
      response.writeHead(400, {'Content-Type':'application/problem+json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      response.end(JSON.stringify({status:400,code:'REQUEST_ERROR',title:'Request error',detail:'Failed to read request body.'}));
    });
    return;
  }

  // Demo capabilities
  let status=503;
  let body={status:503,code:'HOSTED_BACKEND_NOT_QUALIFIED',title:'Demo service unavailable',detail:'Browser-only DEMO / TEST. No durable request, authentication, booking, payment, document upload or supplier order is available.'};
  if(read && pathname==='/api/v1/demo/capabilities'){status=200;body=capabilities;}
  if(read && pathname==='/api/v1/session'){status=200;body={authenticated:false,sessionId:null,clerk:{},capabilities};}
  if(read && pathname==='/api/v1/health'){status=200;body={status:'DEMO_ONLY',backendQualified:false,transactionsEnabled:false};}
  if(read && pathname==='/api/v1/checkout/capabilities'){status=200;body={gateways:[],available:false};}
  response.writeHead(status,{'Content-Type':status>=400?'application/problem+json':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'});
  response.end(JSON.stringify(body));
}
