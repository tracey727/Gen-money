export default async function handler(req, res) {
  try {
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
    const host = req.headers.host;
    const origin = `${proto}://${host}`;
    const paths = ['/index.html','/app.js','/legacy-app.js','/luxury.css','/styles.css','/service-worker.js','/assets/genevieve-roots-logo.webp'];
    const responses = await Promise.all(paths.map(async path => {
      const r = await fetch(origin + path, { cache: 'no-store' });
      return { path, ok: r.ok, status: r.status, type: r.headers.get('content-type') || '', text: path.endsWith('.js') || path.endsWith('.html') || path.endsWith('.css') ? await r.text() : '' };
    }));
    const byPath = Object.fromEntries(responses.map(x => [x.path, x]));
    const syntax = {};
    for (const path of ['/app.js','/legacy-app.js','/service-worker.js']) {
      try { new Function(byPath[path].text); syntax[path] = 'ok'; }
      catch (e) { syntax[path] = e.message; }
    }
    const html = byPath['/index.html'].text;
    const legacy = byPath['/legacy-app.js'].text;
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
    const refs = new Set([
      ...[...legacy.matchAll(/\$\('#([^']+)'\)/g)].map(m => m[1]),
      ...[...legacy.matchAll(/\$\("#([^"]+)"\)/g)].map(m => m[1])
    ]);
    const missingIds = [...refs].filter(id => !ids.has(id));
    let database = { ok: false, status: null, configured: false };
    try {
      const dbRes = await fetch(origin + '/api/status', { cache: 'no-store', headers: { cookie: req.headers.cookie || '' } });
      const dbBody = await dbRes.json().catch(() => ({}));
      database = { ok: dbRes.ok, status: dbRes.status, configured: !!dbBody.configured, authenticated: !!dbBody.authenticated, error: dbBody.error || null, detail: dbBody.detail || null };
    } catch (e) { database.error = e.message; }
    const staticOk = responses.every(x => x.ok);
    const syntaxOk = Object.values(syntax).every(v => v === 'ok');
    const wiringOk = missingIds.length === 0;
    res.status(200).json({
      app: 'Genevieve App — Budget App',
      version: '2026-08-24-maroon-1',
      staticOk,
      syntaxOk,
      wiringOk,
      database,
      assets: responses.map(({path,ok,status,type}) => ({path,ok,status,type})),
      syntax,
      missingIds,
      overall: staticOk && syntaxOk && wiringOk && database.ok ? 'pass' : 'attention'
    });
  } catch (e) {
    res.status(500).json({ overall: 'fail', error: e.message });
  }
}
