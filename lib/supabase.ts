import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const categories = ["Computer", "Projector", "Fan", "Light", "Wi-Fi"] as const;
export const statuses = ["Pending", "In Progress", "Resolved"] as const;
export type ComplaintStatus = (typeof statuses)[number];
export type ComplaintCategory = (typeof categories)[number];

export function publicSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? createClient(url, key) : null;
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
