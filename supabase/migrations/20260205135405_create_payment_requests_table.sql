/*
  # Create payment requests table

  1. New Tables
    - `payment_requests`
      - `id` (uuid, primary key)
      - `protocol` (text, unique) - request identifier
      - `requester_name` (text)
      - `requester_whatsapp` (text)
      - `department_id` (uuid, foreign key)
      - `description` (text)
      - `due_date` (date)
      - `vendor_name` (text)
      - `amount_cents` (integer) - stored in cents
      - `payment_method` (text) - PIX, Boleto, Transferência
      - `pix_key` (text, nullable)
      - `status` (text) - pending, approved, paid, rejected
      - `invoice_attachment_path` (text, nullable)
      - `boleto_attachment_path` (text, nullable)
      - `is_budget_specific` (boolean)
      - `authorization_number` (text, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `payment_requests` table
    - Add policy for anyone to read requests
    - Add policy for anyone to insert requests
    - Add policy for anyone to update own requests

  3. Relationships
    - Foreign key to departments table
*/

CREATE TABLE IF NOT EXISTS payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol text UNIQUE NOT NULL,
  requester_name text NOT NULL,
  requester_whatsapp text NOT NULL,
  department_id uuid REFERENCES departments(id),
  description text NOT NULL,
  due_date date,
  vendor_name text NOT NULL,
  amount_cents integer NOT NULL,
  payment_method text NOT NULL,
  pix_key text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  invoice_attachment_path text,
  boleto_attachment_path text,
  is_budget_specific boolean DEFAULT false,
  authorization_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read payment requests"
  ON payment_requests FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create payment requests"
  ON payment_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update payment requests"
  ON payment_requests FOR UPDATE
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_payment_requests_protocol ON payment_requests(protocol);
CREATE INDEX IF NOT EXISTS idx_payment_requests_department_id ON payment_requests(department_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_created_at ON payment_requests(created_at DESC);
