import { supabase as sharedClient } from '../integrations/supabase/client';

export const supabase = sharedClient;

export async function fetchDepartments() {
  const { data, error } = await supabase.from('departments').select('id, name').order('name', { ascending: true });
  return error ? [] : data ?? [];
}

export async function fetchAuthorizers() {
  const { data, error } = await supabase.from('authorizers').select('id, name').order('name', { ascending: true });
  return error ? [] : data ?? [];
}

export async function fetchPaymentAccounts() {
  const { data, error } = await supabase.from('payment_accounts').select('id, label').order('label', { ascending: true });
  return error ? [] : data ?? [];
}

export async function createDraftRequest(deptId: string, authId: string, accountId: string) {
  const userResult = await supabase.auth.getUser();
  const user = userResult.data.user;
  if (!user) return null;
  const protocol = crypto.randomUUID();
  const { error } = await supabase.from('payment_requests').insert({
    id: protocol, requester_id: user.id, title: 'Rascunho CSP', description: 'Rascunho em andamento', amount: 1, status: 'pending'
  });
  return error ? null : protocol;
}

export async function uploadInvoice(file: File, type: 'invoice' | 'boleto' | 'transfer', draftId: string) {
  const folderMap = { invoice: 'notas_fiscais', boleto: 'boletos', transfer: 'transferencias' };
  const filePath = `${folderMap[type]}/${draftId}/${crypto.randomUUID()}-${file.name}`;
  const { data, error } = await supabase.storage.from('uploads').upload(filePath, file);
  if (error) throw new Error(error.message);
  return supabase.storage.from('uploads').getPublicUrl(data.path).data.publicUrl;
}

export async function submitRequest(finalFormData: any, protocolId: string, selectedAuthorizerId: string, selectedAccountId: string, isUrgent: boolean) {
  const amountNumber = Number(finalFormData.value || 0) / 100;
  const payload = {
    title: finalFormData.supplierName || 'Solicitação CSP',
    description: finalFormData.description || '',
    amount: amountNumber > 0 ? amountNumber : 1,
    due_date: finalFormData.dueDate ? finalFormData.dueDate.split('T')[0] : null,
    beneficiary_name: finalFormData.supplierName || null,
    payment_method: finalFormData.payment_method || null,
    admin_notes: JSON.stringify({ ...finalFormData, authorizerId: selectedAuthorizerId, paymentAccountId: selectedAccountId, isUrgent })
  };
  const { error } = await supabase.from('payment_requests').update(payload).eq('id', protocolId);
  return !error;
}

export async function getRequestByProtocol(protocolId: string) {
  const { data, error } = await supabase.from('payment_requests').select('*').eq('id', protocolId).maybeSingle();
  return error ? null : data;
}

/**
 * Cadastra um novo requisitante via Edge Function
 */
export async function createRequester(name: string, email: string) {
  const payload = { 
    full_name: name, 
    email: email 
  };
  
  console.log('[api/createRequester] Payload enviado:', payload);

  try {
    const { data, error } = await supabase.functions.invoke('create-requester', {
      body: payload
    });

    if (error) {
      console.error('[api/createRequester] Invoke Error:', error);
      
      let friendlyMessage = 'Falha no processamento pelo servidor.';
      
      // Tenta extrair a mensagem JSON do corpo do erro
      try {
        // Se o Supabase retorna um erro 4xx/5xx, ele anexa o body na mensagem
        const jsonMatch = error.message.match(/\{.*\}/);
        if (jsonMatch) {
          const errorData = JSON.parse(jsonMatch[0]);
          friendlyMessage = errorData.error || errorData.message || friendlyMessage;
        } else {
          friendlyMessage = error.message;
        }
      } catch (e) {
        friendlyMessage = error.message;
      }

      return { success: false, error: { message: friendlyMessage } };
    }

    return { success: true, data };

  } catch (err: any) {
    console.error('[api/createRequester] Exception:', err);
    return { success: false, error: { message: 'Erro de conexão ou tempo de resposta excedido.' } };
  }
}