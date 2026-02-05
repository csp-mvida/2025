-- Garantindo que o bucket 'comprovantes' exista e seja público
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', true)
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS na tabela de objetos (se já não estiver)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Política para permitir que usuários anônimos (anon) insiram arquivos (upload)
DROP POLICY IF EXISTS "Allow anonymous uploads" ON storage.objects;
CREATE POLICY "Allow anonymous uploads"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'comprovantes');

-- Política para permitir que usuários anônimos (anon) leiam arquivos (necessário para a URL pública)
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'comprovantes');