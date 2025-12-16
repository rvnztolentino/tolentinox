import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!,
  {
    auth: {
      // Persist session in localStorage so auth survives refresh/close
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,

      /* Use in-memory storage - session will not persist after closing browser/tab
      storage: undefined,
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false, */
    },
  }
);

export default supabase;
