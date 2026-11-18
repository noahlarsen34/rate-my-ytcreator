import { supabase } from './supabase';

export async function recordUserSearch(searchTerm) {
  const search = String(searchTerm || '').trim().replace(/\s+/g, ' ').slice(0, 200);
  if (!supabase || search.length < 2) return;

  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session?.user) return;

  const { error } = await supabase.rpc('record_user_search', { p_search: search });
  if (error) console.error('Search history could not be saved:', error.message);
}
