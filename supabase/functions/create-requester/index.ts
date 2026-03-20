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

  try {
    // Inicializa o cliente com a Service Role para ignorar RLS e criar usuários
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { full_name, email } = await req.json()

    if (!email || !full_name) {
      return new Response(
        JSON.stringify({ error: 'E-mail e nome completo são obrigatórios.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Tenta criar o usuário no Auth do Supabase
    // O email_confirm: true é usado para que o admin defina o acesso
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      user_metadata: { full_name },
      email_confirm: true
    })

    if (userError) {
      console.error('[create-requester] Auth Error:', userError)
      return new Response(
        JSON.stringify({ error: userError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    return new Response(
      JSON.stringify({ 
        message: 'Requisitante criado com sucesso.', 
        user: userData.user 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
    )

  } catch (error) {
    console.error('[create-requester] Unexpected Error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar o cadastro.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})