const PDFDocument = require('pdfkit');

const TEXT = {
  es: {
    invoice: 'FACTURA', billTo: 'Facturar a', date: 'Fecha', due: 'Vencimiento',
    description: 'Descripción', qty: 'Cant.', price: 'Precio', amount: 'Importe',
    subtotal: 'Subtotal', discount: 'Descuento', tax: 'Impuesto', total: 'Total', notes: 'Notas',
  },
  en: {
    invoice: 'INVOICE', billTo: 'Bill to', date: 'Date', due: 'Due date',
    description: 'Description', qty: 'Qty', price: 'Price', amount: 'Amount',
    subtotal: 'Subtotal', discount: 'Discount', tax: 'Tax', total: 'Total', notes: 'Notes',
  },
};

function streamInvoicePdf(invoice, res) {
  const t = TEXT[invoice.lang] || TEXT.es;
  const locale = invoice.lang === 'en' ? 'en-US' : 'es-ES';
  const money = (n) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: invoice.currency }).format(n);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);

  doc.fontSize(24).font('Helvetica-Bold').text(t.invoice, 50, 50);
  doc.fontSize(12).font('Helvetica').text(invoice.number, 50, 80);
  doc.fontSize(10)
    .text(`${t.date}: ${invoice.date}`, 350, 55, { align: 'right', width: 195 })
    .text(invoice.due_date ? `${t.due}: ${invoice.due_date}` : '', 350, 70, { align: 'right', width: 195 });

  doc.font('Helvetica-Bold').fontSize(10).text(t.billTo, 50, 120);
  doc.font('Helvetica').text(invoice.client_name, 50, 135);
  if (invoice.client_email) doc.text(invoice.client_email);
  if (invoice.client_address) doc.text(invoice.client_address);

  const colX = { desc: 50, qty: 320, price: 390, amount: 470 };
  let y = Math.max(doc.y + 25, 210);
  doc.rect(50, y - 5, 495, 20).fill('#eeeeee');
  doc.fillColor('#000').font('Helvetica-Bold');
  doc.text(t.description, colX.desc, y, { width: 260 });
  doc.text(t.qty, colX.qty, y, { width: 60, align: 'right' });
  doc.text(t.price, colX.price, y, { width: 70, align: 'right' });
  doc.text(t.amount, colX.amount, y, { width: 75, align: 'right' });
  y += 25;

  doc.font('Helvetica');
  for (const item of invoice.items) {
    const h = doc.heightOfString(item.description, { width: 260 });
    if (y + h > 720) { doc.addPage(); y = 50; }
    doc.text(item.description, colX.desc, y, { width: 260 });
    doc.text(String(item.quantity), colX.qty, y, { width: 60, align: 'right' });
    doc.text(money(item.unit_price), colX.price, y, { width: 70, align: 'right' });
    doc.text(money(item.quantity * item.unit_price), colX.amount, y, { width: 75, align: 'right' });
    y += Math.max(h, 12) + 8;
  }

  if (y > 650) { doc.addPage(); y = 50; }
  y += 10;
  doc.moveTo(320, y).lineTo(545, y).stroke('#999');
  y += 10;
  const { subtotal, discountAmount, taxAmount, total } = invoice.totals;
  const row = (label, value, bold) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10);
    doc.text(label, 320, y, { width: 100 });
    doc.text(value, 420, y, { width: 125, align: 'right' });
    y += bold ? 20 : 16;
  };
  row(t.subtotal, money(subtotal));
  if (invoice.discount) row(`${t.discount} (${invoice.discount}%)`, '-' + money(discountAmount));
  if (invoice.tax_rate) row(`${t.tax} (${invoice.tax_rate}%)`, money(taxAmount));
  row(t.total, money(total), true);

  if (invoice.notes) {
    doc.font('Helvetica-Bold').fontSize(10).text(t.notes, 50, y + 20);
    doc.font('Helvetica').text(invoice.notes, 50, doc.y + 4, { width: 495 });
  }
  doc.end();
}

module.exports = { streamInvoicePdf };
