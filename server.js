const express = require('express');
const path = require('path');
const db = require('./db');
const { streamInvoicePdf } = require('./pdf');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const CURRENCIES = ['USD', 'EUR', 'MXN', 'COP', 'ARS', 'CLP', 'PEN', 'GBP'];

// Returns { error } or { data } with a normalised invoice payload.
function validate(body) {
  const b = body || {};
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const num = (v) => (v === '' || v == null ? NaN : Number(v));

  if (!str(b.client_name)) return { error: 'client_name is required' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str(b.date))) return { error: 'date must be YYYY-MM-DD' };
  if (str(b.due_date) && !/^\d{4}-\d{2}-\d{2}$/.test(str(b.due_date))) return { error: 'due_date must be YYYY-MM-DD' };
  if (!Array.isArray(b.items) || b.items.length === 0) return { error: 'at least one item is required' };

  const items = [];
  for (const i of b.items) {
    const quantity = num(i.quantity);
    const unit_price = num(i.unit_price);
    if (!str(i.description)) return { error: 'item description is required' };
    if (!(quantity > 0)) return { error: 'item quantity must be greater than 0' };
    if (!(unit_price >= 0)) return { error: 'item unit_price must be 0 or more' };
    items.push({ description: str(i.description), quantity, unit_price });
  }

  const tax_rate = num(b.tax_rate ?? 0);
  const discount = num(b.discount ?? 0);
  if (!(tax_rate >= 0 && tax_rate <= 100)) return { error: 'tax_rate must be between 0 and 100' };
  if (!(discount >= 0 && discount <= 100)) return { error: 'discount must be between 0 and 100' };

  const currency = CURRENCIES.includes(b.currency) ? b.currency : 'USD';
  return {
    data: {
      date: str(b.date),
      due_date: str(b.due_date) || null,
      lang: b.lang === 'en' ? 'en' : 'es',
      currency,
      client_name: str(b.client_name),
      client_email: str(b.client_email) || null,
      client_address: str(b.client_address) || null,
      tax_rate,
      discount,
      notes: str(b.notes) || null,
      items,
    },
  };
}

app.get('/api/invoices', (req, res) => res.json(db.listInvoices()));

app.post('/api/invoices', (req, res) => {
  const { error, data } = validate(req.body);
  if (error) return res.status(400).json({ error });
  res.status(201).json(db.createInvoice(data));
});

app.get('/api/invoices/:id', (req, res) => {
  const inv = db.getInvoice(Number(req.params.id));
  if (!inv) return res.status(404).json({ error: 'not found' });
  res.json(inv);
});

app.put('/api/invoices/:id', (req, res) => {
  const { error, data } = validate(req.body);
  if (error) return res.status(400).json({ error });
  const inv = db.updateInvoice(Number(req.params.id), data);
  if (!inv) return res.status(404).json({ error: 'not found' });
  res.json(inv);
});

app.delete('/api/invoices/:id', (req, res) => {
  if (!db.deleteInvoice(Number(req.params.id))) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

app.get('/api/invoices/:id/pdf', (req, res) => {
  const inv = db.getInvoice(Number(req.params.id));
  if (!inv) return res.status(404).json({ error: 'not found' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${inv.number}.pdf"`);
  streamInvoicePdf(inv, res);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Invoice app running at http://localhost:${port}`));
