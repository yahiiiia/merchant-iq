import { ShieldOff } from "lucide-react";
import { PageHeading, StatusBadge } from "@/components/CRMShared";
import { Button } from "@/components/ui/button";

const examples = [
  { name: "Example Admin (fictional)", email: "admin@offline.example", role: "super_admin", status: "approved" },
  { name: "Example Business User (fictional)", email: "user@offline.example", role: "business_user", status: "approved" },
  { name: "Example Registration (fictional)", email: "pending@offline.example", role: "business_user", status: "pending" },
  { name: "Example Disabled User (fictional)", email: "disabled@offline.example", role: "business_user", status: "disabled" },
];
export default function OfflineAccess() {
  return <>
    <PageHeading eyebrow="Local screen preview" title="Access management" description="Read-only examples of account roles and approval states. These are not real accounts." />
    <div className="mb-6 flex items-start gap-3 rounded-xl border bg-accent/60 p-4 text-accent-foreground"><ShieldOff size={20} className="shrink-0" /><p className="text-xs leading-relaxed">Account creation, approval, disabling, role changes, and all authentication operations are unavailable offline. No user-management requests are sent. The local preview does not grant a real account or Super Admin privileges.</p></div>
    <section className="panel overflow-hidden"><div className="overflow-x-auto"><table className="w-full"><thead><tr>{["Fictional account", "Application role", "Approval state", "Current state", "Action"].map(label => <th key={label} className="table-head">{label}</th>)}</tr></thead><tbody>{examples.map(user => <tr key={user.email}>
      <td className="table-cell"><span className="block font-semibold">{user.name}</span><span className="mt-1 block text-[10px] text-muted-foreground">{user.email}</span></td>
      <td className="table-cell"><select disabled aria-label={`Role for ${user.email} (preview only)`} className="field h-9 text-xs" value={user.role}><option value="super_admin">Super Admin</option><option value="business_user">Business User</option></select></td>
      <td className="table-cell"><select disabled aria-label={`State for ${user.email} (preview only)`} className="field h-9 text-xs" value={user.status}><option value="approved">Approved</option><option value="pending">Pending</option><option value="disabled">Disabled</option></select></td>
      <td className="table-cell"><StatusBadge value={user.status} /></td><td className="table-cell text-right"><Button disabled className="h-8 text-[11px]">Unavailable offline</Button></td>
    </tr>)}</tbody></table></div></section>
    <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">In connected mode, new registrations remain pending Business Users until explicitly approved. Production authentication, approval checks, and database RLS are unchanged.</p>
  </>;
}
