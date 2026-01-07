import { supabase } from '../src/integrations/supabase/client';
import { Department, CSPFormData, CSPRequest, RequestStatus } from '../types';

const DB_KEY = 'csp_db_requests';
const BUCKET_NAME = 'comprovantes';
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

// Upload File to Supabase Storage
export const uploadInvoice = async (file: File): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${fileName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file);

  if (error) {
    console.error('Error uploading file:', error);
    throw new Error('Falha no upload do arquivo.');
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

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

    const newRequest: CSPRequest = {
      ...data,
      id: requestId,
      createdAt: new Date().toISOString(),
      status: 'pending',
      invoiceUrl: url_anexo,
      history: [{ date: new Date().toISOString(), action: 'Criado', user: data.requesterName }]
    };

    const existing = localStorage.getItem(DB_KEY);
    const db = existing ? JSON.parse(existing) : [];
    db.push(newRequest);
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    
    return true;

  } catch (e) {
    console.error("Save failed", e);
    return false;
  }
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