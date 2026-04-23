-- =========================
-- Proposal Signature System - Cloud SQL Schema
-- Compatible with Google Cloud SQL PostgreSQL
-- =========================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- Sequences
-- =========================
CREATE SEQUENCE IF NOT EXISTS row_number_seq
  START WITH 10
  INCREMENT BY 10
  MINVALUE 10;

CREATE SEQUENCE IF NOT EXISTS order_number_seq
  START WITH 1000
  INCREMENT BY 1
  MINVALUE 1;

-- =========================
-- Users (replaces Supabase Auth)
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =========================
-- Refresh Tokens (for JWT refresh)
-- =========================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- =========================
-- Helpers: updated_at trigger
-- =========================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- Customers
-- =========================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  doc_number TEXT,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(owner_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

CREATE TRIGGER trg_customers_updated
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- Proposals
-- =========================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'proposal_status') THEN
    CREATE TYPE proposal_status AS ENUM ('draft','sent','signed','void');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  proposal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  row_number BIGINT NOT NULL DEFAULT nextval('row_number_seq'),
  order_number BIGINT NOT NULL DEFAULT nextval('order_number_seq'),
  currency TEXT NOT NULL DEFAULT 'ILS',
  vat_rate NUMERIC(6,4) NOT NULL DEFAULT 0.1700,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  terms_text TEXT,
  status proposal_status NOT NULL DEFAULT 'draft',
  client_token TEXT UNIQUE,
  client_token_expires_at TIMESTAMPTZ,
  contract_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_proposals_owner_row UNIQUE (owner_id, row_number),
  CONSTRAINT uq_proposals_owner_order UNIQUE (owner_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_proposals_owner ON proposals(owner_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_customer ON proposals(customer_id);
CREATE INDEX IF NOT EXISTS idx_proposals_client_token ON proposals(client_token);

CREATE TRIGGER trg_proposals_updated
BEFORE UPDATE ON proposals
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- Proposal Blocks
-- =========================
CREATE TABLE IF NOT EXISTS proposal_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocks_proposal ON proposal_blocks(proposal_id);
CREATE INDEX IF NOT EXISTS idx_blocks_sort ON proposal_blocks(proposal_id, sort_order);

CREATE TRIGGER trg_blocks_updated
BEFORE UPDATE ON proposal_blocks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- Block Text Items
-- =========================
CREATE TABLE IF NOT EXISTS block_text_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES proposal_blocks(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_block_text_block ON block_text_items(block_id);
CREATE INDEX IF NOT EXISTS idx_block_text_sort ON block_text_items(block_id, sort_order);

CREATE TRIGGER trg_block_text_updated
BEFORE UPDATE ON block_text_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- Signatures
-- =========================
CREATE TABLE IF NOT EXISTS signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL UNIQUE REFERENCES proposals(id) ON DELETE CASCADE,
  signed_at TIMESTAMPTZ,
  signer_ip INET,
  signer_user_agent TEXT,
  signature_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_signatures_updated
BEFORE UPDATE ON signatures
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- Documents (PDF urls - now using Cloud Storage)
-- =========================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_kind') THEN
    CREATE TYPE document_kind AS ENUM ('unsigned_pdf','signed_pdf');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  kind document_kind NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'proposal-pdfs',
  storage_path TEXT NOT NULL,
  public_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_documents_proposal_kind UNIQUE (proposal_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_docs_proposal ON documents(proposal_id);

CREATE TRIGGER trg_documents_updated
BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- Send Logs
-- =========================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'send_channel') THEN
    CREATE TYPE send_channel AS ENUM ('whatsapp','sms','email');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  channel send_channel NOT NULL,
  destination TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_sendlogs_proposal ON send_logs(proposal_id);

-- =========================
-- Helper Function
-- =========================
CREATE OR REPLACE FUNCTION recalc_proposal_totals(p_proposal_id UUID)
RETURNS VOID AS $$
DECLARE
  v_subtotal NUMERIC(12,2);
  v_vat_rate NUMERIC(6,4);
BEGIN
  SELECT COALESCE(SUM(line_total),0)
    INTO v_subtotal
  FROM proposal_blocks
  WHERE proposal_id = p_proposal_id;

  SELECT vat_rate INTO v_vat_rate FROM proposals WHERE id = p_proposal_id;

  UPDATE proposals
  SET subtotal = v_subtotal,
      vat_amount = ROUND(v_subtotal * v_vat_rate, 2),
      total = ROUND(v_subtotal + (v_subtotal * v_vat_rate), 2)
  WHERE id = p_proposal_id;
END;
$$ LANGUAGE plpgsql;

-- =========================
-- Initial Admin User (password: Admin123!)
-- =========================
INSERT INTO users (email, password_hash, full_name)
VALUES (
  'admin@demo.com',
  crypt('Admin123!', gen_salt('bf')),
  'מנהל המערכת'
) ON CONFLICT (email) DO NOTHING;
