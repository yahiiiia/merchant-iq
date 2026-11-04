import { Link, Navigate } from "react-router-dom";
import { useSession } from "@/components/SessionProvider";
import { AuthLoading } from "@/components/AuthGuard";

export default function AuthCallback() {
  const { loading, recovery, session, profile, error } = useSession();
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const callbackError = params.get("error_description") || hash.get("error_description");
  if (callbackError || error) return <div className="mx-auto max-w-lg p-10"><h1 className="text-xl font-bold">Unable to complete authentication</h1><p className="my-4 text-sm text-destructive">{callbackError || error}</p><Link to="/login" className="text-primary">Return to sign in</Link></div>;
  if (loading) return <AuthLoading />;
  if (recovery) return <Navigate to="/reset-password" replace />;
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={profile?.status === "approved" ? "/" : "/pending"} replace />;
}
