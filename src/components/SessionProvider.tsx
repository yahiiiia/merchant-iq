import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { errorMessage } from "@/lib/errors";
import { OFFLINE_PREVIEW } from "@/lib/offline-preview";

export type Profile = { id: string; name: string; email: string; role: "super_admin" | "business_user"; status: "pending" | "approved" | "disabled"; approvedAt?: string };
type SessionContext = { session: Session | null; profile: Profile | null; loading: boolean; error: string; recovery: boolean; isAdmin: boolean; refreshProfile: () => Promise<void>; signOut: () => Promise<void>; finishRecovery: () => void };
const Context = createContext<SessionContext | null>(null);

export function SessionContextProvider({ children }: { children: ReactNode }) {
  if (OFFLINE_PREVIEW) return <Context.Provider value={{
    session: null, profile: null, loading: false, error: "", recovery: false, isAdmin: false,
    refreshProfile: async () => {},
    signOut: async () => { throw new Error("Account operations are disabled in offline preview."); },
    finishRecovery: () => {},
  }}>{children}</Context.Provider>;
  return <ConnectedSessionProvider>{children}</ConnectedSessionProvider>;
}

function ConnectedSessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState(false);
  const userId = session?.user.id;

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setInitializing(false);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") { setProfile(null); setError(""); setRecovery(false); queryClient.clear(); }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setError(errorMessage(error));
      setSession(data.session); setInitializing(false);
    }).catch(e => { setError(errorMessage(e)); setInitializing(false); });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error) { setProfile(null); setError(errorMessage(error)); }
    else { setProfile(data as Profile); setError(""); }
  }, [userId]);

  useEffect(() => {
    let active = true;
    setProfile(null);
    if (!userId) { setProfileLoading(false); return; }
    setProfileLoading(true);
    async function load() {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (!active) return;
      setProfile(error ? null : data as Profile); setError(error ? errorMessage(error) : ""); setProfileLoading(false);
    }
    void load();
    const interval = window.setInterval(() => void load(), 30000);
    const focus = () => void load();
    window.addEventListener("focus", focus);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("focus", focus); };
  }, [userId]);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) { setError(errorMessage(error)); throw error; }
    setProfile(null); setError(""); setRecovery(false);
  }
  return <Context.Provider value={{ session, profile, loading: initializing || profileLoading || (!!session && !profile && !error), error, recovery, isAdmin: profile?.status === "approved" && profile.role === "super_admin", refreshProfile, signOut, finishRecovery: () => setRecovery(false) }}>{children}</Context.Provider>;
}
export function useSession() { const value = useContext(Context); if (!value) throw new Error("SessionContextProvider required"); return value; }
