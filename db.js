const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const { computeTotals } = require('./totals');

const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, 'invoices.db'));
db.exec('PRAGMA foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT NOT NULL UNIQUE,
    date TEXT NOT NULL,
    due_date TEXT,
    lang TEXT NOT NULL DEFAULT 'es',
    currency TEXT NOT NULL DEFAULT 'USD',
    client_name TEXT NOT NULL,
    client_email TEXT,
    client_address TEXT,
    tax_rate REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL
  );
`);

function withItems(row) {
  if (!row) return null;
  const items = db
    .prepare('SELECT description, quantity, unit_price FROM invoice_items WHERE invoice_id = ? ORDER BY id')
    .all(row.id);
  const invoice = { ...row, items };
  return { ...invoice, totals: computeTotals(invoice) };
}

function nextNumber() {
  const row = db.prepare('SELECT MAX(id) AS m FROM invoices').get();
  return 'INV-' + String((row.m || 0) + 1).padStart(4, '0');
}

function insertItems(invoiceId, items) {
  const stmt = db.prepare(
    'INSERT INTO invoice_items (invoice_id, description, quantity, unit_price) VALUES (?, ?, ?, ?)'
  );
  for (const i of items) stmt.run(invoiceId, i.description, i.quantity, i.unit_price);
}

function transaction(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function listInvoices() {
  return db
    .prepare('SELECT id FROM invoices ORDER BY id DESC')
    .all()
    .map((r) => withItems(db.prepare('SELECT * FROM invoices WHERE id = ?').get(r.id)));
}

function getInvoice(id) {
  return withItems(db.prepare('SELECT * FROM invoices WHERE id = ?').get(id));
}

function createInvoice(d) {
  return transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO invoices (number, date, due_date, lang, currency, client_name, client_email,
           client_address, tax_rate, discount, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(nextNumber(), d.date, d.due_date, d.lang, d.currency, d.client_name, d.client_email,
        d.client_address, d.tax_rate, d.discount, d.notes);
    const id = Number(info.lastInsertRowid);
    insertItems(id, d.items);
    return getInvoice(id);
  });
}

function updateInvoice(id, d) {
  return transaction(() => {
    const info = db
      .prepare(
        `UPDATE invoices SET date=?, due_date=?, lang=?, currency=?, client_name=?, client_email=?,
           client_address=?, tax_rate=?, discount=?, notes=? WHERE id=?`
      )
      .run(d.date, d.due_date, d.lang, d.currency, d.client_name, d.client_email,
        d.client_address, d.tax_rate, d.discount, d.notes, id);
    if (info.changes === 0) return null;
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);
    insertItems(id, d.items);
    return getInvoice(id);
  });
}

function deleteInvoice(id) {
  return db.prepare('DELETE FROM invoices WHERE id = ?').run(id).changes > 0;
}

module.exports = { listInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice };
