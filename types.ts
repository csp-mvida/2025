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
  pixKey?: string;
  
  // Boleto fields
  boletoUrl?: string; 
  boletoUrls?: string[];
  boletoFilesMeta?: FileMeta[];

  // Transferência fields
  transferBankName?: string;
  transferAccountType?: 'Corrente' | 'Poupança' | '';
  transferAgency?: string;
  transferAccount?: string;
  transferCpfCnpj?: string;
  transferBeneficiaryName?: string;
  transferUrl?: string; 
  transferUrls?: string[];
  transferFilesMeta?: FileMeta[];

  // Step 3: Proof
  hasInvoice: 'yes' | 'no';
  invoiceUrl?: string; 
  invoiceUrls?: string[];
  invoiceFilesMeta?: FileMeta[];
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
  // Audit Fields
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  paidAt?: string;
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
};