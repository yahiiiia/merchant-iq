import { Link } from "react-router-dom";
import { ListFilter, ScanSearch, ArrowUpRight } from "lucide-react";
import { useSession } from "@/components/SessionProvider";
import { OFFLINE_PREVIEW } from "@/lib/offline-preview";

export default function WorkspaceLinks() {
  const { isAdmin } = useSession();
  return <nav aria-label="CRM workspaces" className="mb-5 flex flex-wrap gap-3">
    <Link to="/leads" className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs font-medium text-primary hover:bg-accent"><ListFilter size={14} />Lead Explorer<ArrowUpRight size={12} /></Link>
    {(isAdmin || OFFLINE_PREVIEW) && <Link to="/scraper" className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs font-medium text-primary hover:bg-accent"><ScanSearch size={14} />Scraper Control<span className="text-[10px] font-normal text-muted-foreground">Execution pending</span><ArrowUpRight size={12} /></Link>}
  </nav>;
}
