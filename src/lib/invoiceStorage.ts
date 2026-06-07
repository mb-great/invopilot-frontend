/**
 * Invoice-specific localStorage keys used by the form builder.
 * These (and only these) are cleared when starting a new invoice.
 */
export const INVOICE_STORAGE_KEYS = [
  // Your details
  'yourEmail', 'yourName', 'yourAddress', 'yourCity', 'yourState',
  'yourCountry', 'yourLogo', 'yourTaxId', 'yourZip',
  // Client/company details
  'email', 'companyName', 'companyAddress', 'companyCity', 'companyState',
  'companyCountry', 'companyLogo', 'companyTaxId', 'companyZip',
  // Invoice details
  'note', 'discount', 'tax', 'items', 'currency',
  // Payment details
  'bankName', 'accountNumber', 'accountName', 'routingCode',
  'swiftCode', 'ifscCode', 'upiId', 'upiLockAmount', 'showUpiQr',
  // Invoice terms
  'invoiceNo', 'issueDate', 'dueDate',
  // Builder state
  'step',
] as const;

/**
 * Clear only invoice-related keys from localStorage.
 * Preserves auth tokens, theme prefs, and other app state.
 */
export function clearInvoiceDraft(): void {
  if (typeof window === 'undefined') return;
  for (const key of INVOICE_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}
