import { supabase } from '../integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

export const uploadFilesToSupabase = async ({ invoiceFiles, boletoFiles, transferFiles, draftId }) => {
  const invoicePaths: string[] = [];
  const boletoPaths: string[] = [];
  const transferPaths: string[] = [];

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const uploadFile = async (file: File, folder: string) => {
    // Sanitização básica do nome do arquivo original
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const path = `${folder}/${yearMonth}/${draftId}/${uuidv4()}-${sanitizedName}`;
    
    const { data, error } = await supabase.storage.from('uploads').upload(path, file);
    if (error) {
      throw new Error(error.message);
    }
    return data.path;
  };

  for (const file of invoiceFiles) {
    const path = await uploadFile(file, 'notas_fiscais');
    invoicePaths.push(path);
  }

  for (const file of boletoFiles) {
    const path = await uploadFile(file, 'boletos');
    boletoPaths.push(path);
  }

  for (const file of transferFiles) {
    const path = await uploadFile(file, 'transferencias');
    transferPaths.push(path);
  }

  // Save paths to the database (Assuming draftId is the protocol)
  const { error } = await supabase.from('payment_requests').update({
    invoice_attachment_path: JSON.stringify(invoicePaths),
    boleto_attachment_path: JSON.stringify(boletoPaths),
    transfer_attachment_path: JSON.stringify(transferPaths),
  }).eq('protocol', draftId);

  if (error) {
    throw new Error(error.message);
  }

  return { invoicePaths, boletoPaths, transferPaths };
};