import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "@/components/SessionProvider";
import { AuthLoading } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

export default function ResetPassword() {
  const { session, loading, finishRecovery } = useSession();
  const [password, setPassword] = useState(""), [confirm, setConfirm] = useState(""), [email, setEmail] = useState(""), [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  if (loading) return <AuthLoading />;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      if (!session) { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: new URL('/reset-password', window.location.origin).href }); if (error) throw error; setMessage("If the account exists, a recovery email will be sent. Open it in this browser."); }
      else { if (password !== confirm) throw new Error("Passwords do not match."); const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; finishRecovery(); navigate("/", { replace: true }); }
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <div className="mx-auto flex min-h-screen max-w-md items-center px-5"><form onSubmit={submit} className="panel w-full p-7"><h1 className="mb-3 text-xl font-bold">{session ? "Set a new password" : "Reset your password"}</h1><p className="mb-5 text-xs text-muted-foreground">{session ? "Choose a secure password for your account." : "Request a recovery link using your account email."}</p>{session ? <><label className="mb-2 block text-xs" htmlFor="new-password">New password</label><input id="new-password" className="field mb-4" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /><label className="mb-2 block text-xs" htmlFor="confirm-password">Confirm password</label><input id="confirm-password" className="field mb-4" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={e => setConfirm(e.target.value)} /></> : <><label className="mb-2 block text-xs" htmlFor="recovery-email">Email</label><input id="recovery-email" className="field mb-4" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></>}{error && <p role="alert" className="mb-4 text-xs text-destructive">{error}</p>}{message && <p className="mb-4 text-xs text-primary">{message}</p>}<Button className="w-full text-xs" disabled={busy}>{busy ? "Please wait…" : session ? "Update password" : "Send recovery link"}</Button><Link to="/login" className="mt-4 block text-center text-xs text-primary">Return to sign in</Link></form></div>;
}
