export const formatCurrency = (value: string | number) => {
  if (!value) return 'R$ 0,00';
  const numberValue = typeof value === 'string' 
    ? parseFloat(value.replace(/[^0-9]/g, '')) / 100 
    : value;
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numberValue);
};

export const parseCurrency = (value: string): string => {
  return value.replace(/[^0-9]/g, '');
};

export const formatPhone = (value: string) => {
  const clean = value.replace(/\D/g, '');
  if (clean.length > 11) return clean.slice(0, 11);
  if (clean.length > 6) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  if (clean.length > 2) return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
  return clean;
};

export const isValidPhone = (value: string): boolean => {
  const clean = value.replace(/\D/g, '');
  // Accepts 10 (Landline) or 11 (Mobile) digits
  return clean.length >= 10 && clean.length <= 11;
};

export const checkUrgency = (dateString: string): boolean => {
  if (!dateString) return false;
  const due = new Date(dateString);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  // Urgent if strictly less than 2 hours or in the past
  return diffHours < 2;
};

// NEW: CPF/CNPJ formatting and validation
export const formatCpfCnpj = (value: string) => {
  const clean = value.replace(/\D/g, '');
  if (clean.length <= 11) {
    // CPF: 000.000.000-00
    if (clean.length > 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
    if (clean.length > 6) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
    if (clean.length > 3) return `${clean.slice(0, 3)}.${clean.slice(3)}`;
    return clean;
  } else {
    // CNPJ: 00.000.000/0000-00
    if (clean.length > 12) return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12, 14)}`;
    if (clean.length > 8) return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8)}`;
    if (clean.length > 5) return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5)}`;
    if (clean.length > 2) return `${clean.slice(0, 2)}.${clean.slice(2)}`;
    return clean;
  }
};

export const isValidCpfCnpj = (value: string): boolean => {
  const clean = value.replace(/\D/g, '');
  // Basic length check for CPF (11) or CNPJ (14)
  return clean.length === 11 || clean.length === 14;
};

export const isValidAccountOrAgency = (value: string): boolean => {
    const clean = value.trim();
    // Allows numbers and optional hyphen/digit (e.g., 1234-5)
    return clean.length > 0 && /^[0-9-]+$/.test(clean);
};