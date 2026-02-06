export interface Department {
  id: string;
  name: string;
  active: boolean;
}

export type RequestStatus = 'pending' | 'approved' | 'paid' | 'rejected' | 'draft';

export interface AttachmentMeta {
  name: string;
  size: number; // Tamanho em bytes
  url: string; // URL pública do Supabase
  type: 'invoice' | 'boleto' | 'other';
}

export interface CSPFormData {
  // Step 1: Identification
  requesterName: string;
  whatsapp: string;
  departmentId: string;
  authorizer: string;
  dueDate: string; // ISO string

  // Step 2: Payment
  paymentAccount: string;
  isSpecificBudget: 'yes' | 'no';
  specificBudgetName?: string;
  supplierName: string;
  value: string; // Raw string, parsed later
  paymentMethod: 'PIX' | 'Boleto' | 'Transferência' | '';
  pixKey?: string;

  // Step 3: Proof (Agora usa um array de anexos)
  attachments: AttachmentMeta[];
  hasInvoice: 'yes' | 'no';
  invoiceSentViaWhatsapp: boolean;

  // Step 4: Description
  description: string;
  authNumber?: string;
  termsAccepted: boolean;
}

export interface CSPRequest extends CSPFormData {
  id: string;
  createdAt: string;
  status: RequestStatus;
  history: { date: string; action: string; user: string }[];
}

export const INITIAL_DATA: CSPFormData = {
  requesterName: '',
  whatsapp: '',
  departmentId: '',
  authorizer: '',
  dueDate: '',
  paymentAccount: '',
  isSpecificBudget: 'no',
  supplierName: '',
  value: '',
  paymentMethod: '',
  attachments: [], // Novo array de anexos
  hasInvoice: 'yes',
  invoiceSentViaWhatsapp: false,
  description: '',
  termsAccepted: false,
};

export interface ValidationErrors {
  [key: string]: string;
}