# Invoice App

A web app to create invoices and download them as PDF, with a bilingual (Spanish / English) interface.

## Features

- Create, edit and delete invoices
- Automatic numbering (`INV-0001`, `INV-0002`, ...)
- Dynamic line items, tax (%), discount (%) and live totals
- Currencies: USD, EUR, MXN, COP, ARS, CLP, PEN, GBP
- PDF download in the invoice's own language (Spanish or English)
- Spanish / English UI switcher in the header
- Local SQLite persistence

## Requirements

- [Node.js](https://nodejs.org/) **22.5 or later**. The app uses the built-in `node:sqlite` module, which is still experimental and prints a warning on startup.

## Setup

```bash
npm install
npm start
```

Open http://localhost:3000. To use another port:

```bash
# PowerShell
$env:PORT = 4000; npm start

# bash
PORT=4000 npm start
```

Data is stored in `invoices.db`, which is created automatically in the project root.

## Project structure

```
server.js        Express: API routes, validation and static files
db.js            SQLite: schema, queries and totals calculation
pdf.js           PDF generation with pdfkit
public/
  index.html     UI (list + form)
  app.js         Frontend logic
  i18n.js        ES/EN strings
  styles.css     Styles (dark mode supported)
```

## API

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/invoices` | List invoices |
| POST | `/api/invoices` | Create an invoice (201) |
| GET | `/api/invoices/:id` | Get one invoice |
| PUT | `/api/invoices/:id` | Update an invoice |
| DELETE | `/api/invoices/:id` | Delete an invoice (204) |
| GET | `/api/invoices/:id/pdf` | Download the PDF |

Validation errors return `400` with `{ "error": "..." }`; an unknown id returns `404`.

### Example

```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Acme",
    "client_email": "billing@acme.test",
    "date": "2026-10-04",
    "due_date": "2026-11-04",
    "lang": "en",
    "currency": "EUR",
    "tax_rate": 21,
    "discount": 10,
    "notes": "Thank you!",
    "items": [{ "description": "Design", "quantity": 2, "unit_price": 100.5 }]
  }'
```

### Invoice fields

| Field | Type | Notes |
|-------|------|-------|
| `client_name` | string | Required |
| `client_email`, `client_address`, `notes` | string | Optional |
| `date` | `YYYY-MM-DD` | Required |
| `due_date` | `YYYY-MM-DD` | Optional |
| `lang` | `es` \| `en` | Defaults to `es` |
| `currency` | string | One of the supported currencies; defaults to `USD` |
| `tax_rate`, `discount` | number 0-100 | Percentages; default 0 |
| `items[]` | object | At least one: `description`, `quantity` (> 0), `unit_price` (>= 0) |

Total calculation: `(subtotal - discount) + tax`, where tax is applied to the already discounted subtotal.

## Security note

This app has no authentication. It is intended for local or personal use. Before exposing it to the internet, add authentication and put it behind a reverse proxy with HTTPS.
