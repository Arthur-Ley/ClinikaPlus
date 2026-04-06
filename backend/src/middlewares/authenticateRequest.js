import { supabase } from "../lib/supabase.js";
import { supabaseAuth } from "../lib/supabaseAuth.js";

function getUserMetadata(user) {
  if (user?.user_metadata && typeof user.user_metadata === "object") {
    return user.user_metadata;
  }

  if (user?.raw_user_meta_data && typeof user.raw_user_meta_data === "object") {
    return user.raw_user_meta_data;
  }

  return {};
}

async function loadProfile(userId) {
  const { data } = await supabase
    .schema("subsystem3")
    .from("tbl_users")
    .select("first_name, last_name, email, role")
    .eq("user_id", userId)
    .maybeSingle();

  return data;
}

export async function authenticateRequest(req, res, next) {
  const authorizationHeader = req.headers.authorization || "";
  const token = authorizationHeader.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : "";

  res.set("Cache-Control", "no-store");

  if (!token) {
    return res.status(401).json({ error: "Missing access token." });
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user?.id) {
    return res.status(401).json({ error: error?.message || "Invalid session." });
  }

  const metadata = getUserMetadata(data.user);
  const profile = await loadProfile(data.user.id);

  req.user = {
    id: data.user.id,
    email: profile?.email || data.user.email || null,
    firstName:
      (typeof profile?.first_name === "string" && profile.first_name.trim()) ||
      (typeof metadata.first_name === "string" && metadata.first_name.trim()) ||
      "",
    lastName:
      (typeof profile?.last_name === "string" && profile.last_name.trim()) ||
      (typeof metadata.last_name === "string" && metadata.last_name.trim()) ||
      "",
    role:
      (typeof profile?.role === "string" && profile.role.trim()) ||
      "pharmacist",
  };

  return next();
}
