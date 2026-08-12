(() => {
  'use strict';

  const STORAGE_KEY = 'every-cent-money-tracker-v1';
  const DEFAULT_STATE = { version: 1, accounts: [], transactions: [], subscriptions: [] };
  const CATEGORIES = [
    'Groceries', 'Eating out', 'Coffee / snacks', 'Housing', 'Utilities', 'Phone / internet',
    'Transport', 'Fuel', 'Medical / health', 'Pet / dog', 'Insurance', 'Subscriptions',
    'Clothing', 'Entertainment', 'Travel', 'Gifts', 'Business', 'Cash', 'Other'
  ];
  const WORTH_LABELS = { essential: 'Essential', worth: 'Worth it', unsure: 'Unsure', waste: 'Waste' };
  const ACCOUNT_LABELS = { bank: 'Bank', savings: 'Savings', cash: 'Cash', credit: 'Credit card', loan: 'Loan / debt', investment: 'Investment', other: 'Other' };
  const LIABILITY_TYPES = new Set(['credit', 'loan']);

  let state = loadState();
  let activeView = 'dashboard';
  let toastTimer;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function money(value) {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(value || 0));
  }

  function parseAmount(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[ch]));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return structuredClone(DEFAULT_STATE);
      return {
        version: 1,
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : []
      };
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
  }

  function monthKey(dateString = todayISO()) { return dateString.slice(0, 7); }

  function annualCost(amount, cycle) {
    const n = parseAmount(amount);
    const multipliers = { weekly: 52, fortnightly: 26, monthly: 12, yearly: 1 };
    return n * (multipliers[cycle] || 12);
  }

  function accountById(id) { return state.accounts.find(a => a.id === id); }

  function computedBalance(account) {
    if (!account) return 0;
    let balance = parseAmount(account.openingBalance);
    const liability = LIABILITY_TYPES.has(account.type);
    for (const t of state.transactions) {
      const amount = parseAmount(t.amount);
      if (t.type === 'income' && t.accountId === account.id) balance += liability ? -amount : amount;
      if (t.type === 'expense' && t.accountId === account.id) balance += liability ? amount : -amount;
      if (t.type === 'transfer') {
        if (t.accountId === account.id) balance += liability ? amount : -amount;
        if (t.toAccountId === account.id) balance += liability ? -amount : amount;
      }
    }
    return Math.round(balance * 100) / 100;
  }

  function accountPosition(account) {
    const bal = computedBalance(account);
    if (LIABILITY_TYPES.has(account.type)) return -bal;
    return bal;
  }

  function navigate(view) {
    activeView = view;
    $$('.view').forEach(el => el.classList.toggle('active', el.dataset.view === view));
    $$('.nav-button').forEach(el => el.classList.toggle('active', el.dataset.view === view));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function setSelectOptions(select, options, placeholder = 'Choose…') {
    const existing = select.value;
    select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` + options.map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');
    if ([...select.options].some(o => o.value === existing)) select.value = existing;
  }

  function refreshAccountSelects() {
    const options = state.accounts.map(a => ({ value: a.id, label: `${a.name} — ${money(computedBalance(a))}` }));
    ['#transactionAccount', '#transactionToAccount', '#subscriptionAccount'].forEach(sel => setSelectOptions($(sel), options, 'Choose account'));
  }

  function renderDashboard() {
    const thisMonth = monthKey();
    const monthTx = state.transactions.filter(t => monthKey(t.date) === thisMonth);
    const income = monthTx.filter(t => t.type === 'income').reduce((s,t) => s + parseAmount(t.amount), 0);
    const spent = monthTx.filter(t => t.type === 'expense').reduce((s,t) => s + parseAmount(t.amount), 0);
    const waste = monthTx.filter(t => t.type === 'expense' && ['waste','unsure'].includes(t.worth)).reduce((s,t) => s + parseAmount(t.amount), 0);
    const netWorth = state.accounts.reduce((s,a) => s + accountPosition(a), 0);
    const activeAnnual = state.subscriptions.filter(s => s.status === 'active').reduce((sum,s) => sum + annualCost(s.amount, s.cycle), 0);

    $('#netWorthValue').textContent = money(netWorth);
    $('#netWorthHint').textContent = state.accounts.length ? `${state.accounts.length} account${state.accounts.length === 1 ? '' : 's'} included.` : 'Add your accounts to begin.';
    $('#wasteMonthValue').textContent = money(waste);
    $('#incomeMonth').textContent = money(income);
    $('#spentMonth').textContent = money(spent);
    $('#cashflowMonth').textContent = money(income - spent);
    $('#subscriptionYear').textContent = money(activeAnnual);

    const attention = [];
    state.subscriptions.filter(s => s.status === 'unknown').forEach(s => attention.push({ title: s.name, meta: 'Subscription status is unknown', pill: 'Needs checking', cls: 'danger', action: () => openSubscriptionDialog(s.id) }));
    state.subscriptions.filter(s => s.status === 'active' && ['waste','unsure'].includes(s.worth)).forEach(s => attention.push({ title: s.name, meta: `${money(s.amount)} ${s.cycle} • ${money(annualCost(s.amount,s.cycle))}/year`, pill: s.worth === 'waste' ? 'Consider cancelling' : 'Review value', cls: 'warning', action: () => openSubscriptionDialog(s.id) }));
    state.transactions.filter(t => t.type === 'expense' && t.worth === 'unsure').slice(0, 5).forEach(t => attention.push({ title: t.merchant, meta: `${formatDate(t.date)} • ${money(t.amount)}`, pill: 'Was it worth it?', cls: 'warning', action: () => openTransactionDialog(t.id) }));

    $('#attentionCount').textContent = String(attention.length);
    const attentionList = $('#attentionList');
    if (!attention.length) {
      attentionList.className = 'stack-list empty-state';
      attentionList.textContent = 'Nothing needs attention yet.';
    } else {
      attentionList.className = 'stack-list';
      attentionList.innerHTML = attention.slice(0, 8).map((a,i) => `
        <button class="list-row clickable" data-attention-index="${i}" style="width:100%; text-align:left;">
          <span><span class="row-title">${escapeHtml(a.title)} <span class="pill ${a.cls}">${escapeHtml(a.pill)}</span></span><span class="row-meta">${escapeHtml(a.meta)}</span></span>
          <span>›</span>
        </button>`).join('');
      $$('[data-attention-index]', attentionList).forEach(btn => btn.addEventListener('click', () => attention[Number(btn.dataset.attentionIndex)].action()));
    }

    const recent = [...state.transactions].sort((a,b) => `${b.date}${b.createdAt || ''}`.localeCompare(`${a.date}${a.createdAt || ''}`)).slice(0, 6);
    renderTransactionRows($('#recentTransactions'), recent, true);
  }

  function renderTransactions() {
    const type = $('#transactionTypeFilter').value;
    const query = $('#transactionSearch').value.trim().toLowerCase();
    let items = [...state.transactions].sort((a,b) => `${b.date}${b.createdAt || ''}`.localeCompare(`${a.date}${a.createdAt || ''}`));
    if (type !== 'all') items = items.filter(t => t.type === type);
    if (query) items = items.filter(t => [t.merchant, t.category, t.notes, accountById(t.accountId)?.name].join(' ').toLowerCase().includes(query));
    renderTransactionRows($('#transactionList'), items, false);
  }

  function renderTransactionRows(container, items, compact) {
    if (!items.length) {
      container.className = `stack-list${compact ? '' : ' large-list'} empty-state`;
      container.textContent = compact ? 'No transactions recorded yet.' : 'No transactions yet.';
      return;
    }
    container.className = `stack-list${compact ? '' : ' large-list'}`;
    container.innerHTML = items.map(t => {
      const from = accountById(t.accountId)?.name || 'No account';
      const to = accountById(t.toAccountId)?.name || '';
      const worth = t.type === 'expense' ? `<span class="pill ${worthClass(t.worth)}">${escapeHtml(WORTH_LABELS[t.worth] || 'Review')}</span>` : '';
      const sign = t.type === 'expense' ? '−' : t.type === 'income' ? '+' : '⇄ ';
      const meta = t.type === 'transfer' ? `${formatDate(t.date)} • ${from} → ${to}` : `${formatDate(t.date)} • ${t.category || 'Other'} • ${from}`;
      return `<button class="list-row clickable" data-transaction-id="${t.id}" style="width:100%; text-align:left;">
        <span><span class="row-title">${escapeHtml(t.merchant)} ${worth}</span><span class="row-meta">${escapeHtml(meta)}</span></span>
        <span class="row-amount ${t.type}">${sign}${money(t.amount)}</span>
      </button>`;
    }).join('');
    $$('[data-transaction-id]', container).forEach(btn => btn.addEventListener('click', () => openTransactionDialog(btn.dataset.transactionId)));
  }

  function worthClass(worth) {
    return worth === 'waste' ? 'danger' : worth === 'unsure' ? 'warning' : worth === 'worth' ? 'info' : 'good';
  }

  function renderAccounts() {
    const assets = state.accounts.filter(a => !LIABILITY_TYPES.has(a.type)).reduce((s,a) => s + computedBalance(a), 0);
    const debts = state.accounts.filter(a => LIABILITY_TYPES.has(a.type)).reduce((s,a) => s + Math.abs(computedBalance(a)), 0);
    $('#assetsTotal').textContent = money(assets);
    $('#debtsTotal').textContent = money(debts);
    $('#netPositionTotal').textContent = money(assets - debts);

    const list = $('#accountList');
    if (!state.accounts.length) {
      list.className = 'stack-list large-list empty-state';
      list.textContent = 'Add your bank account, savings, cash, credit card or loan.';
      return;
    }
    list.className = 'stack-list large-list';
    list.innerHTML = state.accounts.map(a => {
      const bal = computedBalance(a);
      const isDebt = LIABILITY_TYPES.has(a.type);
      return `<button class="list-row clickable" data-account-id="${a.id}" style="width:100%; text-align:left;">
        <span><span class="row-title">${escapeHtml(a.name)} <span class="pill neutral">${escapeHtml(ACCOUNT_LABELS[a.type] || 'Account')}</span></span><span class="row-meta">Starting balance ${money(a.openingBalance)}</span></span>
        <span class="row-amount ${isDebt ? 'expense' : 'income'}">${isDebt ? 'Owe ' : ''}${money(Math.abs(bal))}</span>
      </button>`;
    }).join('');
    $$('[data-account-id]', list).forEach(btn => btn.addEventListener('click', () => openAccountDialog(btn.dataset.accountId)));
  }

  function renderSubscriptions() {
    const active = state.subscriptions.filter(s => s.status === 'active');
    const annual = active.reduce((sum,s) => sum + annualCost(s.amount,s.cycle), 0);
    const cuts = active.filter(s => ['waste','unsure'].includes(s.worth)).reduce((sum,s) => sum + annualCost(s.amount,s.cycle), 0);
    const unknown = state.subscriptions.filter(s => s.status === 'unknown');
    $('#subscriptionMonthly').textContent = money(annual / 12);
    $('#subscriptionAnnual').textContent = money(annual);
    $('#subscriptionCuts').textContent = money(cuts);
    $('#subscriptionUnknownCount').textContent = String(unknown.length);

    const list = $('#subscriptionList');
    if (!state.subscriptions.length) {
      list.className = 'stack-list large-list empty-state';
      list.textContent = 'No recurring payments recorded yet.';
      return;
    }
    list.className = 'stack-list large-list';
    const rank = { unknown: 0, active: 1, cancelled: 2 };
    const items = [...state.subscriptions].sort((a,b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || a.name.localeCompare(b.name));
    list.innerHTML = items.map(s => {
      const statusPill = s.status === 'unknown' ? '<span class="pill danger">Needs checking</span>' : s.status === 'cancelled' ? '<span class="pill neutral">Cancelled</span>' : `<span class="pill ${worthClass(s.worth)}">${escapeHtml(WORTH_LABELS[s.worth] || 'Active')}</span>`;
      const account = accountById(s.accountId)?.name || 'Payment source unknown';
      const next = s.nextDate ? ` • next ${formatDate(s.nextDate)}` : '';
      return `<button class="list-row clickable" data-subscription-id="${s.id}" style="width:100%; text-align:left;">
        <span><span class="row-title">${escapeHtml(s.name)} ${statusPill}</span><span class="row-meta">${money(s.amount)} ${escapeHtml(s.cycle)} • ${account}${escapeHtml(next)}</span></span>
        <span class="row-amount ${s.status === 'cancelled' ? 'transfer' : 'expense'}">${money(annualCost(s.amount,s.cycle))}/yr</span>
      </button>`;
    }).join('');
    $$('[data-subscription-id]', list).forEach(btn => btn.addEventListener('click', () => openSubscriptionDialog(btn.dataset.subscriptionId)));
  }

  function renderReview() {
    const thisMonth = monthKey();
    const expenses = state.transactions.filter(t => t.type === 'expense' && monthKey(t.date) === thisMonth);
    const worthTotals = { essential: 0, worth: 0, unsure: 0, waste: 0 };
    expenses.forEach(t => worthTotals[t.worth || 'unsure'] = (worthTotals[t.worth || 'unsure'] || 0) + parseAmount(t.amount));
    $('#worthBreakdown').innerHTML = ['essential','worth','unsure','waste'].map(k => `<div class="worth-card"><span>${WORTH_LABELS[k]}</span><strong>${money(worthTotals[k])}</strong></div>`).join('');

    const categories = {};
    expenses.forEach(t => categories[t.category || 'Other'] = (categories[t.category || 'Other'] || 0) + parseAmount(t.amount));
    const entries = Object.entries(categories).sort((a,b) => b[1] - a[1]);
    const list = $('#categoryBreakdown');
    if (!entries.length) {
      list.className = 'bar-list empty-state';
      list.textContent = 'No spending to review yet.';
    } else {
      const max = entries[0][1] || 1;
      list.className = 'bar-list';
      list.innerHTML = entries.map(([name,value]) => `<div class="bar-row"><span class="bar-label">${escapeHtml(name)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(2,(value/max)*100)}%"></div></div><span class="bar-value">${money(value)}</span></div>`).join('');
    }
    updateProtectAnnual();
  }

  function renderAll() {
    refreshAccountSelects();
    renderDashboard();
    renderTransactions();
    renderSubscriptions();
    renderAccounts();
    renderReview();
  }

  function formatDate(dateString) {
    if (!dateString) return 'No date';
    const [y,m,d] = dateString.split('-').map(Number);
    return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: y !== new Date().getFullYear() ? 'numeric' : undefined }).format(new Date(y, m - 1, d));
  }

  function setTransactionType(type) {
    $('#transactionType').value = type;
    $$('[data-type-choice]').forEach(b => b.classList.toggle('selected', b.dataset.typeChoice === type));
    $('#worthFieldset').classList.toggle('hidden', type !== 'expense');
    $('#toAccountLabel').classList.toggle('hidden', type !== 'transfer');
    $('#fromAccountLabel').firstChild.textContent = type === 'income' ? 'Paid into' : type === 'transfer' ? 'Moved from' : 'Paid from';
    if (type === 'income') $('#transactionCategory').value = 'Other';
  }

  function openTransactionDialog(id = null, forceType = null) {
    const form = $('#transactionForm');
    form.reset();
    refreshAccountSelects();
    $('#transactionDate').value = todayISO();
    $('#transactionId').value = '';
    $('#deleteTransactionButton').classList.add('hidden');
    $('#transactionDialogTitle').textContent = 'Add money movement';
    let type = forceType || 'expense';

    if (id) {
      const t = state.transactions.find(x => x.id === id);
      if (!t) return;
      $('#transactionId').value = t.id;
      $('#transactionAmount').value = t.amount;
      $('#transactionDate').value = t.date;
      $('#transactionMerchant').value = t.merchant;
      $('#transactionCategory').value = t.category || 'Other';
      $('#transactionAccount').value = t.accountId || '';
      $('#transactionToAccount').value = t.toAccountId || '';
      $('#transactionNotes').value = t.notes || '';
      const worthRadio = $(`input[name="worth"][value="${t.worth || 'essential'}"]`);
      if (worthRadio) worthRadio.checked = true;
      type = t.type;
      $('#deleteTransactionButton').classList.remove('hidden');
      $('#transactionDialogTitle').textContent = 'Edit money movement';
    }
    setTransactionType(type);
    $('#transactionDialog').showModal();
  }

  function openAccountDialog(id = null) {
    $('#accountForm').reset();
    $('#accountId').value = '';
    $('#accountOpeningBalance').value = '0';
    $('#deleteAccountButton').classList.add('hidden');
    $('#accountDialogTitle').textContent = 'Add what you own or owe';
    if (id) {
      const a = state.accounts.find(x => x.id === id);
      if (!a) return;
      $('#accountId').value = a.id;
      $('#accountName').value = a.name;
      $('#accountType').value = a.type;
      $('#accountOpeningBalance').value = a.openingBalance;
      $('#deleteAccountButton').classList.remove('hidden');
      $('#accountDialogTitle').textContent = 'Edit account';
    }
    $('#accountDialog').showModal();
  }

  function openSubscriptionDialog(id = null, rescue = false) {
    $('#subscriptionForm').reset();
    refreshAccountSelects();
    $('#subscriptionId').value = '';
    $('#deleteSubscriptionButton').classList.add('hidden');
    $('#subscriptionDialogTitle').textContent = rescue ? 'Add something you do not recognise' : 'Add subscription or recurring bill';
    $('#subscriptionStatus').value = rescue ? 'unknown' : 'active';
    $('#subscriptionWorth').value = rescue ? 'unsure' : 'essential';
    if (id) {
      const s = state.subscriptions.find(x => x.id === id);
      if (!s) return;
      $('#subscriptionId').value = s.id;
      $('#subscriptionName').value = s.name;
      $('#subscriptionAmount').value = s.amount;
      $('#subscriptionCycle').value = s.cycle;
      $('#subscriptionNextDate').value = s.nextDate || '';
      $('#subscriptionAccount').value = s.accountId || '';
      $('#subscriptionStatus').value = s.status;
      $('#subscriptionWorth').value = s.worth;
      $('#subscriptionCancelNotes').value = s.cancelNotes || '';
      $('#deleteSubscriptionButton').classList.remove('hidden');
      $('#subscriptionDialogTitle').textContent = 'Edit recurring payment';
    }
    updateSubscriptionPreview();
    $('#subscriptionDialog').showModal();
  }

  function closeDialogs() { $$('.app-dialog[open]').forEach(d => d.close()); }

  function saveTransaction(event) {
    event.preventDefault();
    const type = $('#transactionType').value;
    const amount = parseAmount($('#transactionAmount').value);
    if (amount <= 0) return showToast('Enter an amount greater than $0.');
    const accountId = $('#transactionAccount').value;
    const toAccountId = type === 'transfer' ? $('#transactionToAccount').value : '';
    if (state.accounts.length && !accountId) return showToast('Choose the account used.');
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) return showToast('Choose a different destination account.');
    const id = $('#transactionId').value;
    const record = {
      id: id || uid('txn'), type, amount,
      date: $('#transactionDate').value || todayISO(), merchant: $('#transactionMerchant').value.trim(),
      category: $('#transactionCategory').value || 'Other', accountId, toAccountId,
      worth: type === 'expense' ? ($('input[name="worth"]:checked')?.value || 'unsure') : '',
      notes: $('#transactionNotes').value.trim(), createdAt: id ? (state.transactions.find(t => t.id === id)?.createdAt || new Date().toISOString()) : new Date().toISOString()
    };
    if (!record.merchant) return showToast('Tell me what the money was for.');
    if (id) state.transactions = state.transactions.map(t => t.id === id ? record : t); else state.transactions.push(record);
    saveState();
    $('#transactionDialog').close();
    showToast(id ? 'Transaction updated.' : 'Money movement saved.');
  }

  function saveAccount(event) {
    event.preventDefault();
    const id = $('#accountId').value;
    const record = { id: id || uid('acc'), name: $('#accountName').value.trim(), type: $('#accountType').value, openingBalance: parseAmount($('#accountOpeningBalance').value), createdAt: id ? (state.accounts.find(a => a.id === id)?.createdAt || new Date().toISOString()) : new Date().toISOString() };
    if (!record.name) return showToast('Give the account a name.');
    if (id) state.accounts = state.accounts.map(a => a.id === id ? record : a); else state.accounts.push(record);
    saveState();
    $('#accountDialog').close();
    showToast(id ? 'Account updated.' : 'Account added.');
  }

  function saveSubscription(event) {
    event.preventDefault();
    const id = $('#subscriptionId').value;
    const record = {
      id: id || uid('sub'), name: $('#subscriptionName').value.trim(), amount: parseAmount($('#subscriptionAmount').value),
      cycle: $('#subscriptionCycle').value, nextDate: $('#subscriptionNextDate').value || '', accountId: $('#subscriptionAccount').value,
      status: $('#subscriptionStatus').value, worth: $('#subscriptionWorth').value, cancelNotes: $('#subscriptionCancelNotes').value.trim(),
      createdAt: id ? (state.subscriptions.find(s => s.id === id)?.createdAt || new Date().toISOString()) : new Date().toISOString()
    };
    if (!record.name) return showToast('Give the recurring payment a name.');
    if (id) state.subscriptions = state.subscriptions.map(s => s.id === id ? record : s); else state.subscriptions.push(record);
    saveState();
    $('#subscriptionDialog').close();
    showToast(id ? 'Recurring payment updated.' : 'Recurring payment saved.');
  }

  function updateSubscriptionPreview() {
    $('#subscriptionAnnualPreview').textContent = money(annualCost($('#subscriptionAmount').value, $('#subscriptionCycle').value));
  }

  function updateProtectAnnual() {
    $('#protectAnnual').textContent = money(annualCost($('#protectAmount').value, $('#protectCycle').value));
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function backup() {
    downloadFile(`every-cent-backup-${todayISO()}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2), 'application/json');
    showToast('Backup downloaded.');
  }

  function exportCsv() {
    const headers = ['Date','Type','Amount AUD','What','Category','Account','To account','Worth','Notes'];
    const rows = [...state.transactions].sort((a,b) => a.date.localeCompare(b.date)).map(t => [
      t.date, t.type, t.amount, t.merchant, t.category || '', accountById(t.accountId)?.name || '', accountById(t.toAccountId)?.name || '', t.worth || '', t.notes || ''
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
    downloadFile(`every-cent-transactions-${todayISO()}.csv`, csv, 'text/csv;charset=utf-8');
    showToast('Transactions exported.');
  }

  async function restore(file) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.subscriptions)) throw new Error('Invalid backup');
      state = { version: 1, accounts: parsed.accounts, transactions: parsed.transactions, subscriptions: parsed.subscriptions };
      saveState();
      showToast('Backup restored.');
    } catch {
      showToast('That file is not a valid Every Cent backup.');
    }
  }

  function deleteTransaction() {
    const id = $('#transactionId').value;
    if (!id) return;
    if (!confirm('Delete this money movement?')) return;
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveState(); $('#transactionDialog').close(); showToast('Deleted.');
  }

  function deleteAccount() {
    const id = $('#accountId').value;
    if (!id) return;
    const used = state.transactions.some(t => t.accountId === id || t.toAccountId === id) || state.subscriptions.some(s => s.accountId === id);
    if (used) return showToast('This account is used by transactions or subscriptions. Change those first.');
    if (!confirm('Delete this account?')) return;
    state.accounts = state.accounts.filter(a => a.id !== id);
    saveState(); $('#accountDialog').close(); showToast('Account deleted.');
  }

  function deleteSubscription() {
    const id = $('#subscriptionId').value;
    if (!id) return;
    if (!confirm('Delete this recurring payment record?')) return;
    state.subscriptions = state.subscriptions.filter(s => s.id !== id);
    saveState(); $('#subscriptionDialog').close(); showToast('Recurring payment deleted.');
  }

  function init() {
    $('#transactionCategory').innerHTML = CATEGORIES.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    $('#transactionDate').value = todayISO();

    $$('.nav-button').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.view)));
    $$('[data-view-link]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.viewLink)));
    $$('[data-quick]').forEach(btn => btn.addEventListener('click', () => openTransactionDialog(null, btn.dataset.quick)));
    $('#quickAddAccount').addEventListener('click', () => openAccountDialog());
    $('#addTransactionButton').addEventListener('click', () => openTransactionDialog());
    $('#addAccountButton').addEventListener('click', () => openAccountDialog());
    $('#addSubscriptionButton').addEventListener('click', () => openSubscriptionDialog());
    $('#startRescueButton').addEventListener('click', () => openSubscriptionDialog(null, true));
    $('#helpButton').addEventListener('click', () => $('#helpDialog').showModal());

    $$('[data-type-choice]').forEach(btn => btn.addEventListener('click', () => setTransactionType(btn.dataset.typeChoice)));
    $$('.dialog-close').forEach(btn => btn.addEventListener('click', () => btn.closest('dialog')?.close()));
    $('#transactionForm').addEventListener('submit', saveTransaction);
    $('#accountForm').addEventListener('submit', saveAccount);
    $('#subscriptionForm').addEventListener('submit', saveSubscription);
    $('#deleteTransactionButton').addEventListener('click', deleteTransaction);
    $('#deleteAccountButton').addEventListener('click', deleteAccount);
    $('#deleteSubscriptionButton').addEventListener('click', deleteSubscription);
    $('#transactionTypeFilter').addEventListener('change', renderTransactions);
    $('#transactionSearch').addEventListener('input', renderTransactions);
    $('#subscriptionAmount').addEventListener('input', updateSubscriptionPreview);
    $('#subscriptionCycle').addEventListener('change', updateSubscriptionPreview);
    $('#protectAmount').addEventListener('input', updateProtectAnnual);
    $('#protectCycle').addEventListener('change', updateProtectAnnual);
    $('#backupButton').addEventListener('click', backup);
    $('#restoreButton').addEventListener('click', () => $('#restoreInput').click());
    $('#restoreInput').addEventListener('change', e => { if (e.target.files?.[0]) restore(e.target.files[0]); e.target.value = ''; });
    $('#exportCsvButton').addEventListener('click', exportCsv);

    renderAll();
    navigate(activeView);

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(() => {}));
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
