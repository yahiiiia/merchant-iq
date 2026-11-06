import { useState } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Store, ContactRound, Layers, Server, ShieldCheck, Menu, Moon, Sun, X, LogOut, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useDashboard } from "@/lib/crm";
import { useSession } from "@/components/SessionProvider";
import { errorMessage } from "@/lib/errors";
import { toast } from "sonner";
import { OFFLINE_PREVIEW } from "@/lib/offline-preview";
import OfflinePreviewBanner from "@/components/OfflinePreviewBanner";

const nav = [{ to: "/", label: "Overview", icon: LayoutDashboard }, { to: "/merchants", label: "Merchants", icon: Store }, { to: "/contacts", label: "Contacts", icon: ContactRound }, { to: "/leads", label: "Lead Explorer", icon: Layers }];
const adminNav = [{ to: "/scraper", label: "Scraper Control", icon: ScanSearch }, { to: "/vps", label: "VPS Control", icon: Server }, { to: "/access", label: "Access", icon: ShieldCheck }];
export function Brand() {
  return <span className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-primary text-primary-foreground"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 17V7l8 7 8-7v10M4 7h4v3m12-3h-4v3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span className="brand text-[20px] font-extrabold tracking-[-0.8px]">Merchant<span className="text-primary">IQ</span></span></span>;
}
export default function CRMLayout() {
  const [open, setOpen] = useState(false), [signingOut, setSigningOut] = useState(false);
  const { theme, setTheme } = useTheme();
  const { data: counts } = useDashboard();
  const { profile, isAdmin, signOut } = useSession();
  const showAdminScreens = OFFLINE_PREVIEW || isAdmin;
  const identity = OFFLINE_PREVIEW ? "Local test workspace" : profile?.name || profile?.email || "";
  const roleLabel = OFFLINE_PREVIEW ? "Offline preview" : isAdmin ? "Super Admin" : "Business User";
  const { pathname } = useLocation();
  const current = [...nav, ...adminNav].find(n => n.to === "/" ? pathname === "/" : pathname.startsWith(n.to));
  async function logout() { setSigningOut(true); try { await signOut(); } catch (e) { toast.error(errorMessage(e)); } finally { setSigningOut(false); } }
  return <div className="min-h-screen">
    {open && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" onClick={() => setOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[232px] flex-col border-r bg-card transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex h-[78px] items-center justify-between px-6"><Link to="/" onClick={() => setOpen(false)}><Brand /></Link><button className="lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)}><X size={18} /></button></div>
      <div className="mx-4 mb-7 flex items-center gap-2.5 rounded-lg border p-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-[12px] font-bold">M</div><div><div className="text-[12px] font-semibold">{OFFLINE_PREVIEW ? "Fictional test workspace" : "Merchant workspace"}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{OFFLINE_PREVIEW ? "Local memory · no sync" : "Canadian business directory"}</div></div></div>
      <div className="px-6 pb-3 eyebrow">Workspace</div>
      <nav className="space-y-1 px-3">{nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${isActive ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icon size={17} strokeWidth={1.7} />{label}{to !== "/" && counts && <span className="ml-auto rounded bg-background/80 px-1.5 py-0.5 text-[10px] tabular-nums">{to === "/merchants" ? counts.merchants : to === "/contacts" ? counts.contacts : counts.leads}</span>}</NavLink>)}</nav>
      {showAdminScreens && <><div className="mx-6 mb-4 mt-7 border-t" /><div className="px-6 pb-3 eyebrow">{OFFLINE_PREVIEW ? "Read-only admin preview" : "Administration"}</div><nav className="space-y-1 px-3">{adminNav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium ${isActive ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted"}`}><Icon size={17} strokeWidth={1.7} />{label}{["/vps", "/scraper"].includes(to) && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />}</NavLink>)}</nav></>}
      <div className="mt-auto p-4"><div className="rounded-xl border border-dashed bg-background p-3.5"><div className="mb-2 flex items-center gap-2 text-[12px] font-semibold"><ShieldCheck size={14} className="text-primary" />{OFFLINE_PREVIEW ? "Development only" : "Business workspace"}</div><p className="text-[11px] leading-relaxed text-muted-foreground">{OFFLINE_PREVIEW ? "No signed-in account. Fictional local records only; production access is unchanged." : "Your account is approved. Record access is checked by the database."}</p></div></div>
      <div className="flex items-center gap-3 border-t px-5 py-4"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-primary">{(identity || "U").slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="truncate text-[12px] font-semibold">{identity}</div><div className="text-[10px] text-muted-foreground">{roleLabel}</div></div>{!OFFLINE_PREVIEW && <Button disabled={signingOut} variant="ghost" size="icon" aria-label="Sign out" className="h-7 w-7 shrink-0 text-muted-foreground" onClick={() => void logout()}><LogOut size={14} /></Button>}</div>
    </aside>
    <div className="lg:pl-[232px]">
      <header className="flex h-[65px] items-center justify-between border-b bg-card px-5 md:px-8"><div className="flex items-center gap-3"><button className="lg:hidden" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu size={20} /></button><span className="hidden text-[12px] text-muted-foreground sm:inline">Workspace</span><span className="hidden text-muted-foreground/40 sm:inline">/</span><span className="text-[12px] font-medium">{current?.label || "Record details"}</span></div><div className="flex items-center gap-4"><span className="rounded-full border px-2.5 py-1 text-[10px] font-medium text-muted-foreground">{roleLabel}</span><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground" aria-label={theme === "dark" ? "Use light mode" : "Use dark mode"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</Button><span className="hidden border-l pl-4 text-[11px] text-muted-foreground sm:inline">Canada 🇨🇦</span></div></header>
      {OFFLINE_PREVIEW && <OfflinePreviewBanner />}
      <main className="mx-auto max-w-[1600px] p-5 md:p-8"><Outlet /></main>
      <footer className="mx-5 flex flex-wrap justify-between gap-2 border-t py-5 text-[10px] text-muted-foreground md:mx-8"><span>MerchantIQ <span className="mx-1.5 text-border">/</span> Your business, better connected.</span>{showAdminScreens && <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />VPS not connected</span>}</footer>
    </div>
  </div>;
}
