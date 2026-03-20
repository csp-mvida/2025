import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log("[create-requester] --- NOVA EXECUÇÃO ---");

  // 1. Tratamento de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Diagnóstico de Ambiente
    const url = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log("[create-requester] Checando variáveis de ambiente:");
    console.log("- SUPABASE_URL:", url ? "OK" : "MISSING");
    console.log("- SUPABASE_SERVICE_ROLE_KEY:", serviceRole ? "OK" : "MISSING");

    if (!url || !serviceRole) {
      console.error("[create-requester] Variáveis de ambiente não encontradas.");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Configuração do servidor incompleta. Verifique se as variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão configuradas no painel do Supabase." 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // 3. Parsing do Payload
    const body = await req.json();
    console.log("[create-requester] Payload recebido:", JSON.stringify(body));

    const { full_name, email } = body;

    if (!full_name || !email) {
      console.error("[create-requester] Campos ausentes:", { full_name, email });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Nome completo e e-mail são obrigatórios para o cadastro." 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 4. Inicialização do Cliente Admin e Criação
    console.log("[create-requester] Inicializando cliente admin...");
    const supabaseAdmin = createClient(url, serviceRole);

    console.log(`[create-requester] Chamando auth.admin.createUser para: ${email}`);
    const { data, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      user_metadata: { full_name },
      email_confirm: true
    });

    if (userError) {
      console.error("[create-requester] Erro retornado pelo auth.admin:", userError);
      
      let message = userError.message;
      if (message.includes("already registered")) {
        message = "Este e-mail já possui um acesso cadastrado.";
      }

      return new Response(
        JSON.stringify({ success: false, error: message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 5. Sucesso
    console.log("[create-requester] Usuário criado com sucesso ID:", data.user?.id);
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Requisitante cadastrado com sucesso!", 
        user_id: data.user?.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
    );

  } catch (err: any) {
    console.error("[create-requester] CATCH GLOBAL:", err.message);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Erro inesperado na execução da função: ${err.message}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})