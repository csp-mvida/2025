import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = 'https://your-supabase-url.supabase.co';
const supabaseKey = 'your-supabase-key';
const supabase = createClient(supabaseUrl, supabaseKey);

export const uploadFilesToSupabase = async ({ invoiceFiles, boletoFiles, transferFiles, draftId }) => {
  const invoicePaths: string[] = [];
  const boletoPaths: string[] = [];
  const transferPaths: string[] = [];

  const uploadFile = async (file: File, folder: string) => {
    const { data, error } = await supabase.storage.from('uploads').upload(`${folder}/${uuidv4()}-${file.name}`, file);
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

  // Save paths to the database
  const { error } = await supabase.from('payment_requests').update({
    invoice_attachment_path: JSON.stringify(invoicePaths),
    boleto_attachment_path: JSON.stringify(boletoPaths),
    transfer_attachment_path: JSON.stringify(transferPaths),
  }).eq('id', draftId);

  if (error) {
    throw new Error(error.message);
  }

  return { invoicePaths, boletoPaths, transferPaths };
};