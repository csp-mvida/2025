-- Garantindo que o bucket 'uploads' exista e seja público
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS na tabela de objetos (se já não estiver)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Política para permitir que usuários anônimos (anon) insiram arquivos (upload) no bucket 'uploads'
DROP POLICY IF EXISTS "Allow anonymous uploads to uploads bucket" ON storage.objects;
CREATE POLICY "Allow anonymous uploads to uploads bucket"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'uploads');

-- Política para permitir que usuários anônimos (anon) leiam arquivos (necessário para a URL pública) no bucket 'uploads'
DROP POLICY IF EXISTS "Allow public read access to uploads bucket" ON storage.objects;
CREATE POLICY "Allow public read access to uploads bucket"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'uploads');