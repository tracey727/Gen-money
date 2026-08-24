const ORIGIN = 'https://gen-money.vercel.app';

export default {
  async fetch(request) {
    const incoming = new URL(request.url);

    if (incoming.pathname === '/_edge/health') {
      return Response.json({
        ok: true,
        app: 'Genevieve App — Budget App',
        edge: 'cloudflare',
        origin: ORIGIN,
        timestamp: new Date().toISOString()
      }, {
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    const target = new URL(incoming.pathname + incoming.search, ORIGIN);
    const headers = new Headers(request.headers);
    headers.set('X-Genevieve-Edge', 'cloudflare');
    headers.set('X-Forwarded-Host', incoming.host);

    const upstreamRequest = new Request(target.toString(), {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual'
    });

    const upstream = await fetch(upstreamRequest);
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('X-Genevieve-Edge', 'cloudflare');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');
    responseHeaders.set('Referrer-Policy', 'no-referrer');

    const location = responseHeaders.get('location');
    if (location && location.startsWith(ORIGIN)) {
      responseHeaders.set('location', location.replace(ORIGIN, incoming.origin));
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  }
};
