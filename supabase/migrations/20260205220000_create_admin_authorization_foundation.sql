-- ETAPA 2B.1: Fundação de Autorização Administrativa

-- 1. Criação da tabela de controle de papéis administrativos
CREATE TABLE public.user_roles (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_roles_role_check CHECK (role = 'admin'),
    CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role)
);

-- 2. Habilitação de RLS na tabela user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Postura deny-by-default para acessos via cliente/navegador
-- Revoga privilégios diretos para anon e authenticated (service_role mantém acesso)
REVOKE ALL ON TABLE public.user_roles FROM PUBLIC, anon, authenticated;

-- 4. Criação da função de validação administrativa segura (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  );
$$;

-- 5. Privilégios da função is_admin()
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;