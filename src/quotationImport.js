import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseZibixoQuotation } from './quotationParser.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const currencyCodes = [
  ['CA$', 'CAD'], ['CAD', 'CAD'], ['A$', 'AUD'], ['AUD', 'AUD'],
  ['₹', 'INR'], ['INR', 'INR'], ['USD', 'USD'], ['$', 'USD'],
  ['EUR', 'EUR'], ['€', 'EUR'], ['GBP', 'GBP'], ['£', 'GBP']
];

function getCurrency(text) {
  const found = currencyCodes.find(([marker]) => text.includes(marker));
  return found?.[1] || 'INR';
}

function getLabeledValue(lines, labels) {
  const labelPattern = labels.join('|');
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(new RegExp(`^(?:${labelPattern})\\s*[:#-]?\\s*(.*)$`, 'i'));
    if (match?.[1]?.trim()) return match[1].trim();
    if (match && lines[index + 1]) return lines[index + 1].trim();
  }
  return '';
}

function parseItems(lines) {
  const headerIndex = lines.findIndex(line => /\b(description|item|service|particulars)\b/i.test(line) && /\b(qty|quantity|rate|amount|price)\b/i.test(line));
  if (headerIndex < 0) return [];

  const items = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (/^(?:sub\s*total|subtotal|tax|gst|vat|discount|grand\s*total|total\s*(?:due|amount)?|amount\s*due)\b/i.test(line)) break;
    const amounts = [...line.matchAll(/(?:₹|INR|USD|CAD|EUR|GBP|AUD|\$|€|£)?\s*(-?\d[\d,]*(?:\.\d{1,2})?)/gi)];
    if (amounts.length < 3) continue;

    const values = amounts.slice(-3).map(match => Number(match[1].replace(/,/g, '')));
    const [quantity, rate, amount] = values;
    const description = line.slice(0, amounts[0].index).replace(/[|·•\-–\s]+$/g, '').trim();
    if (!description || quantity <= 0 || rate < 0 || amount < 0) continue;
    if (Math.abs(quantity * rate - amount) > Math.max(1, amount * 0.02)) continue;
    items.push({ id: Date.now() + items.length, description, details: '', quantity, rate });
  }
  return items;
}

export async function readQuotationPdf(file) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Choose a PDF quotation file.');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('The PDF must be smaller than 15 MB.');
  }

  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const rows = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const y = item.transform[5];
      let line = rows.find(candidate => candidate.page === pageNumber && Math.abs(candidate.y - y) < 4);
      if (!line) {
        line = { page: pageNumber, y, items: [] };
        rows.push(line);
      }
      line.items.push({ x: item.transform[4], text: item.str });
    }
  }

  rows.sort((a, b) => a.page - b.page || b.y - a.y);
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  const lines = rows.map(row => row.items.map(item => item.text).join(' ').replace(/\s+/g, ' ').trim());
  const text = lines.join('\n');
  if (!text.trim()) {
    throw new Error('No selectable text found. This may be a scanned PDF; scanned quotations need OCR.');
  }

  const zibixoInvoice = parseZibixoQuotation(rows);
  if (zibixoInvoice) return zibixoInvoice;

  const items = parseItems(lines);
  if (!items.length) {
    throw new Error('Could not identify quotation line items. Use a text-based PDF with item descriptions, quantity, rate and amount columns.');
  }

  return {
    clientName: getLabeledValue(lines, ['client(?:\\s*name)?', 'customer(?:\\s*name)?', 'prepared\\s*for', 'bill\\s*to']),
    clientEmail: (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || '',
    clientAddress: getLabeledValue(lines, ['billing\\s*address', 'client\\s*address', 'customer\\s*address']),
    projectName: getLabeledValue(lines, ['project(?:\\s*name)?', 'subject', 'quotation\\s*for', 'service']),
    currency: getCurrency(text),
    items,
    taxPercent: Number((text.match(/(?:GST|VAT|tax)\s*(?:rate)?\s*[:@]?\s*(\d+(?:\.\d+)?)\s*%/i) || [])[1] || 0)
  };
}
