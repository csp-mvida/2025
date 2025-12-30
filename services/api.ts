import { createClient } from '@supabase/supabase-js';
import { DEPARTMENTS_FALLBACK, CSP_ENDPOINT_URL, SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants';
import { Department, CSPFormData, CSPRequest, RequestStatus } from '../types';

// Initialize Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DB_KEY = 'csp_db_requests';
const BUCKET_NAME = 'comprovantes';
const TABLE_NAME = 'tb_solicitacoes_pagamento';

// Mock Supabase fetch for Departments (kept as requested, or until backend table is ready)
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
  console.log(`Submitting to Supabase`, { ...data, requestId });

  // 1. Prepare Payload for Database
  const url_anexo = data.hasInvoice === 'yes' && data.invoiceUrl 
    ? data.invoiceUrl 
    : 'Pendente via WhatsApp';

  // Map camelCase to snake_case for DB
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
    url_anexo: url_anexo, // Column requested
    status: 'pending',
    created_at: new Date().toISOString()
  };

  try {
    // 2. Insert into Supabase Table
    const { error } = await supabase
      .from(TABLE_NAME)
      .insert([dbPayload]);

    if (error) {
      console.error('Supabase DB Insert Error:', error);
      // Fallback: If DB fails (e.g. table doesn't exist yet in dev), continue to LocalStorage
      // so the user flow isn't completely broken during testing.
    } else {
      console.log('Successfully saved to Supabase DB');
    }

    // 3. Save to LocalStorage (Legacy/Admin Panel Compatibility)
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

// Admin Services (Kept on LocalStorage for now to ensure dashboard works without full backend setup)
export const getRequests = async (): Promise<CSPRequest[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const existing = localStorage.getItem(DB_KEY);
      const db: CSPRequest[] = existing ? JSON.parse(existing) : [];
      // Sort by newest
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