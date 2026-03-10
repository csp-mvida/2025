import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

/**
 * Onde configurar:
 * - Vercel: Project Settings -> Environment Variables
 * - Dyad: Env vars do projeto (se houver)
 *
 * Crie:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Env vars ausentes: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no projeto (Dyad/Vercel)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * =========================================================
 * FUNÇÕES NOVAS DO CSP (seguras com RLS + RPC)
 * =========================================================
 */

/**
 * Cria uma solicitação (público). Retorna o id_protocolo (integer).
 * OBS: nomes dos parâmetros devem bater com os da função SQL.
 */
export async function cspCreateSolicitacao(params: {
  solicitante_nome: string;
  whatsapp_contato: string;
  id_nucleo: number;
  id_autorizador: number;
  data_vencimento: string; // ISO string ou formato aceito pelo Postgres
  conta_pagamento: string;
  verba_especifica: boolean;
  fornecedor_recebedor: string;
  valor_total: number;
  forma_pagamento: string;
  possui_nf: boolean;
}): Promise<number> {
  const { data, error } = await supabase.rpc("csp_create_solicitacao", {
    p_solicitante_nome: params.solicitante_nome,
    p_whatsapp_contato: params.whatsapp_contato,
    p_id_nucleo: params.id_nucleo,
    p_id_autorizador: params.id_autorizador,
    p_data_vencimento: params.data_vencimento,
    p_conta_pagamento: params.conta_pagamento,
    p_verba_especifica: params.verba_especifica,
    p_fornecedor_recebedor: params.fornecedor_recebedor,
    p_valor_total: params.valor_total,
    p_forma_pagamento: params.forma_pagamento,
    p_possui_nf: params.possui_nf,
  });

  if (error) throw new Error(error.message);

  // data é o integer retornado pela função
  return data as number;
}

/**
 * Consulta uma solicitação por protocolo + whatsapp (público).
 * Retorna lista (normalmente 0 ou 1 registro).
 */
export async function cspGetSolicitacao(params: {
  id_protocolo: number;
  whatsapp_contato: string;
}) {
  const { data, error } = await supabase.rpc("csp_get_solicitacao", {
    p_id_protocolo: params.id_protocolo,
    p_whatsapp: params.whatsapp_contato,
  });

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Seta o comprovante (url_anexo) via RPC (público), validando protocolo + whatsapp.
 */
export async function cspSetComprovante(params: {
  id_protocolo: number;
  whatsapp_contato: string;
  url_anexo: string;
}) {
  const { error } = await supabase.rpc("csp_set_comprovante", {
    p_id_protocolo: params.id_protocolo,
    p_whatsapp: params.whatsapp_contato,
    p_url_anexo: params.url_anexo,
  });

  if (error) throw new Error(error.message);
}

/**
 * Upload de comprovante para Storage + grava o caminho em url_anexo via RPC.
 *
 * Recomendação:
 * - bucket privado, ex: "uploads" (o seu já usa esse nome)
 * - path padronizado: comprovantes/{id_protocolo}/{uuid}-{filename}
 */
export async function cspUploadComprovante(params: {
  id_protocolo: number;
  whatsapp_contato: string;
  file: File;
  bucket?: string; // default: uploads
}): Promise<{ path: string }> {
  const bucket = params.bucket ?? "uploads";
  const safeName = params.file.name.replace(/[^\w.\-]+/g, "_");
  const path = `comprovantes/${params.id_protocolo}/${uuidv4()}-${safeName}`;

  const { data, error } = await supabase.storage.from(bucket).upload(path, params.file, {
    upsert: false,
  });

  if (error) throw new Error(error.message);

  // grava o path (não URL pública) na coluna url_anexo
  await cspSetComprovante({
    id_protocolo: params.id_protocolo,
    whatsapp_contato: params.whatsapp_contato,
    url_anexo: data.path,
  });

  return { path: data.path };
}

/**
 * Gera URL assinada para visualizar/baixar arquivo de bucket privado.
 */
export async function cspCreateSignedUrl(params: {
  path: string;
  bucket?: string; // default: uploads
  expiresIn?: number; // default: 60s
}): Promise<string> {
  const bucket = params.bucket ?? "uploads";
  const expiresIn = params.expiresIn ?? 60;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(params.path, expiresIn);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/**
 * =========================================================
 * FUNÇÃO EXISTENTE (mantida), mas com melhorias de segurança
 * =========================================================
 *
 * OBS: Esta função ainda usa:
 * - bucket: uploads
 * - tabela: payment_requests
 *
 * Se isso for de outro módulo do seu sistema e estiver em uso, mantive.
 * Se no CSP você não usa "payment_requests", podemos remover depois.
 */
export const uploadFilesToSupabase = async ({
  invoiceFiles,
  boletoFiles,
  transferFiles,
  draftId,
}: {
  invoiceFiles: File[];
  boletoFiles: File[];
  transferFiles: File[];
  draftId: string | number;
}) => {
  const invoicePaths: string[] = [];
  const boletoPaths: string[] = [];
  const transferPaths: string[] = [];

  const uploadFile = async (file: File, folder: string) => {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${folder}/${uuidv4()}-${safeName}`;

    const { data, error } = await supabase.storage.from("uploads").upload(path, file, {
      upsert: false,
    });

    if (error) throw new Error(error.message);
    return data.path;
  };

  for (const file of invoiceFiles) {
    invoicePaths.push(await uploadFile(file, "notas_fiscais"));
  }

  for (const file of boletoFiles) {
    boletoPaths.push(await uploadFile(file, "boletos"));
  }

  for (const file of transferFiles) {
    transferPaths.push(await uploadFile(file, "transferencias"));
  }

  const { error } = await supabase
    .from("payment_requests")
    .update({
      invoice_attachment_path: JSON.stringify(invoicePaths),
      boleto_attachment_path: JSON.stringify(boletoPaths),
      transfer_attachment_path: JSON.stringify(transferPaths),
    })
    .eq("id", draftId);

  if (error) throw new Error(error.message);

  return { invoicePaths, boletoPaths, transferPaths };
};