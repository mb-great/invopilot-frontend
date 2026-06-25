/**
 * Invoice draft storage using a single localStorage object.
 * All invoice form data is stored as one JSON blob under 'invoice_draft'.
 * This replaces the old per-key approach that lost fields on refresh.
 */

const DRAFT_KEY = 'invoice_draft';

/**
 * Save the entire draft as a single JSON object.
 */
export function saveInvoiceDraft(data: Record<string, any>): void {
  if (typeof window === 'undefined') return;
  try {
    // Filter out undefined/null values and functions
    const clean: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined && val !== null && typeof val !== 'function') {
        clean[key] = val;
      }
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(clean));
  } catch (e) {
    console.error('Failed to save invoice draft:', e);
  }
}

/**
 * Load the entire draft from localStorage.
 */
export function loadInvoiceDraft(): Record<string, any> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Clear the invoice draft from localStorage.
 */
export function clearInvoiceDraft(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DRAFT_KEY);
  // Also clear legacy per-key data if it exists
  for (const key of LEGACY_KEYS) {
    localStorage.removeItem(key);
  }
}

/**
 * Check if a draft exists.
 */
export function hasInvoiceDraft(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(DRAFT_KEY);
}

// Legacy keys to clean up
const LEGACY_KEYS = [
  'yourEmail', 'yourName', 'yourAddress', 'yourCity', 'yourState',
  'yourCountry', 'yourLogo', 'yourTaxId', 'yourZip',
  'email', 'companyName', 'companyAddress', 'companyCity', 'companyState',
  'companyCountry', 'companyLogo', 'companyTaxId', 'companyZip',
  'note', 'discount', 'tax', 'items', 'currency',
  'bankName', 'accountNumber', 'accountName', 'routingCode',
  'swiftCode', 'ifscCode', 'upiId', 'upiLockAmount', 'showUpiQr',
  'invoiceNo', 'issueDate', 'dueDate', 'nickname',
  'step', 'edit_invoice_id',
  'selectedMethods', 'signatureMode', 'signatureUrl', 'customSignatureUrl', 'businessId',
];
