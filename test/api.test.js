const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 3100 + Math.floor(Math.random() * 500);
const BASE = `http://localhost:${PORT}`;
const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'invoice-test-')), 'test.db');
let server;

const valid = {
  client_name: 'Acme',
  date: '2026-10-04',
  lang: 'en',
  currency: 'EUR',
  tax_rate: 21,
  discount: 10,
  items: [{ description: 'Design', quantity: 2, unit_price: 100.5 }],
};

const post = (body) =>
  fetch(`${BASE}/api/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

test.before(async () => {
  server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), DB_PATH: dbPath },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`${BASE}/api/invoices`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error('server did not start');
});

test.after(async () => {
  // Wait for exit: on Windows the SQLite file stays locked until the process is gone.
  const exited = new Promise((resolve) => server.once('exit', resolve));
  server.kill();
  await exited;
  fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
});

test('creates an invoice with server-computed totals and sequential number', async () => {
  const res = await post(valid);
  assert.equal(res.status, 201);
  const inv = await res.json();
  assert.equal(inv.number, 'INV-0001');
  assert.ok(Math.abs(inv.totals.total - 218.889) < 1e-9);
});

test('rejects invalid payloads with 400', async () => {
  assert.equal((await post({ ...valid, client_name: '' })).status, 400);
  assert.equal((await post({ ...valid, items: [] })).status, 400);
  assert.equal((await post({ ...valid, items: [{ description: 'x', quantity: -1, unit_price: 1 }] })).status, 400);
  assert.equal((await post({ ...valid, tax_rate: 150 })).status, 400);
});

test('returns 404 for unknown invoices', async () => {
  assert.equal((await fetch(`${BASE}/api/invoices/9999`)).status, 404);
  assert.equal((await fetch(`${BASE}/api/invoices/9999/pdf`)).status, 404);
});

test('serves a PDF for an existing invoice', async () => {
  const { id } = await (await post(valid)).json();
  const res = await fetch(`${BASE}/api/invoices/${id}/pdf`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(buf.subarray(0, 4).toString(), '%PDF');
});

test('updates and deletes an invoice', async () => {
  const { id } = await (await post(valid)).json();
  const put = await fetch(`${BASE}/api/invoices/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...valid, client_name: 'Globex' }),
  });
  assert.equal(put.status, 200);
  assert.equal((await put.json()).client_name, 'Globex');
  assert.equal((await fetch(`${BASE}/api/invoices/${id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await fetch(`${BASE}/api/invoices/${id}`)).status, 404);
});
