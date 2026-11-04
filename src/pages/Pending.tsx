import { Navigate } from "react-router-dom";
import { ShieldCheck, RefreshCw, LogOut } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { Brand } from "@/components/CRMLayout";
import { Button } from "@/components/ui/button";
import { AuthLoading } from "@/components/AuthGuard";
import { errorMessage } from "@/lib/errors";

export default function Pending() {
  const { session, profile, loading, recovery, error, refreshProfile, signOut } = useSession();
  const [busy, setBusy] = useState(false), [localError, setLocalError] = useState("");
  if (loading) return <AuthLoading />;
  if (recovery) return <Navigate to="/reset-password" replace />;
  if (!session) return <Navigate to="/login" replace />;
  if (profile?.status === "approved") return <Navigate to="/" replace />;
  async function action(fn: () => Promise<void>) { setBusy(true); setLocalError(""); try { await fn(); } catch (e) { setLocalError(errorMessage(e)); } finally { setBusy(false); } }
  return <div className="flex min-h-screen items-center justify-center p-5"><div className="w-full max-w-lg"><div className="mb-8 flex justify-center"><Brand /></div><div className="panel p-8"><ShieldCheck className="mb-5 text-primary" size={30} /><h1 className="text-2xl font-bold">{profile?.status === "disabled" ? "Account access disabled" : "Awaiting administrator approval"}</h1><p className="mt-4 text-sm leading-relaxed text-muted-foreground">{profile?.status === "disabled" ? "A Super Admin has disabled this account. Contact your administrator to restore access." : "Your account is signed in, but business data is locked until a Super Admin approves your access."}</p><dl className="my-6 space-y-3 rounded-lg bg-muted p-4 text-xs"><div><dt className="text-muted-foreground">Account</dt><dd className="mt-1 break-all">{session.user.email}</dd></div><div><dt className="text-muted-foreground">User ID</dt><dd className="mt-1 break-all font-mono text-[11px]">{session.user.id}</dd></div></dl><p className="text-[11px] leading-relaxed text-muted-foreground">For the first Super Admin, the project owner must explicitly approve a verified user ID through trusted database administration. Signing up first never grants administrator privileges.</p>{(error || localError) && <p className="mt-4 text-xs text-destructive" role="alert">{localError || error}</p>}<div className="mt-6 flex gap-2"><Button disabled={busy} className="gap-2 text-xs" onClick={() => void action(refreshProfile)}><RefreshCw size={13} />Check approval</Button><Button variant="outline" disabled={busy} className="gap-2 text-xs" onClick={() => void action(signOut)}><LogOut size={13} />Sign out</Button></div></div></div></div>;
}
