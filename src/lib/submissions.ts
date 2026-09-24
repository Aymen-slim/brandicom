import { createAdminSupabaseClient } from './supabase/admin';

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone: string;
  budget: string;
  services: string[];
  message: string;
  createdAt: string;
}

export async function fetchContactSubmissions(): Promise<ContactSubmission[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('contact_submissions')
    .select('id, name, email, phone, budget, services, message, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    budget: row.budget,
    services: Array.isArray(row.services) ? row.services : [],
    message: row.message || '',
    createdAt: row.created_at,
  }));
}

export async function deleteContactSubmission(id: string): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from('contact_submissions').delete().eq('id', id);
  if (error) throw error;
}
