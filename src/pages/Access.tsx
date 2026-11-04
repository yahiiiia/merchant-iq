import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useSession, type Profile } from "@/components/SessionProvider";
import { PageHeading, Pagination, SearchInput, StatusBadge } from "@/components/CRMShared";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { toast } from "sonner";

function UserRow({ user, onSaved }: { user: Profile; onSaved: () => Promise<void> }) {
  const [role, setRole] = useState(user.role), [status, setStatus] = useState(user.status), [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("crm_manage_user", { target_id: user.id, new_role: role, new_status: status });
      if (error) throw error;
      toast.success("Account permissions updated"); await onSaved();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }
  return <tr><td className="table-cell"><span className="block font-semibold">{user.name || user.email}</span><span className="mt-1 block text-[10px] text-muted-foreground">{user.email}</span><span className="mt-1 block font-mono text-[9px] text-muted-foreground">{user.id}</span></td><td className="table-cell"><select aria-label={`Role for ${user.email}`} className="field h-9 text-xs" value={role} onChange={e => setRole(e.target.value as Profile['role'])} disabled={busy}><option value="business_user">Business User</option><option value="super_admin">Super Admin</option></select></td><td className="table-cell"><select aria-label={`Account status for ${user.email}`} className="field h-9 text-xs" value={status} onChange={e => setStatus(e.target.value as Profile['status'])} disabled={busy}><option value="pending">Pending</option><option value="approved">Approved</option><option value="disabled">Disabled</option></select></td><td className="table-cell"><StatusBadge value={user.status} /></td><td className="table-cell text-right"><Button className="h-8 text-[11px]" disabled={busy || (role === user.role && status === user.status)} onClick={() => void save()}>{busy ? "Saving…" : "Save changes"}</Button></td></tr>;
}
export default function Access() {
  const { refreshProfile } = useSession();
  const [users, setUsers] = useState<Profile[]>([]), [total, setTotal] = useState(0), [page, setPage] = useState(1), [search, setSearch] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    let query = supabase.from("profiles").select("*", { count: "exact" }).order("createdAt", { ascending: false }).order("id").range((page - 1) * 25, page * 25 - 1);
    if (search.trim()) query = query.ilike("email", `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`);
    const { data, count, error } = await query;
    if (error) { setUsers([]); setError(errorMessage(error)); }
    else { setUsers(data as Profile[]); setTotal(count || 0); }
    setLoading(false);
  }, [page, search]);
  useEffect(() => { void load(); }, [load]);
  return <><PageHeading eyebrow="Administration" title="Access management" description="Approve registrations and manage the two application roles."><Button variant="outline" className="h-9 gap-2 bg-card text-xs" onClick={() => void load()}><RefreshCw size={13} />Refresh</Button></PageHeading><div className="mb-6 flex items-start gap-3 rounded-xl border bg-accent/60 p-4 text-accent-foreground"><ShieldCheck size={19} className="shrink-0" /><p className="text-xs leading-relaxed">New accounts are pending Business Users and cannot read business data. Changes below are authorized by the database. The last approved Super Admin cannot be disabled or demoted.</p></div><section className="panel overflow-hidden"><div className="border-b p-4"><SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search account email…" /></div>{error ? <p className="p-5 text-xs text-destructive" role="alert">{error}</p> : loading ? <p className="p-5 text-xs text-muted-foreground" role="status">Loading accounts…</p> : <div className="overflow-x-auto"><table className="w-full"><thead><tr>{['Account','Application role','Approval state','Current state','Action'].map(label => <th key={label} className="table-head">{label}</th>)}</tr></thead><tbody>{users.map(user => <UserRow key={`${user.id}-${user.role}-${user.status}`} user={user} onSaved={async () => { await load(); await refreshProfile(); }} />)}</tbody></table>{!users.length && <p className="p-6 text-xs text-muted-foreground">No matching accounts.</p>}</div>}<Pagination page={page} pages={Math.max(1, Math.ceil(total / 25))} total={total} pageSize={25} onPage={setPage} /></section><p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">Business Users can view, create, and update business records and export permitted data. Only Super Admins can delete records, use the administrative import workflow, manage accounts, or access VPS Control. Pending/disabled are approval states, not additional roles.</p></>;
}
