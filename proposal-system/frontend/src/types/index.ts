// Database Types
export type ProposalStatus = 'draft' | 'sent' | 'signed' | 'void';
export type DocumentKind = 'unsigned_pdf' | 'signed_pdf';
export type SendChannel = 'whatsapp' | 'sms' | 'email';

export interface Customer {
  id: string;
  owner_id: string;
  full_name: string;
  doc_number: string | null;
  phone: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface ContractData {
  customerName: string;
  date: string;
  forText: string;
  platforms: string[];
  whatYouGet: string;
  cost: number;
}

export interface Proposal {
  id: string;
  owner_id: string;
  customer_id: string;
  proposal_date: string;
  row_number: number;
  order_number: number;
  currency: string;
  vat_rate: number;
  subtotal: number;
  vat_amount: number;
  total: number;
  terms_text: string | null;
  status: ProposalStatus;
  client_token: string | null;
  client_token_expires_at: string | null;
  contract_data: ContractData | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
}

export interface ProposalBlock {
  id: string;
  proposal_id: string;
  sort_order: number;
  title: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  text_items?: BlockTextItem[];
  created_at: string;
  updated_at: string;
}

export interface BlockTextItem {
  id: string;
  block_id: string;
  sort_order: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Signature {
  id: string;
  proposal_id: string;
  signed_at: string | null;
  signer_ip: string | null;
  signer_user_agent: string | null;
  signature_payload: SignaturePayload | null;
  created_at: string;
  updated_at: string;
}

export interface SignaturePayload {
  dataUrl: string;
  timestamp: string;
}

export interface Document {
  id: string;
  proposal_id: string;
  kind: DocumentKind;
  storage_bucket: string;
  storage_path: string;
  public_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalWithDetails extends Proposal {
  customer: Customer;
  blocks: ProposalBlock[];
  signature?: Signature;
  documents?: Document[];
}

// Auth types
export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

// API Response types
export interface ApiError {
  error: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
}

// Form types
export interface CustomerFormData {
  full_name: string;
  doc_number: string;
  phone: string;
  email: string;
}

export interface BlockFormData {
  title: string;
  unit_price: number;
  quantity: number;
  text_items: string[];
}

// Campaign types (customer campaigns/projects)
export interface Campaign {
  id: string;
  customer_id: string;
  campaign_name: string;
  influencers: string;
  invoice_url: string | null;
  invoice_type: 'image' | 'pdf' | null;
  bank_details: string;
  cost: number;
  is_paid: boolean;
  created_at: string;
  updated_at: string;
}

export interface CampaignFormData {
  campaign_name: string;
  influencers: string;
  invoice_file?: File | null;
  bank_details: string;
  cost: number;
  is_paid: boolean;
}

export interface CustomerWithCampaigns extends Customer {
  campaigns?: Campaign[];
}
