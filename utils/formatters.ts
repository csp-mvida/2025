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