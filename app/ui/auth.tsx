"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { publicSupabase } from "@/lib/supabase";

const AuthContext = createContext<{ session: Session | null; role: string | null; loading: boolean }>({ session: null, role: null, loading: true });
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => publicSupabase(), []);
  const [session, setSession] = useState<Session | null>(null); const [role, setRole] = useState<string | null>(null); const [roleUserId, setRoleUserId] = useState<string | null>(null); const [authReady, setAuthReady] = useState(!supabase);
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setAuthReady(true); });
    return () => subscription.unsubscribe();
  }, [supabase]);
  useEffect(() => {
    let active = true;
    if (!supabase || !session) return;
    void supabase.from("profiles").select("role").eq("id", session.user.id).single().then(({ data }) => { if (active) { setRole(data?.role ?? null); setRoleUserId(session.user.id); } });
    return () => { active = false; };
  }, [session, supabase]);
  const loading = !authReady || (!!session && roleUserId !== session.user.id);
  return <AuthContext.Provider value={{ session, role: roleUserId === session?.user.id ? role : null, loading }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
