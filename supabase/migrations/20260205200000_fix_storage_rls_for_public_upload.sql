-- Adicionando políticas de RLS para permitir que usuários anônimos façam upload e leiam arquivos no bucket 'comprovantes'.

-- Política para permitir que usuários anônimos (anon) insiram arquivos (upload)
CREATE POLICY "Allow anonymous uploads"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'comprovantes');

-- Política para permitir que usuários anônimos (anon) leiam arquivos (necessário para a URL pública)
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'comprovantes');