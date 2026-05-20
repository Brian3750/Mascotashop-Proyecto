import { createClient } from '@supabase/supabase-js';

export function getSupabaseServer() {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = rawUrl?.trim();
  const serviceRoleKey = rawKey?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in environment');
  }

  // Debug logging (masked) para verificar que la clave está presente en entorno local
  try {
    const masked = '[hidden]';
    console.log(`🔐 getSupabaseServer: supabaseUrl=${supabaseUrl}, serviceRoleKeyPresent=${serviceRoleKey ? 'yes' : 'no'}, serviceRoleKeyLen=${serviceRoleKey?.length || 0}`);
  } catch (e) {}

  return createClient(supabaseUrl, serviceRoleKey);
}