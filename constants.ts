export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const CSP_ENDPOINT_URL = "/api/csp";

export const AUTHORIZERS = [
  "Henrique dos Anjos (Presidente)",
  "Douglas Moreira (Coord. Executivo)",
  "Paula Siqueira (Coord. Administrativo)",
  "Revalino Galvão (Coord. de RH e Contabilidade)",
  "Saulo Júnior (Coord. Financeiro)",
  "Ivanete Costa (Secretária da Presidência)",
];

export const PAYMENT_ACCOUNTS = [
  "Conta Principal (Itaú)",
  "Conta Secundária (Bradesco)",
  "Caixinha",
  "Cartão Corporativo",
];

export const DEPARTMENTS_FALLBACK = [
  { id: '1', name: 'Administrativo', active: true },
  { id: '2', name: 'Comercial', active: true },
  { id: '3', name: 'Financeiro', active: true },
  { id: '4', name: 'Marketing', active: true },
  { id: '5', name: 'Operações', active: true },
  { id: '6', name: 'TI / Desenvolvimento', active: true },
];

export const SPECIFIC_BUDGET_OPTIONS = [
  "Casa do Profeta",
  "Convênio Triagem",
  "Convênio CEV",
  "Fazenda",
  "Granja",
  "Veículos",
  "Verba Pr. Douglas",
  "Verba Pr. João",
  "Outros"
];

export const URGENCY_THRESHOLD_HOURS = 2;