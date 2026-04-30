// Database Types
export type ProposalStatus = 'draft' | 'sent' | 'signed' | 'void';
export type DocumentKind = 'unsigned_pdf' | 'signed_pdf';
export type SendChannel = 'whatsapp' | 'sms' | 'email';
export type ProjectType = 'influencers' | 'videos' | 'agents';
export const PROJECT_TYPES: ProjectType[] = ['influencers', 'videos', 'agents'];
export const DEFAULT_PROJECT_TYPE: ProjectType = 'influencers';
export function isProjectType(value: unknown): value is ProjectType {
  return typeof value === 'string' && (PROJECT_TYPES as string[]).includes(value);
}

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
  project_type: ProjectType;
  client_token: string | null;
  client_token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalBlock {
  id: string;
  proposal_id: string;
  sort_order: number;
  title: string;
  unit_price: number;
  quantity: number;
  line_total: number;
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
  signature_payload: object | null;
  created_at: string;
  updated_at: string;
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

export interface SendLog {
  id: string;
  proposal_id: string;
  channel: SendChannel;
  destination: string;
  sent_at: string;
  meta: object | null;
}

// API Request/Response Types
export interface CreateCustomerRequest {
  full_name: string;
  doc_number?: string;
  phone: string;
  email: string;
}

export interface CreateProposalRequest {
  customer_id: string;
  proposal_date?: string;
  vat_rate?: number;
  terms_text?: string;
  project_type?: ProjectType;
}

export interface CreateBlockRequest {
  title: string;
  unit_price: number;
  quantity: number;
  text_items?: string[];
}

export interface UpdateBlockRequest {
  title?: string;
  unit_price?: number;
  quantity?: number;
  sort_order?: number;
}

export interface SignProposalRequest {
  signature_payload: object;
  client_data?: Record<string, unknown>;
}

export interface SendProposalRequest {
  channel: SendChannel;
}

// Extended types with relations
export interface ProposalWithDetails extends Proposal {
  customer: Customer;
  blocks: (ProposalBlock & { text_items: BlockTextItem[] })[];
  signature?: Signature;
  documents?: Document[];
}

// Influencer types
export interface Influencer {
  id: string;
  owner_id: string;
  customer_id: string;
  full_name: string;
  phone: string | null;
  instagram_handle: string | null;
  payment_amount: number;
  paid: boolean;
  paid_at: string | null;
  receipt_storage_path: string | null;
  receipt_mime_type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInfluencerRequest {
  full_name: string;
  phone?: string;
  instagram_handle?: string;
  payment_amount?: number;
  notes?: string;
}

export interface UpdateInfluencerRequest {
  full_name?: string;
  phone?: string | null;
  instagram_handle?: string | null;
  payment_amount?: number;
  notes?: string | null;
}

// Auth types
export interface AuthUser {
  id: string;
  email: string;
}

export interface JWTPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}
