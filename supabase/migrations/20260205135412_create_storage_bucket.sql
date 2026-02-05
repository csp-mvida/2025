/*
  # Create comprovantes storage bucket

  1. Storage Bucket
    - `comprovantes` bucket for invoice and boleto attachments
    - Public read access for uploaded files

  2. Security
    - Public read access via policies
    - Anyone can upload files
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access on comprovantes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'comprovantes');

CREATE POLICY "Anyone can upload to comprovantes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'comprovantes');
