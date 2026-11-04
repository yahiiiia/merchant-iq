import { FlaskConical, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePreviewBanner() {
  return <section aria-label="Offline preview notice" className="border-b border-amber-300 bg-amber-50 px-5 py-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 md:px-8">
    <div className="mx-auto flex max-w-[1536px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3"><FlaskConical size={20} className="mt-0.5 shrink-0" /><div>
        <p className="text-xs font-bold tracking-wide">OFFLINE PREVIEW · DEVELOPMENT ONLY</p>
        <p className="mt-1 text-[11px] leading-relaxed">Fictional local test data. No account, hosted Supabase connection, or sync. Changes exist only in this tab’s memory and reset on reload. Account management and VPS operations are disabled.</p>
      </div></div>
      <Button variant="outline" className="h-8 shrink-0 gap-2 self-start rounded-lg border-amber-400 bg-transparent text-[11px] text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900 sm:self-auto" onClick={() => { if (window.confirm("Discard all local preview changes and reload the fictional test data?")) window.location.reload(); }}><RotateCcw size={13} />Reset test data</Button>
    </div>
  </section>;
}
