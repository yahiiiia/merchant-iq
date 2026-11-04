import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { Link, Navigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Brand } from "@/components/CRMLayout";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "@/components/SessionProvider";
import { AuthLoading } from "@/components/AuthGuard";

export default function Login() {
  const { session, profile, loading, recovery, error } = useSession();
  if (loading) return <AuthLoading />;
  if (recovery) return <Navigate to="/reset-password" replace />;
  if (session) return <Navigate to={profile?.status === "approved" ? "/" : "/pending"} replace />;
  return <div className="flex min-h-screen items-center justify-center px-5 py-12"><div className="w-full max-w-[420px]">
    <div className="mb-8 flex justify-center"><Brand /></div>
    <div className="panel p-7"><h1 className="text-2xl font-bold tracking-tight">Welcome to MerchantIQ</h1>
      <p className="mb-6 mt-2 text-xs leading-relaxed text-muted-foreground">Sign in to your business workspace. New accounts require Super Admin approval before accessing CRM records.</p>
      {error && <p role="alert" className="mb-3 text-xs text-destructive">{error}</p>}
      <Auth supabaseClient={supabase} providers={[]} redirectTo={new URL('/auth/callback', window.location.origin).href} appearance={{
        theme: ThemeSupa,
        variables: { default: {
          colors: {
            brand: 'hsl(var(--primary))', brandAccent: 'hsl(var(--primary))', brandButtonText: 'hsl(var(--primary-foreground))',
            inputText: 'hsl(var(--foreground))', inputBackground: 'hsl(var(--card))', inputLabelText: 'hsl(var(--muted-foreground))',
            inputBorder: 'hsl(var(--input))', defaultButtonBackground: 'hsl(var(--card))', defaultButtonText: 'hsl(var(--foreground))',
            anchorTextColor: 'hsl(var(--primary))', messageText: 'hsl(var(--foreground))', messageTextDanger: 'hsl(var(--destructive))',
          },
          radii: { borderRadiusButton: '8px', inputBorderRadius: '8px' },
          fontSizes: { baseBodySize: '13px', baseInputSize: '13px', baseLabelSize: '12px', baseButtonSize: '13px' },
        } },
        className: { container: 'rounded-lg', button: 'font-medium' },
      }} theme="default" />
      <Link className="mt-4 block text-center text-[11px] text-primary" to="/reset-password">Password recovery</Link>
      <div className="mt-5 flex items-start gap-2 border-t pt-4 text-[11px] leading-relaxed text-muted-foreground"><ShieldCheck size={15} className="shrink-0 text-primary" />Registration does not grant access or allow you to choose an administrator role.</div>
    </div>
  </div></div>;
}
