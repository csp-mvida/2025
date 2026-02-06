import { supabase } from '../src/integrations/supabase/client';
import { Department, CSPFormData, CSPRequest, RequestStatus, AttachmentMeta } from '../types';

const STORAGE_BUCKET = 'uploads'; // Nome do bucket centralizado
const TABLE_NAME = 'payment_requests';
const PLACEHOLDER_UUID = '00000000-0000-0000-0000-000000000000';

// Fetch Departments from Supabase
export const fetchDepartments = async (): Promise<Department[]> => {
  const { data, error } = await supabase
    .from('departments')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error fetching departments:', error);
    return [];
  }

  return data.map(d => ({
    id: d.id,
    name: d.name,
    active: d.is_active
  }));
};

// Fetch Authorizers from Supabase (Agora retorna ID e Name)
export const fetchAuthorizers = async (): Promise<{ id: string; name: string }[]> => {
  const { data, error } = await supabase
    .from('authorizers')
    .select('id, name')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching authorizers:', error);
    return [];
  }

  return data.map(a => ({ id: a.id, name: a.name }));
};

// Fetch Payment Accounts from Supabase (Agora retorna ID e Label)
export const fetchPaymentAccounts = async (): Promise<{ id: string; label: string }[]> => {
  const { data, error } = await supabase
    .from('payment_accounts')
    .select('id, label')
    .eq('is_active', true)
    .order('label');

  if (error) {
    console.error('Error fetching accounts:', error);
    return [];
  }

  return data.map(a => ({ id: a.id, label: a.label }));
};

/**
 * Upload File to Supabase Storage
 * @param file O arquivo a ser enviado.
 * @param type O tipo de anexo ('invoice', 'boleto', 'other') para definir a subpasta.
 * @param protocolId O ID do protocolo para criar a pasta de organização.
 * @returns A URL pública do arquivo.
 */
