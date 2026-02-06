export interface Department {
  id: string;
  name: string;
  active: boolean;
}

export type RequestStatus = 'pending' | 'approved' | 'paid' | 'rejected' | 'draft';

export interface FileMeta {
  name: string;
  size: number;
  url?: string;
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
  boletoCode?: string;
  boletoDueDate?: string;
  boletoFile?: File | null;
  boletoFileMeta?: { name: string; size: number };
  boletoUrl?: string;

  // Step 3: Proof
  hasInvoice: 'yes' | 'no';
  invoiceFile?: File | null;
  invoiceFileMeta?: { name: string; size: number }; 
  invoiceUrl?: string; // Mantido para compatibilidade (será JSON string se múltiplo)
  invoiceUrls?: string[]; // Array de URLs reais
  invoiceFilesMeta?: FileMeta[]; // Lista de metadados dos arquivos
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
  hasInvoice: 'yes',
  invoiceSentViaWhatsapp: false,
  description: '',
  termsAccepted: false,
  invoiceUrl: '',
  invoiceUrls: [],
  invoiceFilesMeta: []
};

export interface ValidationErrors {
  [key: string]: string;
}