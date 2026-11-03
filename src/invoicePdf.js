import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { calculatePaymentBreakdown } from './invoicePayments.js';

const PAGE_WIDTH = 210;
const MARGIN = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const COLORS = {
  ink: [28, 36, 54],
  muted: [111, 121, 139],
  line: [228, 232, 240],
  pale: [247, 248, 252],
  violet: [113, 100, 245],
  white: [255, 255, 255],
};

function textLines(doc, value, width) {
  return doc.splitTextToSize(String(value || ''), width);
}

function drawWrapped(doc, value, x, y, width, options = {}) {
  const lines = textLines(doc, value, width);
  doc.setFont(options.font || 'helvetica', options.style || 'normal');
  doc.setFontSize(options.size || 8);
  doc.setTextColor(...(options.color || COLORS.ink));
  doc.text(lines, x, y, { lineHeightFactor: options.lineHeight || 1.25 });
  return lines.length;
}

function formatAmount(amount, currency) {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(amount) || 0);
  return `${currency || 'INR'} ${formatted}`;
}

function addHeader(doc, invoice, profile) {
  doc.setFillColor(...COLORS.ink);
  doc.rect(0, 0, PAGE_WIDTH, 48, 'F');
  doc.setFillColor(...COLORS.violet);
  doc.rect(0, 48, PAGE_WIDTH, 2, 'F');

  doc.setFillColor(...COLORS.violet);
  doc.roundedRect(MARGIN, 11, 16, 16, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.white);
  doc.text('IS', MARGIN + 8, 21, { align: 'center' });

  const businessName = profile.businessName || 'Your Business';
  doc.setFontSize(11);
  doc.text(textLines(doc, businessName, 86).slice(0, 2), 37, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(218, 222, 234);
  const contact = [profile.email, profile.phone].filter(Boolean).join('  ·  ');
  const businessLines = [profile.address, contact].filter(Boolean);
  if (businessLines.length) {
    doc.text(textLines(doc, businessLines.join('\n'), 92).slice(0, 3), 37, 22);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.white);
  doc.text('INVOICE', PAGE_WIDTH - MARGIN, 17, { align: 'right' });
  doc.setFontSize(9);
  doc.text(String(invoice.invoiceNo || 'Draft invoice'), PAGE_WIDTH - MARGIN, 25, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(218, 222, 234);
  doc.text(`ISSUED  ${invoice.issueDate || '—'}`, PAGE_WIDTH - MARGIN, 33, { align: 'right' });
  doc.text(`DUE  ${invoice.dueDate || '—'}`, PAGE_WIDTH - MARGIN, 40, { align: 'right' });
}

function addFooter(doc, pageNumber, pageCount) {
  doc.setDrawColor(...COLORS.line);
  doc.line(MARGIN, 284, PAGE_WIDTH - MARGIN, 284);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.muted);
  doc.text('Thank you for your business.', MARGIN, 290);
  doc.text(`${pageNumber} / ${pageCount}`, PAGE_WIDTH - MARGIN, 290, { align: 'right' });
}

function addTableHeader(doc, y) {
  doc.setFillColor(...COLORS.ink);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.white);
  doc.text('DESCRIPTION', MARGIN + 4, y + 6.5);
  doc.text('QTY', 119, y + 6.5, { align: 'right' });
  doc.text('RATE', 155, y + 6.5, { align: 'right' });
  doc.text('AMOUNT', PAGE_WIDTH - MARGIN - 4, y + 6.5, { align: 'right' });
  return y + 10;
}

function startPage(doc, invoice, profile) {
  doc.addPage();
  addHeader(doc, invoice, profile);
  return 60;
}

function drawMetadata(doc, invoice) {
  const y = 60;
  const gap = 5;
  const cardWidth = (CONTENT_WIDTH - gap) / 2;
  doc.setFillColor(...COLORS.pale);
  doc.roundedRect(MARGIN, y, cardWidth, 39, 2, 2, 'F');
  doc.roundedRect(MARGIN + cardWidth + gap, y, cardWidth, 39, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...COLORS.violet);
  doc.text('BILL TO', MARGIN + 4, y + 7);
  doc.text('PROJECT & DATES', MARGIN + cardWidth + gap + 4, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.ink);
  doc.text(textLines(doc, invoice.clientName || 'Client name', cardWidth - 8).slice(0, 1), MARGIN + 4, y + 15);
  drawWrapped(doc, [invoice.clientEmail, invoice.clientAddress].filter(Boolean).join('\n') || 'Billing details not provided', MARGIN + 4, y + 21, cardWidth - 8, { size: 7, color: COLORS.muted, lineHeight: 1.2 });

  const rightX = MARGIN + cardWidth + gap + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.ink);
  doc.text(textLines(doc, invoice.projectName || invoice.items[0]?.description || 'Project work', cardWidth - 8).slice(0, 1), rightX, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.muted);
  doc.text(`Currency  ${invoice.currency || 'INR'}`, rightX, y + 23);
  doc.text(`Status  ${invoice.status || 'Draft'}`, rightX, y + 30);
}

