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
  
  // PIX fields
  pixKeyType?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random' | '';
  pixKey?: string;
  
  // Boleto fields
  boletoCode?: string;
  boletoDueDate?: string;
  boletoFile?: File | null;
  boletoFileMeta?: { name: string; size: number };
  boletoUrl?: string; // String JSON se múltiplo
  boletoUrls?: string[]; // Array de URLs reais
  boletoFilesMeta?: FileMeta[]; // Lista de metadados dos boletos

  // Transferência fields (NEW)
  transferBankName?: string;
  transferAccountType?: 'Corrente' | 'Poupança' | '';
  transferAgency?: string;
  transferAccount?: string;
  transferCpfCnpj?: string;
  transferBeneficiaryName?: string;
  transferUrl?: string; // String JSON se múltiplo
  transferUrls?: string[]; // Array de URLs reais
  transferFilesMeta?: FileMeta[]; // Lista de metadados dos arquivos de comprovante

  // Step 3: Proof
  hasInvoice: 'yes' | 'no';
  invoiceFile?: File | null;
  invoiceFileMeta?: { name: string; size: number }; 
  invoiceUrl?: string; // String JSON se múltiplo
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
  rejectionReason?: string;
  paidAt?: string;
  paymentReceiptUrl?: string;
  closedAt?: string;
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
  pixKeyType: '',
  pixKey: '',
  hasInvoice: 'yes',
  invoiceSentViaWhatsapp: false,
  description: '',
  termsAccepted: false,
  invoiceUrl: '',
  invoiceUrls: [],
  invoiceFilesMeta: [],
  boletoUrl: '',
  boletoUrls: [],
  boletoFilesMeta: [],
  // NEW Transfer fields
  transferBankName: '',
  transferAccountType: '',
  transferAgency: '',
  transferAccount: '',
  transferCpfCnpj: '',
  transferBeneficiaryName: '',
  transferUrl: '',
  transferUrls: [],
  transferFilesMeta: [],
};

export interface ValidationErrors {
  [key: string]: string;
}