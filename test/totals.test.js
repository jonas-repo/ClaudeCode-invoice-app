const test = require('node:test');
const assert = require('node:assert/strict');
const { computeTotals } = require('../totals');

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !== ${expected}`);

test('sums line items without tax or discount', () => {
  const t = computeTotals({
    discount: 0,
    tax_rate: 0,
    items: [
      { quantity: 2, unit_price: 10 },
      { quantity: 1, unit_price: 5.5 },
    ],
  });
  near(t.subtotal, 25.5);
  near(t.total, 25.5);
});

test('applies discount first, then tax on the discounted amount', () => {
  const t = computeTotals({
    discount: 10,
    tax_rate: 21,
    items: [{ quantity: 2, unit_price: 100.5 }],
  });
  near(t.subtotal, 201);
  near(t.discountAmount, 20.1);
  near(t.taxAmount, 180.9 * 0.21);
  near(t.total, 218.889);
});
