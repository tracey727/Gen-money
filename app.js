(() => {
  'use strict';

  const STORAGE_KEY = 'every-cent-money-tracker-v1';
  const CACHE_KEY = 'genevieve-cloud-revision-v1';
  const nativeSetItem = Storage.prototype.setItem;
  const nativeGetItem = Storage.prototype.getItem;
  let revision = Number(nativeGetItem.call(localStorage, CACHE_KEY) || 0);
  let saveTimer = null;
  let saving = false;
  let dirty = false;
  let cloudReady = false;

  brandPage();
  start();

  function brandPage() {
    document.title = 'Genevieve App — Every Cent';
    const theme = document.querySelector('meta[name="theme-color"]');
    if (theme) theme.content = '#14213d';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.content = 'Genevieve App — a private personal money tracker with automatic online saving.';

    const h1 = document.querySelector('.topbar h1');
    if (h1) h1.textContent = 'Genevieve App';
    const eyebrow = document.querySelector('.topbar .eyebrow');
    if (eyebrow) eyebrow.textContent = 'EVERY CENT • PERSONAL MONEY';
    const tagline = document.querySelector('.topbar .tagline');
    if (tagline) tagline.textContent = 'Know what you have. Know where it went. Keep it safely saved.';

    const icon = document.createElement('link');
    icon.rel = 'icon'; icon.href = '/icon-192.png'; document.head.appendChild(icon);
    const apple = document.createElement('link');
    apple.rel = 'apple-touch-icon'; apple.href = '/apple-touch-icon.png'; document.head.appendChild(apple);
    const appleTitle = document.createElement('meta');
    appleTitle.name = 'apple-mobile-web-app-title'; appleTitle.content = 'Genevieve App'; document.head.appendChild(appleTitle);

    const style = document.createElement('style');
    style.textContent = `
      :root{--bg:#f5f0e7!important;--surface:#fffdf8!important;--ink:#17213b!important;--muted:#697083!important;--line:#ded6c8!important;--green:#14213d!important;--green-2:#8a6f16!important;--soft-green:#ece7dc!important;--gold:#c9a227!important;--shadow:0 12px 28px rgba(20,33,61,.09)!important}
      html,body{background:#f5f0e7!important}
      .primary-nav{background:rgba(245,240,231,.95)!important}
      .balance-card{background:linear-gradient(145deg,#14213d,#263a68)!important}
      .quick-action.income,.quick-action.account{border-color:#d8cfbd!important}
      .cloud-pill{position:fixed;right:12px;bottom:84px;z-index:70;display:flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid #d9d0be;border-radius:999px;background:rgba(255,253,248,.96);box-shadow:0 8px 24px rgba(20,33,61,.12);font:700 12px/1.1 Inter,system-ui;color:#14213d}
      .cloud-dot{width:8px;height:8px;border-radius:50%;background:#b88b21}.cloud-dot.ok{background:#37675f}.cloud-dot.bad{background:#a83232}
      .genevieve-lock{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:18px;background:linear-gradient(145deg,#14213d,#263a68)}
      .genevieve-lock-card{width:min(430px,100%);padding:30px;border-radius:28px;background:#fffdf8;box-shadow:0 25px 70px rgba(0,0,0,.28);text-align:center;color:#17213b}
      .genevieve-lock-icon{width:82px;height:82px;border-radius:22px;margin-bottom:12px}.genevieve-lock h2{font-size:2rem;margin:3px 0 8px}.genevieve-lock p{color:#697083;line-height:1.45}.genevieve-lock form{display:grid;gap:12px;text-align:left;margin-top:20px}.genevieve-lock label{display:grid;gap:6px;font-weight:800;font-size:.82rem}.genevieve-lock input{padding:13px 14px;border:1px solid #cbc3b4;border-radius:13px}.genevieve-lock button{border:0;border-radius:14px;padding:13px 16px;background:#14213d;color:white;font-weight:900}.genevieve-lock .error{min-height:18px;color:#a83232;font-size:.82rem;text-align:center}
    `;
    document.head.appendChild(style);
  }

  function localState() {
    try { return JSON.parse(nativeGetItem.call(localStorage, STORAGE_KEY) || 'null'); } catch { return null; }
  }
  function hasMoneyData(s) {
    return !!s && ['accounts','transactions','subscriptions'].some(k => Array.isArray(s[k]) && s[k].length);
  }
  async function api(path, options = {}) {
    const res = await fetch('/api/' + path, {
      credentials: 'same-origin',
      headers: {'Content-Type':'application/json', ...(options.headers || {})},
      ...options
    });
    let body = {};
    try { body = await res.json(); } catch {}
    if (!res.ok) {
      const e = new Error(body.error || 'Request failed'); e.status = res.status; e.body = body; throw e;
    }
    return body;
  }

  async function start() {
    try {
      const status = await api('status');
      if (!status.configured) await showSetup();
      else if (!status.authenticated) await showLogin();
      await reconcile();
      installStorageSync();
      cloudReady = true;
      setCloudStatus('ok', 'Saved online');
      loadLegacyApp();
    } catch (e) {
      console.error('Genevieve cloud start:', e);
      setCloudStatus('bad', 'Phone copy only');
      loadLegacyApp();
      setTimeout(() => alert('Genevieve App can still open, but online saving is not connected yet. Your browser copy has not been deleted.'), 500);
    }
  }

  async function reconcile() {
    const remote = await api('state');
    revision = Number(remote.revision) || 0;
    nativeSetItem.call(localStorage, CACHE_KEY, String(revision));
    const local = localState();
    const remoteState = remote.state && typeof remote.state === 'object' ? remote.state : null;

    if (hasMoneyData(remoteState)) {
      nativeSetItem.call(localStorage, STORAGE_KEY, JSON.stringify(remoteState));
      return;
    }
    if (hasMoneyData(local)) {
      const saved = await api('state', {method:'PUT', body:JSON.stringify({state:local, revision})});
      revision = Number(saved.revision) || revision + 1;
      nativeSetItem.call(localStorage, CACHE_KEY, String(revision));
      return;
    }
    if (remoteState) nativeSetItem.call(localStorage, STORAGE_KEY, JSON.stringify(remoteState));
  }

  function installStorageSync() {
    Storage.prototype.setItem = function(key, value) {
      nativeSetItem.call(this, key, value);
      if (this === localStorage && key === STORAGE_KEY && cloudReady) queueCloudSave();
    };
    window.addEventListener('online', () => { if (dirty) saveNow(); });
  }

  function queueCloudSave() {
    dirty = true;
    setCloudStatus('', 'Saving…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 300);
  }
  async function saveNow() {
    if (saving || !dirty) return;
    saving = true; dirty = false;
    const snapshot = localState();
    try {
      const r = await api('state', {method:'PUT', body:JSON.stringify({state:snapshot, revision})});
      revision = Number(r.revision) || revision + 1;
      nativeSetItem.call(localStorage, CACHE_KEY, String(revision));
      setCloudStatus('ok', 'Saved online');
    } catch (e) {
      if (e.status === 409) {
        setCloudStatus('bad', 'Save conflict');
        try {
          const remote = await api('state');
          revision = Number(remote.revision) || revision;
          dirty = true;
        } catch {}
      } else {
        dirty = true;
        setCloudStatus('bad', 'Phone copy saved');
      }
    } finally {
      saving = false;
      if (dirty) setTimeout(saveNow, 700);
    }
  }

  function setCloudStatus(kind, text) {
    let pill = document.getElementById('genevieveCloudPill');
    if (!pill) {
      pill = document.createElement('div'); pill.id='genevieveCloudPill'; pill.className='cloud-pill';
      pill.innerHTML='<span class="cloud-dot"></span><span></span>'; document.body.appendChild(pill);
    }
    pill.querySelector('.cloud-dot').className = 'cloud-dot ' + (kind || '');
    pill.querySelector('span:last-child').textContent = text;
  }

  function showSetup() {
    return showGate('First-time secure setup', `
      <label>Private setup code<input id="gvSetupCode" autocomplete="one-time-code" required></label>
      <label>Create a PIN/password<input id="gvSetupPassword" type="password" minlength="6" autocomplete="new-password" required></label>
    `, 'Set up Genevieve App', async () => {
      await api('setup', {method:'POST', body:JSON.stringify({setupCode:document.getElementById('gvSetupCode').value,password:document.getElementById('gvSetupPassword').value})});
    });
  }
  function showLogin() {
    return showGate('Open Genevieve App', `
      <label>Your PIN/password<input id="gvLoginPassword" type="password" autocomplete="current-password" required></label>
    `, 'Open my app', async () => {
      await api('login', {method:'POST', body:JSON.stringify({password:document.getElementById('gvLoginPassword').value})});
    });
  }
  function showGate(title, fields, button, action) {
    return new Promise(resolve => {
      const gate = document.createElement('div'); gate.className='genevieve-lock';
      gate.innerHTML=`<div class="genevieve-lock-card"><img class="genevieve-lock-icon" src="/icon-192.png" alt=""><div style="font-size:.72rem;font-weight:900;letter-spacing:.16em;color:#8a6f16">GENEVIEVE APP</div><h2>${title}</h2><p>Your money stays private and is saved online so it does not disappear with browser storage.</p><form>${fields}<div class="error"></div><button>${button}</button></form></div>`;
      document.body.appendChild(gate);
      const form = gate.querySelector('form');
      form.addEventListener('submit', async ev => {
        ev.preventDefault(); const err=gate.querySelector('.error'); err.textContent=''; const btn=gate.querySelector('button'); btn.disabled=true; btn.textContent='Connecting…';
        try { await action(); gate.remove(); resolve(); }
        catch(e) { err.textContent=e.message; btn.disabled=false; btn.textContent=button; }
      });
    });
  }

  function loadLegacyApp() {
    if (window.__genevieveLegacyLoaded) return;
    window.__genevieveLegacyLoaded = true;
    const s = document.createElement('script');
    s.src = '/legacy-app.js?v=2';
    s.onload = () => document.dispatchEvent(new Event('DOMContentLoaded', {bubbles:true}));
    document.body.appendChild(s);
  }
})();