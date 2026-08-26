import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log("[create-requester] Iniciando execução da função...");

  // 1. Tratamento de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Diagnóstico de Ambiente
    const url = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log("[create-requester] Verificação de Variáveis de Ambiente:");
    console.log("- SUPABASE_URL:", url ? "Presente" : "AUSENTE");
    console.log("- SUPABASE_SERVICE_ROLE_KEY:", serviceRole ? "Presente" : "AUSENTE");

    if (!url || !serviceRole) {
      console.error("[create-requester] Erro: Variáveis de ambiente não configuradas no Supabase.");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Configuração do servidor incompleta: Variáveis de ambiente (SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY) não encontradas." 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // 3. Recebimento e Log do Payload
    const body = await req.json();
    console.log("[create-requester] Payload recebido:", JSON.stringify(body));

    const { full_name, email } = body;

    if (!full_name || !email) {
      console.warn("[create-requester] Payload inválido: campos obrigatórios ausentes.");
      return new Response(
        JSON.stringify({ success: false, error: "Nome completo e e-mail são obrigatórios." }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 4. Inicialização do Cliente Admin e Chamada ao Auth
    const supabaseAdmin = createClient(url, serviceRole);

    console.log(`[create-requester] Tentando criar usuário via Auth Admin: ${email}`);
    
    const { data, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      user_metadata: { full_name },
      email_confirm: true
    });

    if (userError) {
      console.error("[create-requester] Erro retornado pelo Auth Admin:", userError);
      
      let msg = userError.message;
      if (msg.includes("already registered")) msg = "Este e-mail já possui um acesso cadastrado.";

      return new Response(
        JSON.stringify({ success: false, error: msg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 5. Retorno de Sucesso
    console.log("[create-requester] Usuário criado com sucesso. ID:", data.user?.id);
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Requisitante cadastrado com sucesso!", 
        user_id: data.user?.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
    );

  } catch (err: any) {
    console.error("[create-requester] Erro crítico (Catch Global):", err.message);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Erro inesperado na execução da função: ${err.message}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})