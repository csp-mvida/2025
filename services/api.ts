import { supabase } from '../src/integrations/supabase/client';
import { Department, CSPFormData, CSPRequest, RequestStatus } from '../types';

const STORAGE_BUCKET = 'uploads'; 
const TABLE_NAME = 'payment_requests';

export const fetchDepartments = async (): Promise<Department[]> => {
  const { data, error } = await supabase
    .from('departments')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name');
  if (error) return [];
  return data.map(d => ({ id: d.id, name: d.name, active: d.is_active }));
};

export const fetchAuthorizers = async (): Promise<{ id: string; name: string }[]> => {
  const { data, error } = await supabase.from('authorizers').select('id, name').eq('is_active', true);
  if (error) return [];
  return data;
};

export const fetchPaymentAccounts = async (): Promise<{ id: string; label: string }[]> => {
  const { data, error } = await supabase.from('payment_accounts').select('id, label').eq('is_active', true).order('label');
  if (error) return [];
  return data;
};

export const uploadInvoice = async (file: File, type: 'invoice' | 'boleto', tempId: string): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const path = `${type === 'invoice' ? 'notas' : 'boletos'}/${tempId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file);
  if (error) throw error;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

export const submitRequest = async (
  data: CSPFormData, 
  authorizerId: string, 
  paymentAccountId: string, 
  isUrgent: boolean
): Promise<string | null> => {
  
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
    invoice_attachment_path: data.invoiceUrl || (data.hasInvoice === 'no' ? 'Pendente via WhatsApp' : null),
    boleto_attachment_path: data.boletoUrl || null,
    is_budget_specific: data.isSpecificBudget === 'yes',
    budget_id: null,
    authorization_number: data.authNumber || null,
    authorizer_id: authorizerId,
    payment_account_id: paymentAccountId,
    agreed_terms: data.termsAccepted,
    urgent: isUrgent,
    invoice_commitment: data.invoiceSentViaWhatsapp,
  };

  const { data: inserted, error } = await supabase
    .from(TABLE_NAME)
    .insert([dbPayload])
    .select('protocol')
    .single();

  if (error) {
    console.error('Submit error:', error);
    return null;
  }
  return inserted.protocol;
};

export const getRequestByProtocol = async (protocol: string): Promise<CSPRequest | null> => {
  const { data, error } = await supabase.from(TABLE_NAME).select('*').eq('protocol', protocol.trim()).single();
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
  const { data, error } = await supabase.from(TABLE_NAME).select('*').order('created_at', { ascending: false });
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
  const { error } = await supabase.from(TABLE_NAME).update({ status }).eq('protocol', id);
  return !error;
};