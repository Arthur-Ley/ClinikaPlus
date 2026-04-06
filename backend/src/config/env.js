import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../../.env");

dotenv.config({ path: envPath });

export const env = {
  port: Number(process.env.PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  supabaseUrl: process.env.SUPABASE_URL || process.env.supabase_url || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.supabase_anon_key || "",
  supabaseServiceRoleKey:
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabase_service_role_key || "",
};
