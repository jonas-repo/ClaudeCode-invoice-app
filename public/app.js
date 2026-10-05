const $ = (sel) => document.querySelector(sel);
const form = $('#form');
let uiLang = 'es';
let editingId = null;
let invoices = [];

try { uiLang = localStorage.getItem('uiLang') || 'es'; } catch {}
if (!I18N[uiLang]) uiLang = 'es';

const t = (key) => I18N[uiLang][key];
const money = (n, currency) =>
  new Intl.NumberFormat(uiLang === 'en' ? 'en-US' : 'es-ES', { style: 'currency', currency }).format(n);

function applyI18n() {
  document.documentElement.lang = uiLang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('#items [data-ph]').forEach((el) => { el.placeholder = t(el.dataset.ph); });
  $('#uiLang').value = uiLang;
  if (!$('#formView').hidden) $('#formTitle').textContent = editingId ? t('editInvoice') : t('newInvoice');
  renderList();
  updateTotals();
}

async function api(url, options) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return res.status === 204 ? null : res.json();
}

async function loadInvoices() {
  invoices = await api('/api/invoices');
  renderList();
}

function renderList() {
  const rows = $('#rows');
  rows.replaceChildren();
  $('#empty').hidden = invoices.length > 0;
  for (const inv of invoices) {
    const tr = document.createElement('tr');
    const cell = (text, cls) => {
      const td = document.createElement('td');
      td.textContent = text;
      if (cls) td.className = cls;
      tr.append(td);
    };
    cell(inv.number);
    cell(inv.client_name);
    cell(inv.date);
    cell(money(inv.totals.total, inv.currency), 'right');

    const td = document.createElement('td');
    const box = document.createElement('div');
    box.className = 'row-actions';
    const btn = (label, onClick, cls) => {
      const b = document.createElement('button');
      b.textContent = label;
      if (cls) b.className = cls;
      b.addEventListener('click', onClick);
      box.append(b);
    };
    btn(t('pdf'), () => { window.location.href = `/api/invoices/${inv.id}/pdf`; });
    btn(t('edit'), () => showForm(inv));
    btn(t('delete'), async () => {
      if (!confirm(t('confirmDelete'))) return;
      await api(`/api/invoices/${inv.id}`, { method: 'DELETE' });
      loadInvoices();
    }, 'danger');
    td.append(box);
    tr.append(td);
    rows.append(tr);
  }
}

function addItemRow(item = { description: '', quantity: 1, unit_price: 0 }) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <input data-f="description" data-ph="description" required>
    <input data-f="quantity" data-ph="qty" type="number" min="0.01" step="any" required>
    <input data-f="unit_price" data-ph="price" type="number" min="0" step="any" required>
    <span class="line-total"></span>
    <button type="button" class="danger" aria-label="remove">&times;</button>`;
  row.querySelector('[data-f=description]').value = item.description;
  row.querySelector('[data-f=quantity]').value = item.quantity;
  row.querySelector('[data-f=unit_price]').value = item.unit_price;
  row.querySelector('button').addEventListener('click', () => {
    if (document.querySelectorAll('.item-row').length > 1) { row.remove(); updateTotals(); }
  });
  $('#items').append(row);
  row.querySelectorAll('[data-ph]').forEach((el) => { el.placeholder = t(el.dataset.ph); });
}

function readItems() {
  return [...document.querySelectorAll('.item-row')].map((row) => ({
    description: row.querySelector('[data-f=description]').value,
    quantity: row.querySelector('[data-f=quantity]').value,
    unit_price: row.querySelector('[data-f=unit_price]').value,
  }));
}

// Preview only; the server recomputes the authoritative totals.
function updateTotals() {
  const currency = form.currency.value;
  let subtotal = 0;
  document.querySelectorAll('.item-row').forEach((row) => {
    const q = Number(row.querySelector('[data-f=quantity]').value) || 0;
    const p = Number(row.querySelector('[data-f=unit_price]').value) || 0;
    subtotal += q * p;
    row.querySelector('.line-total').textContent = money(q * p, currency);
  });
  const discount = subtotal * ((Number(form.discount.value) || 0) / 100);
  const tax = (subtotal - discount) * ((Number(form.tax_rate.value) || 0) / 100);
  $('#tSubtotal').textContent = money(subtotal, currency);
  $('#tDiscount').textContent = '-' + money(discount, currency);
  $('#tTax').textContent = money(tax, currency);
  $('#tTotal').textContent = money(subtotal - discount + tax, currency);
}

function showList() {
  $('#formView').hidden = true;
  $('#listView').hidden = false;
  $('#newBtn').hidden = false;
}

function showForm(inv) {
  editingId = inv ? inv.id : null;
  form.reset();
  $('#items').replaceChildren();
  $('#formError').hidden = true;
  const today = new Date().toISOString().slice(0, 10);
  const src = inv || { date: today, currency: 'USD', lang: uiLang, tax_rate: 0, discount: 0, items: [undefined] };
  for (const name of ['client_name', 'client_email', 'client_address', 'date', 'due_date', 'currency', 'lang', 'tax_rate', 'discount', 'notes']) {
    form[name].value = src[name] ?? '';
  }
  src.items.forEach((i) => addItemRow(i));
  $('#listView').hidden = true;
  $('#newBtn').hidden = true;
  $('#formView').hidden = false;
  $('#formTitle').textContent = inv ? t('editInvoice') : t('newInvoice');
  updateTotals();
}

form.addEventListener('input', updateTotals);
$('#addItem').addEventListener('click', () => { addItemRow(); updateTotals(); });
$('#newBtn').addEventListener('click', () => showForm(null));
$('#cancelBtn').addEventListener('click', showList);
$('#uiLang').addEventListener('change', (e) => {
  uiLang = e.target.value;
  try { localStorage.setItem('uiLang', uiLang); } catch {}
  applyI18n();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(form));
  payload.items = readItems();
  try {
    if (editingId) await api(`/api/invoices/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
    else await api('/api/invoices', { method: 'POST', body: JSON.stringify(payload) });
    showList();
    loadInvoices();
  } catch (err) {
    const el = $('#formError');
    el.textContent = `${t('saveError')}: ${err.message}`;
    el.hidden = false;
  }
});

applyI18n();
loadInvoices();
