/*
  # Create departments table

  1. New Tables
    - `departments`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `departments` table
    - Add policy for authenticated users to read active departments
*/

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active departments"
  ON departments FOR SELECT
  USING (is_active = true);

INSERT INTO departments (name, is_active) VALUES
('Financeiro', true),
('Recursos Humanos', true),
('Operações', true),
('Administrativo', true)
ON CONFLICT (name) DO NOTHING;
