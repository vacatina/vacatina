/** The only hosted API handler. No application services, storage, auth or supplier clients. */
export default function handler(request, response) {
  const pathname = new URL(request.url || '/', 'https://demo.invalid').pathname;
  const read = request.method === 'GET';
  const capabilities = { mode:'BROWSER_ONLY_PUBLIC_DEMO',planning:false,enquiries:false,operations:false,hosted:false,payments:false,bookings:false,sandboxOrders:false,piiCollection:false };
  let status=503;
  let body={status:503,code:'HOSTED_BACKEND_NOT_QUALIFIED',title:'Demo service unavailable',detail:'Browser-only DEMO / TEST. No durable request, authentication, booking, payment, document upload or supplier order is available.'};
  if(read && pathname==='/api/v1/demo/capabilities'){status=200;body=capabilities;}
  if(read && pathname==='/api/v1/session'){status=200;body={authenticated:false,sessionId:null,clerk:{},capabilities};}
  if(read && pathname==='/api/v1/health'){status=200;body={status:'DEMO_ONLY',backendQualified:false,transactionsEnabled:false};}
  if(read && pathname==='/api/v1/checkout/capabilities'){status=200;body={gateways:[],available:false};}
  response.writeHead(status,{'Content-Type':status>=400?'application/problem+json':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'});
  response.end(JSON.stringify(body));
}
