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
    document.title = 'Genevieve App — Personal Money Command Centre';

    const theme = document.querySelector('meta[name="theme-color"]');
    if (theme) theme.content = '#061426';

    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.content = 'Genevieve App — Tracey’s private personal money command centre.';

    const h1 = document.querySelector('.topbar h1');
    if (h1) h1.textContent = 'Genevieve App';

    const eyebrow = document.querySelector('.topbar .eyebrow');
    if (eyebrow) eyebrow.textContent = 'PERSONAL MONEY COMMAND CENTRE';

    const tagline = document.querySelector('.topbar .tagline');
    if (tagline) tagline.textContent = 'Safety from roots to every journey.';

    addHeadLink('icon', '/icon-192.png');
    addHeadLink('apple-touch-icon', '/apple-touch-icon.png');

    const appleTitle = document.createElement('meta');
    appleTitle.name = 'apple-mobile-web-app-title';
    appleTitle.content = 'Genevieve App';
    document.head.appendChild(appleTitle);
  }

  function addHeadLink(rel, href) {
    if (document.querySelector(`link[rel="${rel}"]`)) return;
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    document.head.appendChild(link);
  }

  function localState() {
    try {
      return JSON.parse(nativeGetItem.call(localStorage, STORAGE_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function hasMoneyData(s) {
    return !!s && ['accounts', 'transactions', 'subscriptions'].some(
      key => Array.isArray(s[key]) && s[key].length
    );
  }

  async function api(path, options = {}) {
    const res = await fetch('/api/' + path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });

    let body = {};
    try { body = await res.json(); } catch {}

    if (!res.ok) {
      const error = new Error(body.error || 'Request failed');
      error.status = res.status;
      error.body = body;
      throw error;
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
    } catch (error) {
      console.warn('Genevieve cloud saving unavailable; using private device storage.', error);
      setCloudStatus('', 'Private on this device');
    } finally {
      loadLegacyApp();
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
      const saved = await api('state', {
        method: 'PUT',
        body: JSON.stringify({ state: local, revision }),
      });
      revision = Number(saved.revision) || revision + 1;
      nativeSetItem.call(localStorage, CACHE_KEY, String(revision));
      return;
    }

    if (remoteState) {
      nativeSetItem.call(localStorage, STORAGE_KEY, JSON.stringify(remoteState));
    }
  }

  function installStorageSync() {
    Storage.prototype.setItem = function(key, value) {
      nativeSetItem.call(this, key, value);
      if (this === localStorage && key === STORAGE_KEY && cloudReady) queueCloudSave();
    };

    window.addEventListener('online', () => {
      if (dirty) saveNow();
    });
  }

  function queueCloudSave() {
    dirty = true;
    setCloudStatus('', 'Saving…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 300);
  }

  async function saveNow() {
    if (saving || !dirty) return;

    saving = true;
    dirty = false;
    const snapshot = localState();

    try {
      const result = await api('state', {
        method: 'PUT',
        body: JSON.stringify({ state: snapshot, revision }),
      });
      revision = Number(result.revision) || revision + 1;
      nativeSetItem.call(localStorage, CACHE_KEY, String(revision));
      setCloudStatus('ok', 'Saved online');
    } catch (error) {
      if (error.status === 409) {
        setCloudStatus('bad', 'Save conflict');
        try {
          const remote = await api('state');
          revision = Number(remote.revision) || revision;
          dirty = true;
        } catch {}
      } else {
        dirty = true;
        cloudReady = false;
        setCloudStatus('', 'Private on this device');
      }
    } finally {
      saving = false;
      if (dirty && cloudReady) setTimeout(saveNow, 700);
    }
  }

  function setCloudStatus(kind, text) {
    let pill = document.getElementById('genevieveCloudPill');

    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'genevieveCloudPill';
      pill.className = 'cloud-pill';
      pill.innerHTML = '<span class="cloud-dot"></span><span></span>';
      document.body.appendChild(pill);
    }

    pill.querySelector('.cloud-dot').className = 'cloud-dot ' + (kind || '');
    pill.querySelector('span:last-child').textContent = text;
  }

  function showSetup() {
    return showGate(
      'First-time secure setup',
      '<label>Private setup code<input id="gvSetupCode" autocomplete="one-time-code" required></label>' +
      '<label>Create a PIN/password<input id="gvSetupPassword" type="password" minlength="6" autocomplete="new-password" required></label>',
      'Set up Genevieve App',
      async () => {
        await api('setup', {
          method: 'POST',
          body: JSON.stringify({
            setupCode: document.getElementById('gvSetupCode').value,
            password: document.getElementById('gvSetupPassword').value,
          }),
        });
      }
    );
  }

  function showLogin() {
    return showGate(
      'Open Genevieve App',
      '<label>Your PIN/password<input id="gvLoginPassword" type="password" autocomplete="current-password" required></label>',
      'Open my app',
      async () => {
        await api('login', {
          method: 'POST',
          body: JSON.stringify({ password: document.getElementById('gvLoginPassword').value }),
        });
      }
    );
  }

  function showGate(title, fields, buttonText, action) {
    return new Promise(resolve => {
      const gate = document.createElement('div');
      gate.className = 'genevieve-lock';
      gate.innerHTML = `
        <div class="genevieve-lock-card">
          <div class="gate-tree" aria-hidden="true"></div>
          <div style="font-size:.72rem;font-weight:900;letter-spacing:.16em;color:#d6ad45">GENEVIEVE APP</div>
          <h2>${title}</h2>
          <p>Your personal money command centre.</p>
          <form>
            ${fields}
            <div class="error"></div>
            <button>${buttonText}</button>
          </form>
        </div>`;

      document.body.appendChild(gate);
      const form = gate.querySelector('form');

      form.addEventListener('submit', async event => {
        event.preventDefault();
        const errorBox = gate.querySelector('.error');
        const button = gate.querySelector('button');
        errorBox.textContent = '';
        button.disabled = true;
        button.textContent = 'Connecting…';

        try {
          await action();
          gate.remove();
          resolve();
        } catch (error) {
          errorBox.textContent = error.message;
          button.disabled = false;
          button.textContent = buttonText;
        }
      });
    });
  }

  function loadLegacyApp() {
    if (window.__genevieveLegacyLoaded) return;
    window.__genevieveLegacyLoaded = true;

    const script = document.createElement('script');
    script.src = '/legacy-app.js?v=3';
    script.onload = () => document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
    document.body.appendChild(script);
  }
})();
