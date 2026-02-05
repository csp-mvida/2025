import { supabase } from '../src/integrations/supabase/client';
import { Department, CSPFormData, CSPRequest, RequestStatus } from '../types';

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
 * @param type O tipo de anexo ('invoice' ou 'boleto') para definir a subpasta.
 * @param protocolId O ID do protocolo para criar a pasta de organização.
 * @returns A URL pública do arquivo.
 */
export const uploadInvoice = async (file: File, type: 'invoice' | 'boleto', protocolId: string): Promise<string> => {
  const fileExt = file.name.split('.').pop() || 'bin';
  // Usando 'notas_fiscais' para invoices e 'boletos' para boletos
  const subfolder = type === 'invoice' ? 'notas_fiscais' : 'boletos'; 
  
  // Novo path: subfolder/protocolId/timestamp_random.ext
  const safeFileName = `${subfolder}/${protocolId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

  const options = {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  };

  // Log de depuração
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
 * Cria um registro inicial no banco de dados com status DRAFT.
 * Isso garante que o protocolo exista antes de qualquer upload.
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
  };

  try {
    // Usamos upsert para garantir que se o rascunho já existir (ex: refresh), ele não falhe
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
 * Atualiza o registro DRAFT com a URL do anexo após um upload bem-sucedido.
 */
export const updateRequestAttachments = async (
  protocolId: string, 
  type: 'invoice' | 'boleto', 
  url: string
): Promise<boolean> => {
  const payload = type === 'invoice' 
    ? { invoice_attachment_path: url } 
    : { boleto_attachment_path: url };

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
  
  // Nota: invoice_attachment_path e boleto_attachment_path já devem estar preenchidos
  // via updateRequestAttachments, mas incluímos aqui para garantir que o valor final
  // (se for 'Pendente via WhatsApp') seja salvo corretamente.
  const url_anexo = data.hasInvoice === 'yes' && data.invoiceUrl 
    ? data.invoiceUrl 
    : 'Pendente via WhatsApp';

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
    invoice_attachment_path: url_anexo,
    boleto_attachment_path: data.boletoUrl || null,
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
      // Log detalhado do erro (Tarefa 1)
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

export const getRequestByProtocol = async (protocol: string): Promise<CSPRequest | null> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('protocol', protocol.trim())
    .single();

  if (error || !data) {
    return null;
  }

  // Nota: authorizer e paymentAccount são strings no CSPFormData, mas o DB armazena IDs.
  // Para simplificar, mantemos strings vazias aqui, pois o RequestTracker não exibe esses campos.
  return {
    id: data.protocol,
    requesterName: data.requester_name,
    whatsapp: data.requester_whatsapp,
    departmentId: data.department_id,
    authorizer: '', // Não mapeado de volta para nome aqui
    dueDate: data.due_date,
    paymentAccount: '', // Não mapeado de volta para label aqui
    isSpecificBudget: data.is_budget_specific ? 'yes' : 'no',
    supplierName: data.vendor_name,
    value: data.amount_cents.toString(),
    paymentMethod: data.payment_method,
    hasInvoice: data.invoice_attachment_path ? 'yes' : 'no',
    invoiceSentViaWhatsapp: data.invoice_commitment, // Mapeando de volta
    description: data.description,
    termsAccepted: data.agreed_terms, // Mapeando de volta
    createdAt: data.created_at,
    status: data.status as RequestStatus,
    invoiceUrl: data.invoice_attachment_path,
    boletoUrl: data.boleto_attachment_path,
    history: []
  };
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

  return data.map(req => ({
    id: req.protocol,
    requesterName: req.requester_name,
    whatsapp: req.requester_whatsapp,
    departmentId: req.department_id,
    authorizer: '',
    dueDate: req.due_date,
    paymentAccount: '',
    isSpecificBudget: req.is_budget_specific ? 'yes' : 'no',
    supplierName: req.vendor_name,
    value: req.amount_cents.toString(),
    paymentMethod: req.payment_method,
    hasInvoice: req.invoice_attachment_path ? 'yes' : 'no',
    invoiceSentViaWhatsapp: req.invoice_commitment,
    description: req.description,
    termsAccepted: req.agreed_terms,
    createdAt: req.created_at,
    status: req.status as RequestStatus,
    boletoUrl: req.boleto_attachment_path,
    history: []
  }));
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