export const uploadAttachment = async (file: File, type: 'invoice' | 'boleto' | 'other', protocolId: string): Promise<string> => {
  const fileExt = file.name.split('.').pop() || 'bin';
  const subfolder = 'anexos'; // Pasta genérica para todos os anexos
  
  // Novo path: anexos/protocolId/timestamp_random.ext
  const safeFileName = `${subfolder}/${protocolId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

  const options = {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  };

  if (import.meta.env.DEV) {
    console.log(`[storage-upload] DEV LOG: Bucket: ${STORAGE_BUCKET}, Path: ${safeFileName}, File Type: ${file.type}`);
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(safeFileName, file, options);

  if (error) {
    console.error('[storage-upload] Detailed Error:', error);
    throw new Error(error.message || 'Falha desconhecida no upload do Supabase Storage.');
  }

  const { data: publicUrlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(safeFileName);

  console.log(`[storage-upload] Upload successful. Public URL: ${publicUrlData.publicUrl}`);
  return publicUrlData.publicUrl;
};

/**
 * Remove um arquivo do Supabase Storage.
 */
export const removeAttachment = async (url: string): Promise<boolean> => {
  // A URL pública é: https://[project_id].supabase.co/storage/v1/object/public/uploads/anexos/protocolId/filename
  // Precisamos extrair o caminho a partir de 'uploads/'
  const path = url.split(`${STORAGE_BUCKET}/`)[1];

  if (!path) {
    console.error('[storage-remove] URL inválida para remoção:', url);
    return false;
  }

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([path]);

  if (error) {
    console.error('[storage-remove] Erro ao remover arquivo:', error);
    return false;
  }
  return true;
};


/**
 * Cria um registro inicial no banco de dados com status DRAFT.
 */
export const createDraftRequest = async (requestId: string): Promise<boolean> => {
  const dbPayload = {
    protocol: requestId,
    status: 'draft',
    // Preenchendo campos obrigatórios com placeholders para evitar erro 400
    requester_name: 'Rascunho',
    requester_whatsapp: '(00) 00000-0000',
    department_id: PLACEHOLDER_UUID,
    authorizer_id: PLACEHOLDER_UUID,
    due_date: new Date().toISOString().split('T')[0],
    payment_account_id: PLACEHOLDER_UUID,
    vendor_name: 'Rascunho',
    amount_cents: 0,
    payment_method: 'PIX',
    description: 'Rascunho de solicitação',
    invoice_commitment: false,
    agreed_terms: false,
    urgent: false,
    // Inicializa o campo de anexos como JSON vazio
    attachments_json: '[]', 
  };

  try {
    const { error } = await supabase
      .from(TABLE_NAME)
      .upsert([dbPayload], { onConflict: 'protocol' });

    if (error) {
      console.error('[createDraftRequest] Supabase DB Upsert Error:', JSON.stringify(error, null, 2));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[createDraftRequest] Save failed", e);
    return false;
  }
};

/**
 * Atualiza o registro DRAFT com o array de anexos.
 */
export const updateRequestAttachments = async (
  protocolId: string, 
  attachments: AttachmentMeta[]
): Promise<boolean> => {
  const payload = { 
    attachments_json: JSON.stringify(attachments)
  };

  const { error } = await supabase
    .from(TABLE_NAME)
    .update(payload)
    .eq('protocol', protocolId);

  if (error) {
    console.error('[updateRequestAttachments] Supabase DB Update Error:', JSON.stringify(error, null, 2));
    return false;
  }
  return true;
};


/**
 * Finaliza a solicitação, atualizando o registro DRAFT para PENDING e preenchendo todos os dados.
 */
export const submitRequest = async (
  data: CSPFormData, 
  requestId: string, 
  authorizerId: string, 
  paymentAccountId: string, 
  isUrgent: boolean
): Promise<boolean> => {
  
  // Verifica se há pelo menos uma nota fiscal anexada ou se o compromisso foi aceito
  const hasInvoiceAttached = data.attachments.some(a => a.type === 'invoice');
  const invoiceStatus = hasInvoiceAttached 
    ? 'Anexado' 
    : data.invoiceSentViaWhatsapp 
      ? 'Pendente via WhatsApp' 
      : 'Não possui';

  const dbPayload = {
    requester_name: data.requesterName,
    requester_whatsapp: data.whatsapp,
    department_id: data.departmentId,
    description: data.description,
    due_date: data.dueDate,
    vendor_name: data.supplierName,
    amount_cents: parseInt(data.value),
    payment_method: data.paymentMethod,
    pix_key: data.pixKey || null,
    status: 'pending', // Status final
    
    // Novo campo de anexos (JSON)
    attachments_json: JSON.stringify(data.attachments),
    
    // Campos antigos de anexo (mantidos para compatibilidade com a tabela atual, mas com valores simplificados)
    invoice_attachment_path: invoiceStatus, 
    boleto_attachment_path: data.attachments.find(a => a.type === 'boleto')?.url || null,
    
    is_budget_specific: data.isSpecificBudget === 'yes',
    budget_id: null, // budget_id é nullable
    authorization_number: data.authNumber || null,
    authorizer_id: authorizerId, // UUID obrigatório
    payment_account_id: paymentAccountId, // UUID obrigatório
    agreed_terms: data.termsAccepted, // Boolean obrigatório
    urgent: isUrgent, // Boolean obrigatório
    invoice_commitment: data.invoiceSentViaWhatsapp, // Boolean obrigatório
  };

  try {
    // Usamos UPDATE no registro DRAFT existente
    const { error } = await supabase
      .from(TABLE_NAME)
      .update(dbPayload)
      .eq('protocol', requestId);

    if (error) {
      console.error('Supabase DB Update Error (Final Submission):', JSON.stringify(error, null, 2));
      return false;
    }

    return true;

  } catch (e) {
    console.error("Final submission failed", e);
    return false;
  }
};

// Funções de leitura (mantidas, mas agora os dados de autorizador/conta virão do DB)

const mapDbToCSPRequest = (data: any): CSPRequest => {
  let attachments: AttachmentMeta[] = [];
  try {
    if (data.attachments_json) {
      attachments = JSON.parse(data.attachments_json);
    }
  } catch (e) {
    console.error("Failed to parse attachments_json:", e);
  }

  // Determina hasInvoice baseado nos anexos ou no compromisso
  const hasInvoice = attachments.some(a => a.type === 'invoice') || data.invoice_commitment ? 'yes' : 'no';

  return {
    id: data.protocol,
    requesterName: data.requester_name,
    whatsapp: data.requester_whatsapp,
    departmentId: data.department_id,
    authorizer: data.authorizer_id, // Retornando ID
    dueDate: data.due_date,
    paymentAccount: data.payment_account_id, // Retornando ID
    isSpecificBudget: data.is_budget_specific ? 'yes' : 'no',
    supplierName: data.vendor_name,
    value: data.amount_cents.toString(),
    paymentMethod: data.payment_method,
    pixKey: data.pix_key,
    
    attachments: attachments, // Novo campo
    hasInvoice: hasInvoice,
    invoiceSentViaWhatsapp: data.invoice_commitment, // Mapeando de volta
    
    description: data.description,
    termsAccepted: data.agreed_terms, // Mapeando de volta
    createdAt: data.created_at,
    status: data.status as RequestStatus,
    history: []
  };
};

export const getRequestByProtocol = async (protocol: string): Promise<CSPRequest | null> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('protocol', protocol.trim())
    .single();

  if (error || !data) {
    return null;
  }

  return mapDbToCSPRequest(data);
};

export const getRequests = async (): Promise<CSPRequest[]> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching requests:', error);
    return [];
  }

  return data.map(mapDbToCSPRequest);
};

export const updateRequestStatus = async (id: string, status: RequestStatus): Promise<boolean> => {
  const { error } = await supabase
    .from(TABLE_NAME)
    .update({ status })
    .eq('protocol', id);

  if (error) {
    console.error('Error updating status:', error);
    return false;
  }

  return true;
};