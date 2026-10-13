# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install dependencies (only `express` and `pdfkit`)
- `npm start` — run the server at http://localhost:3000 (`PORT` env var overrides the port)

- `npm run lint` — ESLint (flat config in `eslint.config.js`; `public/` is linted as browser scripts, the rest as Node CommonJS)
- `npm test` — `node:test` suites in `test/`. Run one file with `node --test test/totals.test.js`, or one case with `--test-name-pattern "<name>"`.

`test/api.test.js` spawns `server.js` on a random port with `DB_PATH` pointing at a temp SQLite file, so it never touches `invoices.db`. There is no build step. UI changes still need checking in a browser; allow a few seconds for server startup before the first request.

## Architecture

Single-process Node app: an Express server exposes a JSON API and serves a vanilla JS frontend from `public/` (no bundler, no framework).

- `server.js` — routes and request validation. `validate()` normalises the body (trims strings, coerces numbers, defaults `lang` to `es` and unknown currencies to `USD`) and is the only place input rules live; the supported currency list is `CURRENCIES` here and is duplicated as `<option>`s in `public/index.html`.
- `db.js` — storage via Node's built-in `node:sqlite` (`DatabaseSync`, requires Node >= 22.5; prints an ExperimentalWarning). Creates `invoices.db` in the project root on load (override the path with the `DB_PATH` env var). Invoices and `invoice_items` are separate tables; every read goes through `withItems()`, which attaches items and a `totals` object. Updates delete and re-insert all items inside `transaction()`.
- `pdf.js` — streams a PDF to the HTTP response with pdfkit. Labels come from its own `TEXT` table keyed by the invoice's `lang`.
- `public/` — `app.js` drives the list/form views; `i18n.js` holds UI strings.

### Things that span files

- **Totals math exists twice:** `computeTotals()` in `totals.js` (kept separate from `db.js` so it can be tested without opening the database; authoritative, used by the API and PDF) and `updateTotals()` in `public/app.js` (live preview only). Discount is a percentage applied to the subtotal first, then tax is applied to the discounted amount. Change both together.
- **Two separate languages:** the UI language (`uiLang`, stored in `localStorage`, strings in `public/i18n.js`) is independent of each invoice's `lang` field (stored in the DB, used for the PDF via `pdf.js`). Adding a language means updating `i18n.js`, `pdf.js` `TEXT`, the language `<select>`s in `index.html`, and the `lang` check in `server.js`.
- **Invoice numbers** come from `MAX(id) + 1` over existing rows (`nextNumber()` in `db.js`), not from the AUTOINCREMENT counter. Deleting the newest invoice therefore makes its number get reused, and a number can end up differing from its row id.
- The frontend builds table rows with `textContent` (not `innerHTML`) for user data to avoid XSS; keep that when editing `renderList()`.
