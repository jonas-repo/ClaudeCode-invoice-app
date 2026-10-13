// Discount is a percentage of the subtotal; tax is applied to the discounted amount.
function computeTotals(invoice) {
  const subtotal = invoice.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const discountAmount = subtotal * (invoice.discount / 100);
  const taxable = subtotal - discountAmount;
  const taxAmount = taxable * (invoice.tax_rate / 100);
  return { subtotal, discountAmount, taxAmount, total: taxable + taxAmount };
}

module.exports = { computeTotals };
