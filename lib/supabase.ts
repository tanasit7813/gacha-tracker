import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://mbarllrkgkqiqfrknbom.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iYXJsbHJrZ2txaXFmcmtuYm9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDUzODMsImV4cCI6MjEwMDQ4MTM4M30.x6eXZZTDfwU9quhXJ8VwWMFGyQ2ZzGTwZAgO1Iran0M";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
