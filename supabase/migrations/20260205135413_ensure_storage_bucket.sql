-- Garantir que o bucket 'comprovantes' exista
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', true)
ON CONFLICT (id) DO NOTHING;

-- Definir política para permitir que qualquer pessoa visualize os arquivos (Público)
CREATE POLICY "Acesso Público para Visualização"
ON storage.objects FOR SELECT
USING ( bucket_id = 'comprovantes' );

-- Definir política para permitir uploads (por usuários autenticados ou anônimos, dependendo do seu fluxo)
-- Para este sistema, permitiremos inserção anônima para facilitar o uso sem login obrigatório do solicitante
CREATE POLICY "Permitir Uploads"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'comprovantes' );

-- Permitir exclusão/atualização se necessário (opcional, mas bom para manutenção)
CREATE POLICY "Permitir Atualização e Exclusão"
ON storage.objects FOR ALL
USING ( bucket_id = 'comprovantes' );