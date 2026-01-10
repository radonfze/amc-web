import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create a client that might be null/empty if keys are missing during build time
// This prevents "npm run build" from crashing on Vercel if the env var isn't set yet.
export const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey) 
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : (() => {
      // Return a proxy or throw only when accessed? 
      // Safest is to return a dummy that throws on any method call,
      // OR keeps the export but runtime usage will fail if check is inside route.
      // Let's just return 'any' casted null or similar, but Route expects a client.
      
      // Better: Return a safe client using Anon key if Service Role is missing? 
      // No, that hides the security issue later.
      
      // Best: Allow it to be undefined here, handle undefined in Route?
      // Or just warn and return null.
      if (typeof window === 'undefined') {
          console.warn("WARNING: SUPABASE_SERVICE_ROLE_KEY is missing. Admin client is not functional.");
      }
      return null as any;
  })();
