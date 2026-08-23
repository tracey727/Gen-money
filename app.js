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
  showHomeEntry().then(start);

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

  function showHomeEntry() {
    return new Promise(resolve => {
      const entry = document.createElement('div');
      entry.className = 'genevieve-entry';
      entry.setAttribute('role', 'dialog');
      entry.setAttribute('aria-label', 'Open Genevieve Personal Money Command Centre');
      entry.innerHTML = `
        <div class="genevieve-entry-shell">
          <p class="genevieve-entry-kicker">Tracey · Genevieve App</p>
          <button class="genevieve-entry-button" type="button" aria-label="Open Personal Money Command Centre dashboard">
            <span class="genevieve-entry-toggle">
              <span class="genevieve-entry-logo" aria-hidden="true">
                <svg viewBox="0 0 220 220" role="img" aria-label="Genevieve tree and roots emblem">
                  <g class="entry-tree-light" stroke-width="3.1">
                    <path d="M110 103C104 88 99 77 100 64C101 47 108 36 110 27"/>
                    <path d="M107 84C91 72 78 61 67 44"/>
                    <path d="M111 76C127 65 139 52 146 36"/>
                    <path d="M105 94C87 88 69 80 54 68"/>
                    <path d="M114 93C133 85 149 76 164 63"/>
                  </g>
                  <g class="entry-tree-line" stroke-width="2.2">
                    <path d="M67 44C60 38 52 34 45 33M67 44C69 35 71 27 77 21M54 68C44 66 35 65 27 60M146 36C154 29 164 25 173 25M164 63C174 59 184 55 192 48"/>
                    <path d="M109 99C95 111 88 123 91 135C95 149 113 153 125 141C135 131 129 115 114 106C103 99 88 98 76 107C61 119 66 137 82 145C96 151 111 145 121 135" stroke-width="4"/>
                    <path d="M110 100C124 112 132 124 129 136C125 150 107 154 95 142C85 132 91 116 106 107C117 100 132 99 144 108C159 120 154 138 138 146C124 152 109 146 99 136" stroke-width="4"/>
                    <path d="M110 146C110 162 108 175 106 185M108 181C94 187 81 194 70 204M108 182C99 194 94 202 91 211M110 181C120 193 126 202 130 211M112 181C127 187 141 194 153 204M106 186C91 184 78 186 64 192M114 186C129 184 144 187 158 193"/>
                  </g>
                  <g class="entry-tree-leaf">
                    <circle cx="45" cy="33" r="4.2"/><circle cx="57" cy="28" r="3.6"/><circle cx="77" cy="21" r="4.1"/>
                    <circle cx="91" cy="25" r="3.8"/><circle cx="110" cy="27" r="4.1"/><circle cx="130" cy="25" r="3.8"/>
                    <circle cx="150" cy="32" r="3.9"/><circle cx="173" cy="25" r="4.2"/><circle cx="184" cy="38" r="3.6"/>
                    <circle cx="27" cy="60" r="3.8"/><circle cx="42" cy="55" r="3.4"/><circle cx="54" cy="68" r="4"/>
                    <circle cx="164" cy="63" r="4"/><circle cx="181" cy="57" r="3.8"/><circle cx="192" cy="48" r="4.1"/>
                    <circle cx="78" cy="50" r="3.5"/><circle cx="92" cy="44" r="3.5"/><circle cx="127" cy="46" r="3.5"/><circle cx="143" cy="52" r="3.5"/>
                  </g>
                  <g class="entry-tree-pink">
                    <circle cx="151" cy="45" r="4.3"/><circle cx="157" cy="42" r="4.2"/><circle cx="163" cy="46" r="4.1"/>
                    <circle cx="154" cy="51" r="4.2"/><circle cx="161" cy="52" r="4"/>
                  </g>
                </svg>
              </span>
              <span class="genevieve-entry-copy">
                <span class="genevieve-entry-brand">Genevieve App</span>
                <span class="genevieve-entry-title">Personal Money<br>Command Centre</span>
                <span class="genevieve-entry-ornament">— ✦ —</span>
                <span class="genevieve-entry-purpose">Track spending, bills, savings, subscriptions<br>and what’s safe to spend</span>
                <span class="genevieve-entry-open">Open Dashboard</span>
              </span>
              <span class="genevieve-entry-arrow" aria-hidden="true">›</span>
            </span>
          </button>
          <p class="genevieve-entry-instruction">Tap the <strong>Personal Money Command Centre</strong> to enter your app.</p>
        </div>`;

      document.body.appendChild(entry);
      const previousOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';

      const button = entry.querySelector('.genevieve-entry-button');
      button.addEventListener('click', () => {
        if (entry.classList.contains('genevieve-entry-opening')) return;
        entry.classList.add('genevieve-entry-opening');
        button.disabled = true;
        setTimeout(() => {
          entry.remove();
          document.documentElement.style.overflow = previousOverflow;
          resolve();
        }, 280);
      });

      requestAnimationFrame(() => button.focus({ preventScroll: true }));
    });
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
    script.src = '/legacy-app.js?v=4';
    script.onload = () => document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
    document.body.appendChild(script);
  }
})();
