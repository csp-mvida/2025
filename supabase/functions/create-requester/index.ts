import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log("[create-requester] Request recebido:", req.method);

  // 1. CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 2. Diagnóstico de Ambiente
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  console.log("[create-requester] Diagnóstico de Variáveis:");
  console.log("- SUPABASE_URL:", url ? "Configurada (OK)" : "AUSENTE (ERRO)");
  console.log("- SERVICE_ROLE:", serviceRole ? "Configurada (OK)" : "AUSENTE (ERRO)");

  if (!url || !serviceRole) {
    return new Response(
      JSON.stringify({ error: 'Configuração do servidor incompleta (Variáveis de ambiente ausentes).' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }

  try {
    const supabaseAdmin = createClient(url, serviceRole);
    
    // 3. Validação de Payload
    const body = await req.json();
    console.log("[create-requester] Payload Bruto:", JSON.stringify(body));

    const { full_name, email } = body;

    if (!full_name || !email) {
      console.error("[create-requester] Validação falhou: campos ausentes.");
      return new Response(
        JSON.stringify({ error: 'Os campos full_name e email são obrigatórios.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 4. Criação no Auth Admin
    console.log(`[create-requester] Tentando criar usuário: ${email}`);
    
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      user_metadata: { full_name },
      email_confirm: true
    });

    if (userError) {
      console.error("[create-requester] Erro no auth.admin.createUser:", userError);
      
      // Tradução de erros comuns do Supabase Auth
      let friendlyMessage = userError.message;
      if (userError.message.includes("already registered")) {
        friendlyMessage = "Este e-mail já está em uso por outro requisitante.";
      }

      return new Response(
        JSON.stringify({ error: friendlyMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log("[create-requester] Sucesso! Usuário criado:", userData.user?.id);

    return new Response(
      JSON.stringify({ success: true, message: 'Requisitante cadastrado com sucesso!', user: userData.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
    )

  } catch (err) {
    console.error("[create-requester] Catch Global:", err);
    return new Response(
      JSON.stringify({ error: `Erro interno: ${err.message || 'Falha desconhecida no servidor'}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})