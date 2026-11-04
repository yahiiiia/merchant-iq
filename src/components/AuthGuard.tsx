import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "@/components/SessionProvider";
import { Button } from "@/components/ui/button";
import { OFFLINE_PREVIEW } from "@/lib/offline-preview";

export function AuthLoading() { return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground" role="status">Loading your workspace…</div>; }
export default function AuthGuard({ adminOnly = false }: { adminOnly?: boolean }) {
  const { loading, session, profile, error, recovery, refreshProfile, isAdmin } = useSession();
  if (OFFLINE_PREVIEW) return <Outlet />;
  if (loading) return <AuthLoading />;
  if (recovery) return <Navigate to="/reset-password" replace />;
  if (!session) return <Navigate to="/login" replace />;
  if (error || !profile || profile.id !== session.user.id) return <div className="mx-auto max-w-lg p-8"><h1 className="mb-3 text-xl font-bold">Could not verify account access</h1><p className="mb-4 text-sm text-destructive">{error || "Your account profile could not be loaded."}</p><Button onClick={() => void refreshProfile()}>Retry verification</Button></div>;
  if (profile.status !== "approved") return <Navigate to="/pending" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}
