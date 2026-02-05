import { supabase } from '../src/integrations/supabase/client';
import { Department, CSPFormData, CSPRequest, RequestStatus } from '../types';

const STORAGE_BUCKET = 'uploads'; // Nome do bucket centralizado
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
export const fetchAuthorizers = async () => {
  const { data, error } = await supabase
    .from('authorizers')
    .select('name')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching authorizers:', error);
    return [];
  }

  return data.map(a => a.name);
};

// Fetch Payment Accounts from Supabase
export const fetchPaymentAccounts = async () => {
  const { data, error } = await supabase
    .from('payment_accounts')
    .select('label')
    .eq('is_active', true)
    .order('label');

  if (error) {
    console.error('Error fetching accounts:', error);
    return [];
  }

  return data.map(a => a.label);
};

/**
 * Upload File to Supabase Storage
 * @param file O arquivo a ser enviado.
 * @param type O tipo de anexo ('invoice' ou 'boleto') para definir a subpasta.
 * @returns A URL pública do arquivo.
 */
export const uploadInvoice = async (file: File, type: 'invoice' | 'boleto'): Promise<string> => {
  const fileExt = file.name.split('.').pop() || 'bin';
  const subfolder = type === 'invoice' ? 'invoices' : 'boletos';
  
  // Use a safe, unique path structure: bucket/subfolder/timestamp_random.ext
  const safeFileName = `${subfolder}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

  const options = {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  };

  // Log de depuração (Tarefa 5)
  if (import.meta.env.DEV) {
    console.log(`[storage-upload] DEV LOG: Bucket: ${STORAGE_BUCKET}, Path: ${safeFileName}, File Type: ${file.type}`);
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(safeFileName, file, options);

  if (error) {
    console.error('[storage-upload] Detailed Error:', error);
    // Throw the error object itself, which might contain more details
    throw new Error(error.message || 'Falha desconhecida no upload do Supabase Storage.');
  }

  const { data: publicUrlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(safeFileName);

  console.log(`[storage-upload] Upload successful. Public URL: ${publicUrlData.publicUrl}`);
  return publicUrlData.publicUrl;
};

export const submitRequest = async (data: CSPFormData, requestId: string): Promise<boolean> => {
  const url_anexo = data.hasInvoice === 'yes' && data.invoiceUrl 
    ? data.invoiceUrl 
    : 'Pendente via WhatsApp';

  const dbPayload = {
    protocol: requestId,
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
    boleto_attachment_path: data.boletoUrl || null,
    is_budget_specific: data.isSpecificBudget === 'yes',
    authorization_number: data.authNumber || null
  };

  try {
    const { error } = await supabase
      .from(TABLE_NAME)
      .insert([dbPayload]);

    if (error) {
      console.error('Supabase DB Insert Error:', error);
      return false;
    }

    return true;

  } catch (e) {
    console.error("Save failed", e);
    return false;
  }
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

  return {
    id: data.protocol,
    requesterName: data.requester_name,
    whatsapp: data.requester_whatsapp,
    departmentId: data.department_id,
    authorizer: '',
    dueDate: data.due_date,
    paymentAccount: '',
    isSpecificBudget: data.is_budget_specific ? 'yes' : 'no',
    supplierName: data.vendor_name,
    value: data.amount_cents.toString(),
    paymentMethod: data.payment_method,
    hasInvoice: data.invoice_attachment_path ? 'yes' : 'no',
    invoiceSentViaWhatsapp: false,
    description: data.description,
    termsAccepted: true,
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
    invoiceSentViaWhatsapp: false,
    description: req.description,
    termsAccepted: true,
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