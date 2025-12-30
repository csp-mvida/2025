import { supabase } from '../src/integrations/supabase/client';
import { DEPARTMENTS_FALLBACK } from '../constants';
import { Department, CSPFormData, CSPRequest, RequestStatus } from '../types';

const DB_KEY = 'csp_db_requests';
const BUCKET_NAME = 'comprovantes';
const TABLE_NAME = 'tb_solicitacoes_pagamento';

// Mock Supabase fetch for Departments
export const fetchDepartments = async (): Promise<Department[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(DEPARTMENTS_FALLBACK.sort((a, b) => a.name.localeCompare(b.name)));
    }, 500);
  });
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
    request_id: requestId,
    requester_name: data.requesterName,
    whatsapp: data.whatsapp,
    department_id: data.departmentId,
    authorizer: data.authorizer,
    due_date: data.dueDate,
    payment_account: data.paymentAccount,
    is_specific_budget: data.isSpecificBudget === 'yes',
    specific_budget_name: data.specificBudgetName || null,
    supplier_name: data.supplierName,
    value: data.value,
    payment_method: data.paymentMethod,
    pix_key: data.pixKey || null,
    boleto_code: data.boletoCode || null,
    boleto_due_date: data.boletoDueDate || null,
    description: data.description,
    auth_number: data.authNumber || null,
    url_anexo: url_anexo,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  try {
    const { error } = await supabase
      .from(TABLE_NAME)
      .insert([dbPayload]);

    if (error) {
      console.error('Supabase DB Insert Error:', error);
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
  return new Promise((resolve) => {
    setTimeout(() => {
      const existing = localStorage.getItem(DB_KEY);
      const db: CSPRequest[] = existing ? JSON.parse(existing) : [];
      resolve(db.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, 600);
  });
};

export const updateRequestStatus = async (id: string, status: RequestStatus): Promise<boolean> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const existing = localStorage.getItem(DB_KEY);
      if (!existing) { resolve(false); return; }
      
      let db: CSPRequest[] = JSON.parse(existing);
      db = db.map(req => {
        if (req.id === id) {
          return { 
            ...req, 
            status,
            history: [...req.history, { date: new Date().toISOString(), action: `Status alterado para ${status}`, user: 'Admin' }] 
          };
        }
        return req;
      });
      
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      resolve(true);
    }, 400);
  });
};