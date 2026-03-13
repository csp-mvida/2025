import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no projeto.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function fetchDepartments() {
  const { data, error } = await supabase
    .from('departments')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) {
    console.error('Erro ao buscar departamentos:', error);
    return [];
  }

  return data ?? [];
}

export async function fetchAuthorizers() {
  const { data, error } = await supabase
    .from('authorizers')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) {
    console.error('Erro ao buscar autorizadores:', error);
    return [];
  }

  return data ?? [];
}

export async function fetchPaymentAccounts() {
  const { data, error } = await supabase
    .from('payment_accounts')
    .select('id, label')
    .order('label', { ascending: true });

  if (error) {
    console.error('Erro ao buscar contas de pagamento:', error);
    return [];
  }

  return data ?? [];
}

export async function createDraftRequest(
  deptId: string,
  authId: string,
  accountId: string
) {
  const userResult = await supabase.auth.getUser();
  const user = userResult.data.user;

  if (!user) {
    console.error('Usuário não autenticado para criar rascunho.');
    return null;
  }

  const protocol = crypto.randomUUID();

  const { error } = await supabase.from('payment_requests').insert({
    id: protocol,
    requester_id: user.id,
    title: 'Rascunho CSP',
    description: 'Rascunho em andamento',
    amount: 1,
    status: 'pending'
  });

  if (error) {
    console.error('Erro ao criar rascunho:', error);
    return null;
  }

  return protocol;
}

export async function uploadInvoice(
  file: File,
  type: 'invoice' | 'boleto' | 'transfer',
  draftId: string
) {
  const folderMap = {
    invoice: 'notas_fiscais',
    boleto: 'boletos',
    transfer: 'transferencias'
  };

  const filePath = `${folderMap[type]}/${draftId}/${crypto.randomUUID()}-${file.name}`;

  const { data, error } = await supabase.storage
    .from('uploads')
    .upload(filePath, file);

  if (error) {
    throw new Error(error.message);
  }

  const { data: publicUrlData } = supabase.storage
    .from('uploads')
    .getPublicUrl(data.path);

  return publicUrlData.publicUrl;
}

export async function submitRequest(
  finalFormData: any,
  protocolId: string,
  selectedAuthorizerId: string,
  selectedAccountId: string,
  isUrgent: boolean
) {
  const amountNumber = Number(finalFormData.value || 0) / 100;

  const payload = {
    title: finalFormData.supplierName || 'Solicitação CSP',
    description: finalFormData.description || '',
    amount: amountNumber > 0 ? amountNumber : 1,
    due_date: finalFormData.dueDate ? finalFormData.dueDate.split('T')[0] : null,
    beneficiary_name: finalFormData.supplierName || null,
    payment_method: finalFormData.payment_method || null,
    admin_notes: JSON.stringify({
      requesterName: finalFormData.requesterName ?? '',
      whatsapp: finalFormData.whatsapp ?? '',
      departmentId: finalFormData.departmentId ?? '',
      authorizerId: selectedAuthorizerId ?? '',
      paymentAccountId: selectedAccountId ?? '',
      isSpecificBudget: finalFormData.isSpecificBudget ?? '',
      specificBudgetName: finalFormData.specificBudgetName ?? '',
      pixKeyType: finalFormData.pixKeyType ?? '',
      pixKey: finalFormData.pixKey ?? '',
      transferBankName: finalFormData.transferBankName ?? '',
      transferAccountType: finalFormData.transferAccountType ?? '',
      transferAgency: finalFormData.transferAgency ?? '',
      transferAccount: finalFormData.transferAccount ?? '',
      transferCpfCnpj: finalFormData.transferCpfCnpj ?? '',
      transferBeneficiaryName: finalFormData.transferBeneficiaryName ?? '',
      invoiceUrl: finalFormData.invoiceUrl ?? '',
      boletoUrl: finalFormData.boletoUrl ?? '',
      transferUrl: finalFormData.transferUrl ?? '',
      hasInvoice: finalFormData.hasInvoice ?? '',
      invoiceSentViaWhatsapp: finalFormData.invoiceSentViaWhatsapp ?? false,
      termsAccepted: finalFormData.termsAccepted ?? false,
      isUrgent
    })
  };

  const { error } = await supabase
    .from('payment_requests')
    .update(payload)
    .eq('id', protocolId);

  if (error) {
    console.error('Erro ao concluir solicitação:', error);
    return false;
  }

  return true;
}

export async function getRequestByProtocol(protocolId: string) {
  const { data, error } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('id', protocolId)
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar protocolo:', error);
    return null;
  }

  return data;
}

export async function createRequester(name: string, email: string) {
  // Nota: A criação de usuários no Supabase Auth via client-side é limitada.
  // Esta função prepara a lógica para inserção em uma tabela de perfis ou chamada futura.
  const { data, error } = await supabase
    .from('profiles')
    .insert([{ full_name: name, email, role: 'requester' }]);

  if (error) {
    console.error('Erro ao cadastrar requisitante:', error);
    return { success: false, error };
  }

  return { success: true, data };
}