interface CompanyDetails {
  email?: string | null;
  companyName?: string | null;
  companyAddress?: string | null;
  companyCity?: string | null;
  companyState?: string | null;
  companyCountry?: string | null;
  companyLogo?: string | null;
  companyTaxId?: string | null;
  companyZip?: string | null;
}

interface YourDetails {
  yourEmail?: string | null;
  yourName?: string | null;
  yourAddress?: string | null;
  yourCity?: string | null;
  yourState?: string | null;
  yourCountry?: string | null;
  yourLogo?: string | null;
  yourTaxId?: string | null;
  yourZip?: string | null;
}

interface InvoiceItemDetails {
  note?: string | null;
  discount?: string | null;
  taxRate?: string | null;
  items: Item[];
  currency?: string;
}

interface Item {
  itemDescription: string;
  qty?: number;
  amount?: number;
}

interface InvoiceTerms {
  invoiceNumber?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
}

interface PaymentDetails {
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  routingCode?: string | null;
  swiftCode?: string | null;
  ifscCode?: string | null;
  paypalEmail?: string | null;
  cryptoAddress?: string | null;
  selectedMethods?: any[];
  upiId?: string | null;
  upiLockAmount?: boolean;
  showUpiQr?: boolean;
  currency?: string;
}

type InvoiceData = PaymentDetails &
  InvoiceTerms &
  InvoiceItemDetails &
  YourDetails &
  CompanyDetails;

interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  businesses: any[];
  created_at: string;
  updated_at: string;
}

interface WorkspaceMember {
  id: string;
  workspace_id: string | Workspace;
  user_id: string | null;
  invited_email: string | null;
  role: 'owner' | 'admin' | 'member';
  status: 'pending' | 'accepted';
}
