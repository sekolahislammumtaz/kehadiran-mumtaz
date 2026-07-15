import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });
} else {
  console.warn("Supabase URL or Key is missing. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

export { supabase };

// Helper to check if DB is configured
export function isDbConfigured() {
  return supabase !== null;
}
