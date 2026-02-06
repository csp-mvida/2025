import { supabase } from '../src/integrations/supabase/client';
import { Department, CSPFormData, CSPRequest, RequestStatus } from '../types';

const STORAGE_BUCKET = 'uploads';
const TABLE_NAME = 'payment_requests';

// --- AUTH SERVICES ---
export const signIn = async (email: string, pass: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// --- DATA SERVICES ---
export const fetchDepartments = async (): Promise<Department[]> => {
  const { data, error } = await supabase.from('departments').select('id, name, is_active').eq('is_active', true).order('name');
  return error ? [] : data.map(d => ({ id: d.id, name: d.name, active: d.is_active }));
};

export const fetchAuthorizers = async (): Promise<{ id: string; name: string }[]> => {
  const { data, error } = await supabase.from('authorizers').select('id, name').eq('is_active', true);
  return error ? [] : data.map(a => ({ id: a.id, name: a.name }));
};

export const fetchPaymentAccounts = async (): Promise<{ id: string; label: string }[]> => {
  const { data, error } = await supabase.from('payment_accounts').select('id, label').eq('is_active', true).order('label');
  return error ? [] : data.map(a => ({ id: a.id, label: a.label }));
};

export const uploadInvoice = async (file: File, type: 'invoice' | 'boleto' | 'transfer', protocolId: string): Promise<string> => {
  const fileExt = file.name.split('.').pop() || 'bin';
  let subfolder = type === 'invoice' ? 'notas_fiscais' : type === 'boleto' ? 'boletos' : 'transferencias';
  const safeFileName = `${subfolder}/${protocolId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(safeFileName, file);
  if (error) throw error;
  const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(safeFileName);
  return publicUrlData.publicUrl;
};

export const createDraftRequest = async (departmentId: string, authorizerId: string, paymentAccountId: string): Promise<string | null> => {
  // Para evitar erros de CHECK constraint, enviamos valores nulos para payment_method e amount_cents no DRAFT
  const dbPayload = {
    status: 'draft',
    requester_name: 'Iniciando...',
    requester_whatsapp: '0000000000',
    department_id: departmentId,
    authorizer_id: authorizerId,
    due_date: new Date().toISOString().split('T')[0],
    payment_account_id: paymentAccountId,
    vendor_name: 'Pendente',
    description: 'Em preenchimento...',
    invoice_commitment: false,
    agreed_terms: false,
    urgent: false,
    // Deixar null se o schema permitir, senão defaults seguros seriam necessários
    payment_method: null,
    amount_cents: null
  };

  const { data, error } = await supabase.from(TABLE_NAME).insert([dbPayload]).select('protocol').single();
  if (error) {
    console.error("[createDraftRequest] Falha ao criar registro inicial:", error);
    return null;
  }
  return data?.protocol || null;
};

export const updateRequestAttachments = async (protocolId: string, type: 'invoice' | 'boleto' | 'transfer', url: string): Promise<boolean> => {
  const field = type === 'invoice' ? 'invoice_attachment_path' : type === 'boleto' ? 'boleto_attachment_path' : 'transfer_attachment_path';
  const { error } = await supabase.from(TABLE_NAME).update({ [field]: url }).eq('protocol', protocolId);
  return !error;
};

export const submitRequest = async (data: CSPFormData, requestId: string, authorizerId: string, paymentAccountId: string, isUrgent: boolean): Promise<boolean> => {
  const mappedPaymentMethod = data.paymentMethod.toLowerCase().replace('transferência', 'transferencia');
  const amountCents = parseInt(data.value);

  const dbPayload = {
    requester_name: data.requesterName,
    requester_whatsapp: data.whatsapp,
    department_id: data.departmentId,
    description: data.description,
    due_date: data.dueDate,
    vendor_name: data.supplierName,
    amount_cents: amountCents, 
    payment_method: mappedPaymentMethod,
    pix_key: data.paymentMethod === 'PIX' ? data.pixKey : null,
    boleto_attachment_path: data.paymentMethod === 'Boleto' ? data.boletoUrl : null,
    transfer_bank: data.paymentMethod === 'Transferência' ? data.transferBankName : null,
    transfer_account_type: data.paymentMethod === 'Transferência' ? data.transferAccountType : null,
    transfer_agency: data.paymentMethod === 'Transferência' ? data.transferAgency : null,
    transfer_account: data.paymentMethod === 'Transferência' ? data.transferAccount : null,
    transfer_document: data.paymentMethod === 'Transferência' ? data.transferCpfCnpj : null,
    transfer_favored_name: data.paymentMethod === 'Transferência' ? data.transferBeneficiaryName : null,
    transfer_attachment_path: data.paymentMethod === 'Transferência' ? data.transferUrl : null,
    status: 'pending',
    invoice_attachment_path: data.hasInvoice === 'yes' ? data.invoiceUrl : 'Pendente via WhatsApp',
    is_budget_specific: data.isSpecificBudget === 'yes',
    authorizer_id: authorizerId,
    payment_account_id: paymentAccountId,
    agreed_terms: data.termsAccepted,
    urgent: isUrgent,
    invoice_commitment: data.invoiceSentViaWhatsapp,
  };

  console.log("[submitRequest] Enviando payload final:", dbPayload);
  const { error } = await supabase.from(TABLE_NAME).update(dbPayload).eq('protocol', requestId);
  if (error) console.error("[submitRequest] Erro no update final:", error);
  return !error;
};

export const getRequestByProtocol = async (protocol: string): Promise<CSPRequest | null> => {
  const { data, error } = await supabase.from(TABLE_NAME).select('*').eq('protocol', protocol.trim().toUpperCase()).single();
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
    hasInvoice: data.invoice_attachment_path ? 'yes' : 'no',
    invoiceSentViaWhatsapp: data.invoice_commitment,
    description: data.description,
    termsAccepted: data.agreed_terms,
    createdAt: data.created_at,
    status: data.status as RequestStatus,
    invoiceUrl: data.invoice_attachment_path,
    boletoUrl: data.boleto_attachment_path,
    transferUrl: data.transfer_attachment_path,
    pixKey: data.pix_key,
    transferBankName: data.transfer_bank,
    transferAccountType: data.transfer_account_type,
    transferAgency: data.transfer_agency,
    transferAccount: data.transfer_account,
    transferCpfCnpj: data.transfer_document,
    transferBeneficiaryName: data.transfer_favored_name,
    history: []
  };
};

export const getRequests = async (): Promise<CSPRequest[]> => {
  // Filtramos status != 'draft' para que o financeiro não veja rascunhos inacabados
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .neq('status', 'draft')
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
    value: req.amount_cents?.toString() || '0',
    paymentMethod: req.payment_method || '',
    hasInvoice: req.invoice_attachment_path ? 'yes' : 'no',
    invoiceSentViaWhatsapp: req.invoice_commitment,
    description: req.description,
    termsAccepted: req.agreed_terms,
    createdAt: req.created_at,
    status: req.status as RequestStatus,
    boletoUrl: req.boleto_attachment_path,
    invoiceUrl: req.invoice_attachment_path,
    transferUrl: req.transfer_attachment_path,
    pixKey: req.pix_key,
    transferBankName: req.transfer_bank,
    transferAccountType: req.transfer_account_type,
    transferAgency: req.transfer_agency,
    transferAccount: req.transfer_account,
    transferCpfCnpj: req.transfer_document,
    transferBeneficiaryName: req.transfer_favored_name,
    history: []
  }));
};

export const updateRequestStatus = async (id: string, status: RequestStatus): Promise<boolean> => {
  const { error } = await supabase.from(TABLE_NAME).update({ status }).eq('protocol', id);
  return !error;
};