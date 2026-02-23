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

// Fetch Budgets from Supabase (Used for lookup if needed)
export const fetchBudgets = async (): Promise<{ id: string; name: string }[]> => {
  const { data, error } = await supabase
    .from('budgets')
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error fetching budgets:', error);
    return [];
  }

  return data || [];
};

/**
 * Upload File to Supabase Storage
 */
export const uploadInvoice = async (file: File, type: 'invoice' | 'boleto' | 'transfer', protocolId: string): Promise<string> => {
  const fileExt = file.name.split('.').pop() || 'bin';
  let subfolder: string;
  
  if (type === 'invoice') subfolder = 'notas_fiscais';
  else if (type === 'boleto') subfolder = 'boletos';
  else subfolder = 'transferencias';
  
  const safeFileName = `${subfolder}/${protocolId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(safeFileName, file, { cacheControl: '3600', upsert: false });

  if (error) {
    console.error('[storage-upload] Error:', error);
    throw new Error(error.message);
  }

  const { data: publicUrlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(safeFileName);

  return publicUrlData.publicUrl;
};

/**
 * Cria um registro inicial no banco de dados com status DRAFT
 */
export const createDraftRequest = async (departmentId: string, authorizerId: string, paymentAccountId: string): Promise<string | null> => {
  const dbPayload = {
    status: 'draft',
    requester_name: 'Rascunho',
    requester_whatsapp: '(00) 00000-0000',
    department_id: departmentId,
    authorizer_id: authorizerId,
    due_date: new Date().toISOString().split('T')[0],
    payment_account_id: paymentAccountId,
    vendor_name: 'Rascunho',
    description: 'Rascunho de solicitação',
    invoice_commitment: false,
    agreed_terms: false,
    urgent: false,
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert([dbPayload])
    .select('protocol')
    .single();

  if (error) {
    console.error('[createDraftRequest] Error:', error);
    return null;
  }
  
  return data?.protocol || null;
};

/**
 * Atualiza o registro DRAFT com a URL do anexo
 */
export const updateRequestAttachments = async (protocolId: string, type: 'invoice' | 'boleto' | 'transfer', url: string): Promise<boolean> => {
  const field = type === 'invoice' ? 'invoice_attachment_path' : type === 'boleto' ? 'boleto_attachment_path' : 'transfer_attachment_path';
  const { error } = await supabase.from(TABLE_NAME).update({ [field]: url }).eq('protocol', protocolId);
  return !error;
};

/**
 * Finaliza a solicitação.
 */
export const submitRequest = async (data: CSPFormData, requestId: string, authorizerId: string, paymentAccountId: string, isUrgent: boolean): Promise<boolean> => {
  const url_anexo = data.hasInvoice === 'yes' && data.invoiceUrl ? data.invoiceUrl : 'Pendente via WhatsApp';
  const mappedPaymentMethod = data.paymentMethod.toLowerCase().replace('transferência', 'transferencia');

  // Lógica de Resolução de Budget ID (Correção do Erro 23514)
  let finalBudgetId = null;
  if (data.isSpecificBudget === 'yes') {
    const budgetName = data.specificBudgetName;
    if (!budgetName) {
        console.error('[submitRequest] Falha: Nome da verba não fornecido.');
        return false;
    }

    // Busca o ID via nome diretamente no Supabase para garantir o PATCH correto
    const { data: budgetLookup, error: lookupError } = await supabase
      .from('budgets')
      .select('id')
      .eq('name', budgetName)
      .maybeSingle();

    if (lookupError || !budgetLookup) {
      console.error(`[submitRequest] Falha ao resolver budget_id para: ${budgetName}`, lookupError);
      // Retorna false para que o App.tsx dispare o toast de erro apropriado
      return false;
    }
    
    finalBudgetId = budgetLookup.id;
    console.log(`[submitRequest] Budget resolvido: ${budgetName} -> ${finalBudgetId}`);
  }

  const dbPayload = {
    requester_name: data.requesterName,
    requester_whatsapp: data.whatsapp,
    department_id: data.departmentId,
    description: data.description,
    due_date: data.dueDate,
    vendor_name: data.supplierName,
    amount_cents: parseInt(data.value), 
    payment_method: mappedPaymentMethod,
    pix_key_type: data.paymentMethod === 'PIX' ? data.pixKeyType : null,
    pix_key: data.paymentMethod === 'PIX' ? data.pixKey : null,
    boleto_attachment_path: data.paymentMethod === 'Boleto' ? data.boletoUrl : null,
    transfer_bank: data.paymentMethod === 'Transferência' ? data.transferBankName : null,
    transfer_account_type: data.paymentMethod === 'Transferência' ? data.transferAccountType : null,
    transfer_agency: data.paymentMethod === 'Transferência' ? data.transferAgency : null,
    transfer_account: data.paymentMethod === 'Transferência' ? data.transferAccount : null,
    transfer_document: data.paymentMethod === 'Transferência' ? data.transferCpfCnpj : null,
    transfer_favored_name: data.paymentMethod === 'Transferência' ? data.transferBeneficiaryName : null,
    transfer_attachment_path: data.paymentMethod === 'Transferência' ? data.transferUrl : null,
    status: 'pending' as RequestStatus,
    invoice_attachment_path: url_anexo,
    is_budget_specific: data.isSpecificBudget === 'yes',
    budget_id: finalBudgetId, 
    authorizer_id: authorizerId,
    payment_account_id: paymentAccountId,
    agreed_terms: data.termsAccepted,
    urgent: isUrgent,
    invoice_commitment: data.invoiceSentViaWhatsapp,
  };

  const { error } = await supabase.from(TABLE_NAME).update(dbPayload).eq('protocol', requestId);
  
  if (error) {
    console.error('[submitRequest] Erro no update final:', error);
  }

  return !error;
};

export const getRequestByProtocol = async (protocol: string): Promise<CSPRequest | null> => {
  const { data, error } = await supabase.from(TABLE_NAME).select('*, rejection_reason, paid_at').eq('protocol', protocol.trim().toUpperCase()).single();
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
    value: data.amount_cents?.toString() || '0',
    paymentMethod: data.payment_method || '',
    pixKeyType: data.pix_key_type || '',
    pixKey: data.pix_key || '',
    hasInvoice: data.invoice_attachment_path ? 'yes' : 'no',
    invoiceSentViaWhatsapp: data.invoice_commitment,
    description: data.description,
    termsAccepted: data.agreed_terms,
    createdAt: data.created_at,
    status: data.status as RequestStatus,
    invoiceUrl: data.invoice_attachment_path,
    boletoUrl: data.boleto_attachment_path,
    transferBankName: data.transfer_bank || '',
    transferAccountType: data.transfer_account_type || '',
    transferAgency: data.transfer_agency || '',
    transferAccount: data.transfer_account || '',
    transferCpfCnpj: data.transfer_document || '',
    transferBeneficiaryName: data.transfer_favored_name || '',
    transferUrl: data.transfer_attachment_path,
    history: [],
    rejectionReason: data.rejection_reason,
    paidAt: data.paid_at
  } as any;
};

export const getRequests = async (): Promise<CSPRequest[]> => {
  const { data, error } = await supabase.from(TABLE_NAME).select('*, rejection_reason, paid_at').order('created_at', { ascending: false });
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
    value: req.amount_cents?.toString() || '0',
    paymentMethod: req.payment_method || '',
    pixKeyType: req.pix_key_type || '',
    pixKey: req.pix_key || '',
    hasInvoice: req.invoice_attachment_path && req.invoice_attachment_path !== 'Pendente via WhatsApp' ? 'yes' : 'no',
    invoiceSentViaWhatsapp: req.invoice_commitment,
    description: req.description,
    termsAccepted: req.agreed_terms,
    createdAt: req.created_at,
    status: req.status as RequestStatus,
    boletoUrl: req.boleto_attachment_path,
    invoiceUrl: req.invoice_attachment_path,
    transferBankName: req.transfer_bank || '',
    transferAccountType: req.transfer_account_type || '',
    transferAgency: req.transfer_agency || '',
    transferAccount: req.transfer_account || '',
    transferCpfCnpj: req.transfer_document || '',
    transferBeneficiaryName: req.transfer_favored_name || '',
    transferUrl: req.transfer_attachment_path,
    history: [],
    rejectionReason: req.rejection_reason,
    paidAt: req.paid_at
  } as any));
};

export const updateRequestStatus = async (id: string, status: RequestStatus, reason?: string): Promise<boolean> => {
  const payload: any = { status };
  if (reason !== undefined) payload.rejection_reason = reason;
  if (status === 'paid') payload.paid_at = new Date().toISOString();

  const { error, status: httpStatus } = await supabase.from(TABLE_NAME).update(payload).eq('protocol', id);

  if (error) {
    console.error('[updateRequestStatus] CRITICAL ERROR:');
    console.error('- Protocolo:', id);
    console.error('- Status HTTP:', httpStatus);
    console.error('- Payload:', JSON.stringify(payload, null, 2));
    console.error('- Message:', error.message);
    console.error('- Details:', error.details);
    console.error('- Code:', error.code);
  }

  return !error;
};