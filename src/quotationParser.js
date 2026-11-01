export function parseZibixoQuotation(rows) {
  const allText = rows.flatMap(row => row.items.map(item => item.text)).join(' ');
  if (!/PROJECT QUOTATION/i.test(allText) || !/PHASE 1 FEE BREAKDOWN/i.test(allText) || !/PHASE 1 TOTAL/i.test(allText)) {
    return null;
  }

  const rowText = row => row.items.map(item => item.text).join(' ').replace(/\s+/g, ' ').trim();
  const amountFromRightOf = (row, label) => {
    const labelItem = row.items.find(item => label.test(item.text));
    if (!labelItem) return 0;
    const value = row.items
      .filter(item => item.x > labelItem.x && /(?:₹|INR|\$|USD|CAD|EUR|GBP|AUD)?\s*\d[\d,]*(?:\.\d{1,2})?/.test(item.text))
      .map(item => Number((item.text.match(/\d[\d,]*(?:\.\d{1,2})?/) || ['0'])[0].replace(/,/g, '')))[0];
    return value || 0;
  };
  const preparedForIndex = rows.findIndex(row => row.items.some(item => /PREPARED FOR/i.test(item.text)));
  const clientName = preparedForIndex >= 0
    ? rows[preparedForIndex + 1]?.items.find(item => item.x < 200)?.text || ''
    : '';
  const projectName = rows.map(rowText).find(text => /ZIBIXO Corporate Website\s*[—-]\s*Phase 1 Frontend/i.test(text)) || 'Phase 1 Website Development';
  const quotationReference = (allText.match(/\b[A-Z]{2,6}-[A-Z]{2,6}-\d{4}-\d{2}\b/) || [])[0] || '';

  const totalRow = rows.find(row => row.items.some(item => /PHASE 1 TOTAL/i.test(item.text)));
  const projectFee = totalRow ? amountFromRightOf(totalRow, /PHASE 1 TOTAL/i) : 0;
  const paymentRow = rows.find(row => row.items.some(item => /Initial payment/i.test(item.text)) && row.items.some(item => /Remaining balance/i.test(item.text)));
  const initialPayment = paymentRow ? amountFromRightOf(paymentRow, /Initial payment/i) : 0;
  const remainingBalance = paymentRow ? amountFromRightOf(paymentRow, /Remaining balance/i) : 0;
  if (!clientName || !projectFee || !remainingBalance) {
    throw new Error('This quotation matches the ZIBIXO format, but its client or payment amounts could not be read reliably.');
  }

  const clientEmail = (allText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || '';
  const notes = [
    quotationReference && `Based on quotation ${quotationReference}.`,
    `Phase 1 project fee: ₹${projectFee.toLocaleString('en-IN')}.`,
    initialPayment && `Initial payment: ₹${initialPayment.toLocaleString('en-IN')}.`,
    `Remaining balance invoiced: ₹${remainingBalance.toLocaleString('en-IN')}.`,
    'Netlify subscription is separately billed and excluded from this invoice.'
  ].filter(Boolean).join(' ');

  return {
    clientName,
    clientEmail,
    clientAddress: '',
    projectName,
    currency: 'INR',
    items: [{
      id: Date.now(),
      description: `Remaining balance — ${projectName}`,
      details: quotationReference ? `Quotation ${quotationReference}` : '',
      quantity: 1,
      rate: remainingBalance
    }],
    taxPercent: 0,
    discount: 0,
    notes
  };
}
