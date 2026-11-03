export function calculatePaymentBreakdown(invoice, invoiceTotal) {
  const total = Math.max(0, Number(invoiceTotal) || 0);
  const legacyPaidInvoice = invoice.status === 'Paid' && invoice.amountPaid == null;
  const previouslyPaid = legacyPaidInvoice
    ? total
    : Math.min(total, Math.max(0, Number(invoice.amountPaid) || 0));
  const balanceBeforeCurrentPayment = Math.max(0, total - previouslyPaid);
  const dueNowInput = invoice.dueNow;
  const dueNow = dueNowInput === '' || dueNowInput == null
    ? balanceBeforeCurrentPayment
    : Math.min(balanceBeforeCurrentPayment, Math.max(0, Number(dueNowInput) || 0));

  return {
    previouslyPaid,
    dueNow,
    balanceBeforeCurrentPayment,
    remainingAfterCurrentPayment: Math.max(0, balanceBeforeCurrentPayment - dueNow)
  };
}
