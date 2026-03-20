import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Log de depuração (Visível nos logs do Supabase)
  console.log('[create-requester] Iniciando função...');
  console.log('[create-requester] SUPABASE_URL presente:', !!supabaseUrl);
  console.log('[create-requester] SERVICE_ROLE presente:', !!supabaseServiceRole);

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);
    
    const body = await req.json();
    console.log('[create-requester] Payload recebido:', body);

    const { full_name, email } = body;

    // 1. Validação de campos obrigatórios
    if (!email || !full_name) {
      return new Response(
        JSON.stringify({ error: 'E-mail e nome completo são obrigatórios.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 2. Verificar se o e-mail já é válido (formato básico)
    if (!email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'O formato do e-mail é inválido.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 3. Tentar criar o usuário no Auth
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      user_metadata: { full_name },
      email_confirm: true // O admin já está confirmando a validade desse usuário
    });

    if (userError) {
      console.error('[create-requester] Erro do Auth:', userError);
      
      // Tradução de erro comum: E-mail já existe
      let message = userError.message;
      if (message.includes('already registered')) {
        message = 'Este e-mail já está cadastrado no sistema.';
      }

      return new Response(
        JSON.stringify({ error: message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('[create-requester] Usuário criado com sucesso ID:', userData.user?.id);

    return new Response(
      JSON.stringify({ 
        message: 'Requisitante cadastrado com sucesso.', 
        user: userData.user 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
    )

  } catch (error) {
    console.error('[create-requester] Exceção inesperada:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar o cadastro.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})