import { supabase } from '../src/integrations/supabase/client';
import { Department, CSPFormData, CSPRequest, RequestStatus } from '../types';

const STORAGE_BUCKET = 'uploads';
const TABLE_NAME = 'payment_requests';

// Lookups
export const fetchDepartments = async (): Promise<Department[]> => {
  const { data, error } = await supabase.from('departments').select('id, name, is_active').eq('is_active', true).order('name');
  return data?.map(d => ({ id: d.id, name: d.name, active: d.is_active })) || [];
};

export const fetchAuthorizers = async (): Promise<{ id: string; name: string }[]> => {
  const { data, error } = await supabase.from('authorizers').select('id, name').eq('is_active', true);
  return data || [];
};

export const fetchPaymentAccounts = async (): Promise<{ id: string; label: string }[]> => {
  const { data, error } = await supabase.from('payment_accounts').select('id, label').eq('is_active', true).order('label');
  return data || [];
};

// Storage
export const uploadInvoice = async (file: File, type: 'invoice' | 'boleto' | 'transfer', protocolId: string): Promise<string> => {
  const fileExt = file.name.split('.').pop() || 'bin';
  const subfolder = type === 'invoice' ? 'notas_fiscais' : type === 'boleto' ? 'boletos' : 'transferencias';
  const safeFileName = `${subfolder}/${protocolId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(safeFileName, file);
  if (error) throw error;

  const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(safeFileName);
  return publicUrlData.publicUrl;
};

// Drafts
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

  const { data, error } = await supabase.from(TABLE_NAME).insert([dbPayload]).select('protocol').single();
  if (error) return null;
  return data.protocol;
};

export const updateRequestAttachments = async (protocolId: string, type: 'invoice' | 'boleto' | 'transfer', url: string): Promise<boolean> => {
  const field = type === 'invoice' ? 'invoice_attachment_path' : type === 'boleto' ? 'boleto_attachment_path' : 'transfer_attachment_path';
  const { error } = await supabase.from(TABLE_NAME).update({ [field]: url }).eq('protocol', protocolId);
  return !error;
};

// Submission
export const submitRequest = async (data: CSPFormData, requestId: string, authorizerId: string, paymentAccountId: string, isUrgent: boolean): Promise<boolean> => {
  const url_anexo = data.hasInvoice === 'yes' && data.invoiceUrl ? data.invoiceUrl : 'Pendente via WhatsApp';
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
    invoice_attachment_path: url_anexo,
    is_budget_specific: data.isSpecificBudget === 'yes',
    authorizer_id: authorizerId,
    payment_account_id: paymentAccountId,
    agreed_terms: data.termsAccepted,
    urgent: isUrgent,
    invoice_commitment: data.invoiceSentViaWhatsapp,
  };

  const { error } = await supabase.from(TABLE_NAME).update(dbPayload).eq('protocol', requestId);
  return !error;
};

// Revision Actions
export const approveRequest = async (protocol: string, userId: string) => {
  const { error } = await supabase.from(TABLE_NAME).update({
    status: 'approved',
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
    rejection_reason: null
  }).eq('protocol', protocol);
  return !error;
};

export const rejectRequest = async (protocol: string, userId: string, reason: string) => {
  const { error } = await supabase.from(TABLE_NAME).update({
    status: 'rejected',
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
    rejection_reason: reason
  }).eq('protocol', protocol);
  return !error;
};

export const markAsPaid = async (protocol: string) => {
  const { error } = await supabase.from(TABLE_NAME).update({
    status: 'paid',
    paid_at: new Date().toISOString()
  }).eq('protocol', protocol);
  return !error;
};

// Getters
const mapDbToRequest = (data: any): CSPRequest => ({
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
  status: data.status,
  invoiceUrl: data.invoice_attachment_path,
  boletoUrl: data.boleto_attachment_path,
  transferBankName: data.transfer_bank || '',
  transferAccountType: data.transfer_account_type || '',
  transferAgency: data.transfer_agency || '',
  transferAccount: data.transfer_account || '',
  transferCpfCnpj: data.transfer_document || '',
  transferBeneficiaryName: data.transfer_favored_name || '',
  transferUrl: data.transfer_attachment_path,
  reviewedBy: data.reviewed_by,
  reviewedAt: data.reviewed_at,
  rejectionReason: data.rejection_reason,
  paidAt: data.paid_at,
  history: []
});

export const getRequestByProtocol = async (protocol: string): Promise<CSPRequest | null> => {
  const { data, error } = await supabase.from(TABLE_NAME).select('*').eq('protocol', protocol.trim().toUpperCase()).single();
  return data ? mapDbToRequest(data) : null;
};

export const getRequests = async (): Promise<CSPRequest[]> => {
  const { data, error } = await supabase.from(TABLE_NAME).select('*').order('created_at', { ascending: false });
  return data?.map(mapDbToRequest) || [];
};

export const subscribeToRequests = (callback: () => void) => {
  return supabase.channel('schema-db-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE_NAME }, callback)
    .subscribe();
};