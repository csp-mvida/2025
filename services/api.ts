import { supabase } from '../src/integrations/supabase/client';
import { Department, CSPFormData, CSPRequest, RequestStatus } from '../types';

const STORAGE_BUCKET = 'uploads'; 
const TABLE_NAME = 'payment_requests';

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

// Fetch Authorizers from Supabase
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

// Fetch Payment Accounts from Supabase
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
 */
export const uploadInvoice = async (file: File, type: 'invoice' | 'boleto', protocolId: string): Promise<string> => {
  const fileExt = file.name.split('.').pop() || 'bin';
  const subfolder = type === 'invoice' ? 'notas_fiscais' : 'boletos'; 
  
  const safeFileName = `${subfolder}/${protocolId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

  const options = {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  };

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(safeFileName, file, options);

  if (error) {
    console.error('[storage-upload] Detailed Error:', error);
    throw new Error(error.message || 'Falha no upload do arquivo.');
  }

  const { data: publicUrlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(safeFileName);

  return publicUrlData.publicUrl;
};

/**
 * Cria um registro inicial no banco de dados. 
 * Agora essa função só será chamada quando tivermos os dados mínimos necessários.
 */
export const createDraftRequest = async (data: CSPFormData, authorizerId: string): Promise<string | null> => {
  const dbPayload = {
    status: 'draft',
    requester_name: data.requesterName || 'Rascunho',
    requester_whatsapp: data.whatsapp || '(00) 00000-0000',
    department_id: data.departmentId,
    authorizer_id: authorizerId,
    due_date: data.dueDate ? data.dueDate.split('T')[0] : new Date().toISOString().split('T')[0],
    payment_account_id: null, // Será preenchido depois
    vendor_name: data.supplierName || 'Pendente',
    amount_cents: data.value ? parseInt(data.value) : 0,
    payment_method: data.paymentMethod || 'PIX',
    description: data.description || 'Rascunho em preenchimento',
    invoice_commitment: data.invoiceSentViaWhatsapp,
    agreed_terms: data.termsAccepted,
    urgent: false,
  };

  try {
    const { data: inserted, error } = await supabase
      .from(TABLE_NAME)
      .insert([dbPayload])
      .select('protocol')
      .single();

    if (error) {
      console.error('[createDraftRequest] Error:', error);
      return null;
    }
    return inserted.protocol;
  } catch (e) {
    return null;
  }
};

/**
 * Atualiza o registro com anexos.
 */
export const updateRequestAttachments = async (
  protocolId: string, 
  type: 'invoice' | 'boleto', 
  url: string
): Promise<boolean> => {
  if (!protocolId) return true; // Se não houver protocolo no banco ainda, ignoramos (será salvo no final)

  const payload = type === 'invoice' 
    ? { invoice_attachment_path: url } 
    : { boleto_attachment_path: url };

  const { error } = await supabase
    .from(TABLE_NAME)
    .update(payload)
    .eq('protocol', protocolId);

  return !error;
};


/**
 * Finaliza a solicitação.
 */
export const submitRequest = async (
  data: CSPFormData, 
  protocolId: string, 
  authorizerId: string, 
  paymentAccountId: string, 
  isUrgent: boolean
): Promise<boolean> => {
  
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
    status: 'pending',
    invoice_attachment_path: url_anexo,
    boleto_attachment_path: data.paymentMethod === 'Boleto' ? data.boletoUrl : null,
    is_budget_specific: data.isSpecificBudget === 'yes',
    authorization_number: data.authNumber || null,
    authorizer_id: authorizerId,
    payment_account_id: paymentAccountId,
    agreed_terms: data.termsAccepted,
    urgent: isUrgent,
    invoice_commitment: data.invoiceSentViaWhatsapp,
  };

  try {
    let result;
    
    if (protocolId) {
      // Se já existe um protocolo (criado como rascunho), atualizamos
      result = await supabase
        .from(TABLE_NAME)
        .update(dbPayload)
        .eq('protocol', protocolId);
    } else {
      // Se não existe, criamos um novo agora (o trigger gera o protocolo)
      result = await supabase
        .from(TABLE_NAME)
        .insert([dbPayload])
        .select('protocol')
        .single();
    }

    if (result.error) {
      console.error('Submission Error:', result.error);
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
};

export const getRequestByProtocol = async (protocol: string): Promise<CSPRequest | null> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('protocol', protocol.trim())
    .single();

  if (error || !data) return null;

  return {
    id: data.protocol,
    requesterName: data.requester_name,
    whatsapp: data.requester_whatsapp,
    departmentId: data.department_id,
    authorizer: data.authorizer_id,
    dueDate: data.due_date,
    paymentAccount: data.payment_account_id,
    isSpecificBudget: data.is_budget_specific ? 'yes' : 'no',
    supplierName: data.vendor_name,
    value: data.amount_cents.toString(),
    paymentMethod: data.payment_method,
    hasInvoice: data.invoice_attachment_path ? 'yes' : 'no',
    invoiceSentViaWhatsapp: data.invoice_commitment,
    description: data.description,
    termsAccepted: data.agreed_terms,
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

  if (error) return [];

  return data.map(req => ({
    id: req.protocol,
    requesterName: req.requester_name,
    whatsapp: req.requester_whatsapp,
    departmentId: req.department_id,
    authorizer: req.authorizer_id,
    dueDate: req.due_date,
    paymentAccount: req.payment_account_id,
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
    invoiceUrl: req.invoice_attachment_path,
    history: []
  }));
};

export const updateRequestStatus = async (id: string, status: RequestStatus): Promise<boolean> => {
  const { error } = await supabase
    .from(TABLE_NAME)
    .update({ status })
    .eq('protocol', id);

  return !error;
};