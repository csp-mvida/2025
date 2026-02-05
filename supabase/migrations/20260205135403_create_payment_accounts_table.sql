/*
  # Create payment accounts table

  1. New Tables
    - `payment_accounts`
      - `id` (uuid, primary key)
      - `label` (text)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `payment_accounts` table
    - Add policy for authenticated users to read active accounts
*/

CREATE TABLE IF NOT EXISTS payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active payment accounts"
  ON payment_accounts FOR SELECT
  USING (is_active = true);

INSERT INTO payment_accounts (label, is_active) VALUES
('Conta Corrente Principal', true),
('Conta Poupança', true),
('Conta Operacional', true)
ON CONFLICT DO NOTHING;