function drawTotals(doc, invoice, subtotal, tax, total, payment, startY) {
  const discount = Math.max(0, Number(invoice.discount || 0));
  const rows = [
    ['Subtotal', formatAmount(subtotal, invoice.currency)]
  ];
  if (discount > 0) rows.push(['Discount', `- ${formatAmount(discount, invoice.currency)}`]);
  rows.push(
    [`Tax (${Number(invoice.taxPercent || 0)}%)`, formatAmount(tax, invoice.currency)],
    ['Project total', formatAmount(total, invoice.currency)],
    ['Initial payment received', `- ${formatAmount(payment.previouslyPaid, invoice.currency)}`],
    ['Balance before this payment', formatAmount(payment.balanceBeforeCurrentPayment, invoice.currency)],
    ['Balance remaining after payment', formatAmount(payment.remainingAfterCurrentPayment, invoice.currency)]
  );

  const x = PAGE_WIDTH - MARGIN - 80;
  let y = startY;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  rows.forEach(([label, amount]) => {
    doc.setTextColor(...COLORS.muted);
    doc.text(label, x, y);
    doc.setTextColor(...COLORS.ink);
    doc.text(amount, PAGE_WIDTH - MARGIN, y, { align: 'right' });
    y += 6;
  });

  doc.setFillColor(...COLORS.violet);
  doc.roundedRect(x - 3, y - 1, 83, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.white);
  doc.text('AMOUNT PAYING NOW', x + 1, y + 7.5);
  doc.setFontSize(10);
  doc.text(formatAmount(payment.dueNow, invoice.currency), PAGE_WIDTH - MARGIN - 3, y + 7.5, { align: 'right' });
  return y + 19;
}

async function imageAsPng(dataUrl) {
  const image = new Image();
  image.src = dataUrl;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('The saved payment QR image could not be loaded.'));
  });
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the payment QR image for the PDF.');
  context.drawImage(image, 0, 0);
  return canvas.toDataURL('image/png');
}

async function getPaymentQr(profile, upiUrl) {
  if (profile.qrImage) return imageAsPng(profile.qrImage);
  if (!upiUrl) return null;
  return QRCode.toDataURL(upiUrl, {
    margin: 1,
    width: 256,
    color: { dark: '#1C2436', light: '#FFFFFF' }
  });
}

function drawPayments(doc, profile, qrData, upiUrl, startY) {
  const y = startY;
  const gap = 5;
  const cardWidth = (CONTENT_WIDTH - gap) / 2;
  const cardHeight = 45;
  const leftX = MARGIN;
  const rightX = MARGIN + cardWidth + gap;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.violet);
  doc.text('PAYMENT DETAILS', leftX, y);

  doc.setFillColor(...COLORS.pale);
  doc.roundedRect(leftX, y + 4, cardWidth, cardHeight, 2, 2, 'F');
  doc.roundedRect(rightX, y + 4, cardWidth, cardHeight, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.ink);
  doc.text('UPI PAYMENT', leftX + 4, y + 12);
  doc.text('BANK TRANSFER', rightX + 4, y + 12);

  if (qrData) {
    doc.addImage(qrData, 'PNG', leftX + 4, y + 15, 27, 27);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.ink);
    doc.text(textLines(doc, profile.upiName || profile.businessName || 'Account holder', 48).slice(0, 2), leftX + 35, y + 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(textLines(doc, profile.upiId || (upiUrl ? 'Scan to pay' : 'Custom payment QR'), 48).slice(0, 2), leftX + 35, y + 30);
  } else {
    drawWrapped(doc, profile.upiId ? `${profile.upiName || profile.businessName || ''}\n${profile.upiId}` : 'UPI details not configured.', leftX + 4, y + 21, cardWidth - 8, { size: 7, color: COLORS.muted });
  }

  const bankDetails = [
    ['Account name', profile.accountName || profile.businessName],
    ['Bank', profile.bankName],
    ['Account no.', profile.accountNumber],
    ['IFSC', profile.ifsc]
  ].filter(([, value]) => value);
  if (bankDetails.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    bankDetails.forEach(([label, value], index) => {
      const lineY = y + 19 + index * 6;
      doc.setTextColor(...COLORS.muted);
      doc.text(`${label}:`, rightX + 4, lineY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.ink);
      doc.text(textLines(doc, String(value), cardWidth - 31).slice(0, 1), rightX + 26, lineY);
      doc.setFont('helvetica', 'normal');
    });
  } else {
    drawWrapped(doc, 'Bank transfer details not configured.', rightX + 4, y + 21, cardWidth - 8, { size: 7, color: COLORS.muted });
  }
  return y + cardHeight + 8;
}

