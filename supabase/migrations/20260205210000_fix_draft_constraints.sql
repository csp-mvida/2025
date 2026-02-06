-- 20260205210000_fix_draft_constraints.sql

-- 1. Remover constraints de checagem existentes (se existirem)
-- Tentativa de remover a constraint de valor
ALTER TABLE public.payment_requests
DROP CONSTRAINT IF EXISTS payment_requests_amount_cents_check;

-- Tentativa de remover a constraint de método de pagamento
ALTER TABLE public.payment_requests
DROP CONSTRAINT IF EXISTS payment_requests_payment_method_check;

-- 2. Recriar a constraint de amount_cents para permitir 0 ou NULL quando for DRAFT
ALTER TABLE public.payment_requests
ADD CONSTRAINT payment_requests_amount_cents_check
CHECK (
    (status = 'draft') OR (amount_cents > 0)
);

-- 3. Recriar a constraint de payment_method para permitir qualquer valor (ou NULL) quando for DRAFT
ALTER TABLE public.payment_requests
ADD CONSTRAINT payment_requests_payment_method_check
CHECK (
    (status = 'draft') OR (payment_method IN ('PIX', 'Boleto', 'Transferência'))
);

-- 4. Garantir que amount_cents e payment_method possam ser NULL no nível do esquema
-- O esquema atual já indica que column_default é null, mas is_nullable é NO.
-- Para evitar problemas, vamos garantir que o payload de DRAFT não os envie.