import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigError = !supabaseUrl || !supabaseAnonKey
  ? 'ไม่พบ VITE_SUPABASE_URL หรือ VITE_SUPABASE_ANON_KEY กรุณาตั้งค่า Environment Variables ใน Vercel แล้ว Redeploy'
  : null;

export const supabase = supabaseConfigError
  ? null
  : createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );