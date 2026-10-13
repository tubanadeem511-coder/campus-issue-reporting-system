import "server-only";
import { createClient } from "@supabase/supabase-js";

export async function authenticatedUser(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { ok: false as const, status: 503, error: "CampusFix needs Supabase configuration. Set the public URL and publishable key, then restart the server." };
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false as const, status: 401, error: "Sign in to continue." };
  const client = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { ok: false as const, status: 401, error: "Your session has expired. Sign in again." };
  const { data: profile, error: profileError } = await client.from("profiles").select("role,full_name").eq("id", data.user.id).single();
  if (profileError || !profile) return { ok: false as const, status: 403, error: "Your CampusFix profile is unavailable." };
  return { ok: true as const, client, user: data.user, profile };
}

export async function requireAdmin(request: Request) {
  const auth = await authenticatedUser(request);
  if (!auth.ok) return auth;
  if (auth.profile.role !== "admin") return { ok: false as const, status: 403, error: "Administrator access is required." };
  return auth;
}
