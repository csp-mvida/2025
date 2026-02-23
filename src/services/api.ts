import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://your-supabase-url.supabase.co';
const supabaseKey = 'your-supabase-key';
const supabase = createClient(supabaseUrl, supabaseKey);

export const uploadFileToSupabase = async (file: File, type: 'boleto' | 'invoice' | 'transfer') => {
  const { data, error } = await supabase.storage.from('uploads').upload(`${type}/${file.name}`, file);
  if (error) {
    throw new Error(error.message);
  }
  return { path: data.path };
};