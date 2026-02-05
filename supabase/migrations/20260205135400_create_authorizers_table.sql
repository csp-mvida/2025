/*
  # Create authorizers table

  1. New Tables
    - `authorizers`
      - `id` (uuid, primary key)
      - `name` (text)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `authorizers` table
    - Add policy for authenticated users to read active authorizers
*/

CREATE TABLE IF NOT EXISTS authorizers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE authorizers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active authorizers"
  ON authorizers FOR SELECT
  USING (is_active = true);

INSERT INTO authorizers (name, is_active) VALUES
('Maria Silva', true),
('João Santos', true),
('Ana Costa', true),
('Carlos Mendes', true)
ON CONFLICT DO NOTHING;
