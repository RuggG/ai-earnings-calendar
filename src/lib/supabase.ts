import { createClient } from "@supabase/supabase-js";

const projectId = process.env.SUPABASE_PROJECT_ID;
const supabaseUrl = process.env.SUPABASE_URL ?? (projectId ? `https://${projectId}.supabase.co` : undefined);
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL or SUPABASE_PROJECT_ID must be set");
}

if (!serviceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY must be set");
}

export const supabase = createClient(supabaseUrl, serviceRoleKey);