function drawNotes(doc, notes, invoice, profile, startY) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setCharSpace(0);
  const noteLines = textLines(doc, notes, CONTENT_WIDTH - 100);
  let offset = 0;
  let y = startY;

  while (offset < noteLines.length) {
    const heading = offset === 0 ? 'NOTES & TERMS' : 'NOTES & TERMS (CONTINUED)';
    const availableLines = Math.floor((278 - y - 16) / 4.5);
    if (availableLines < 1) {
      y = startPage(doc, invoice, profile) + 4;
      continue;
    }

    const pageLines = noteLines.slice(offset, offset + availableLines);
    const cardHeight = 12 + pageLines.length * 4.5;
    doc.setFillColor(...COLORS.pale);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, cardHeight, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.violet);
    doc.setCharSpace(0);
    doc.text(heading, MARGIN + 8, y + 6, { align: 'left' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.ink);
    pageLines.forEach((line, index) => {
      doc.setCharSpace(0);
      doc.text(line, MARGIN + 8, y + 12 + index * 4.5, { align: 'left' });
    });

    offset += pageLines.length;
    y += cardHeight + 5;
    if (offset < noteLines.length) y = startPage(doc, invoice, profile) + 4;
  }
}

function cleanFilename(value) {
  return String(value || 'invoice').replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').trim() || 'invoice';
}

export async function downloadInvoicePdf({ invoice, profile, subtotal, tax, total, payment, upiUrl }) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm', compress: true });
  const paymentBreakdown = payment || calculatePaymentBreakdown(invoice, total);
  doc.setProperties({
    title: `Invoice ${invoice.invoiceNo || ''}`.trim(),
    subject: `Invoice for ${invoice.clientName || 'client'}`,
    author: profile.businessName || 'Invoice Studio'
  });
  addHeader(doc, invoice, profile);
  drawMetadata(doc, invoice);
  let y = 108;
  y = addTableHeader(doc, y);

  for (const [index, item] of invoice.items.entries()) {
    const description = textLines(doc, item.description || 'Work item', 88);
    const details = item.details ? textLines(doc, item.details, 88) : [];
    const rowHeight = Math.max(12, 4 + description.length * 4 + details.length * 3.2);
    if (y + rowHeight > 268) {
      y = startPage(doc, invoice, profile) + 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.ink);
      doc.text('ITEMS (CONTINUED)', MARGIN, y);
      y += 5;
      y = addTableHeader(doc, y);
    }

    if (index % 2 === 1) {
      doc.setFillColor(...COLORS.pale);
      doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.ink);
    doc.text(description, MARGIN + 4, y + 5);
    if (details.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...COLORS.muted);
      doc.text(details, MARGIN + 4, y + 5 + description.length * 4);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.ink);
    doc.text(String(Number(item.quantity || 0)), 119, y + 6, { align: 'right' });
    doc.text(formatAmount(item.rate, invoice.currency), 155, y + 6, { align: 'right' });
    doc.text(formatAmount(Number(item.quantity || 0) * Number(item.rate || 0), invoice.currency), PAGE_WIDTH - MARGIN - 4, y + 6, { align: 'right' });
    doc.setDrawColor(...COLORS.line);
    doc.line(MARGIN, y + rowHeight, PAGE_WIDTH - MARGIN, y + rowHeight);
    y += rowHeight;
  }

  if (y + 58 > 276) y = startPage(doc, invoice, profile) + 6;
  y += 6;
  y = drawTotals(doc, invoice, subtotal, tax, total, paymentBreakdown, y);

  const qrData = await getPaymentQr(profile, upiUrl);
  if (y + 54 > 278) y = startPage(doc, invoice, profile) + 4;
  y = drawPayments(doc, profile, qrData, upiUrl, y);

  if (invoice.notes) {
    if (y + 22 > 278) y = startPage(doc, invoice, profile) + 4;
    drawNotes(doc, invoice.notes, invoice, profile, y);
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    addFooter(doc, page, pageCount);
  }
  return {
    blob: doc.output('blob'),
    filename: `${cleanFilename(invoice.invoiceNo)}.pdf`
  };
}
