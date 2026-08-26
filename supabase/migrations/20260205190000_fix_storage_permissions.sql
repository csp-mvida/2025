-- Garante que o bucket 'comprovantes' existe e é público
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Remove qualquer política existente para evitar conflitos
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
DROP POLICY IF EXISTS "Public Update" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete" ON storage.objects;

-- Permite leitura pública
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'comprovantes');

-- Permite inserção pública (Upload)
CREATE POLICY "Public Upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'comprovantes');

-- Permite atualização pública
CREATE POLICY "Public Update" ON storage.objects
FOR UPDATE USING (bucket_id = 'comprovantes');