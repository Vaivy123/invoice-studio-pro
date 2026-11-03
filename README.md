# Invoice Studio Pro — Freelance Software Invoicing

React + Vite application designed for freelance software developers and project work.

## Features
- Dashboard with invoice totals, outstanding amount, and recent invoices
- Invoice list, search, status filters, client list
- Invoice editor with project, client, issue/due dates, currency, work line items, quantities/hours, rates, discount, tax/GST, notes, prior payments, amount being collected now, and the remaining balance
- Import text-based quotation PDFs to create editable draft invoices from detected client and line-item details, including the ZIBIXO Phase 1 quotation format
- Multiple currencies: INR, CAD, USD, EUR, GBP, AUD
- UPI QR payment request generated for the amount due now
- Bank transfer instructions: account holder, bank, account number, IFSC
- Business profile settings
- Duplicate invoices and track statuses: Draft, Sent, Paid, Overdue
- Open a prefilled invoice email in the user's email app
- Download polished invoice PDFs with itemized work, totals and payment instructions
- Browser local storage, no server required

## Run in VS Code
1. Install Node.js LTS.
2. Extract this ZIP and open `invoice-studio-pro` in VS Code.
3. Terminal > New Terminal.
4. Run `npm install`
5. Run `npm run dev`
6. Open the local URL Vite prints (usually http://localhost:5173).

## Important limitations
- Data is stored only in localStorage on this browser. It does not sync across devices, and clearing browser data can remove it. Export/backup and authentication are not implemented.
- Email invoice opens a prefilled message in the user's configured email app. Download the invoice PDF and attach it manually; this static browser app does not send emails or attach files automatically.
- Quotation PDF import runs in the browser. The ZIBIXO Phase 1 template creates an invoice for the remaining balance and keeps its recurring Netlify subscription separate; other PDFs need recognizable item, quantity, rate and amount columns. Scanned/image-only PDFs and unusual quotation layouts are not OCR-parsed. Review every imported field and amount before sending the invoice.
- Totals are shown in the invoice's selected currency. Dashboard totals are not exchange-rate-converted and currently aggregate displayed numeric amounts; do not interpret mixed-currency totals as a converted accounting balance.
- UPI QR uses the selected invoice currency and total. UPI rails commonly expect INR; use the QR only for supported currencies/transactions and verify it with your UPI app. For CAD/USD/EUR etc., prefer bank transfer or an appropriate payment provider unless your UPI provider confirms support.
- QR generation does not process or confirm payment. Verify funds in your bank/UPI app before marking an invoice Paid.
- Tax is a manual percentage; verify applicable tax, GST, cross-border invoicing and legal requirements with a qualified professional.
- Never enter a UPI PIN, OTP, card PIN, or banking password.
