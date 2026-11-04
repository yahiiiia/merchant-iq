import { useState } from "react";
import { Upload, FileSpreadsheet, Download, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { parseCSV, exportCSV, fieldsFor, useCRM, type RecordData } from "@/lib/crm";
import { useSession } from "@/components/SessionProvider";
import { errorMessage } from "@/lib/errors";
import { toast } from "sonner";
import { OFFLINE_PREVIEW } from "@/lib/offline-preview";

export default function ImportMerchants({ onClose }: { onClose: () => void }) {
  const { importMerchants } = useCRM();
  const { isAdmin } = useSession();
  const [records, setRecords] = useState<RecordData[]>([]), [error, setError] = useState(""), [filename, setFilename] = useState(""), [busy, setBusy] = useState(false);
  const columns = fieldsFor("merchants").filter(f => f.type !== "contact").map(f => f.key);
  async function load(file?: File) {
    setError(""); setRecords([]); setFilename(file?.name || ""); if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Choose a CSV smaller than 5 MB."); return; }
    setBusy(true);
    try {
      const rows = parseCSV(await file.text()); const header = rows.shift()?.map(c => c.trim()) || [];
      if (!header.includes("name") || !header.includes("industry")) throw new Error('CSV requires "name" and "industry" columns. Download the template for exact headers.');
      if (new Set(header).size !== header.length) throw new Error("CSV contains duplicate column headers.");
      const unknown = header.filter(h => !columns.includes(h));
      if (unknown.length) throw new Error(`Unrecognized columns: ${unknown.join(", ")}. Use the provided template.`);
      if (!rows.length || rows.length > 2000) throw new Error("Import between 1 and 2,000 records at a time.");
      const parsed = rows.map((row, i) => {
        if (row.length !== header.length) throw new Error(`Row ${i + 2}: column count does not match the header.`);
        const r: RecordData = { id: crypto.randomUUID(), country: "Canada", status: "Unknown", source: "CSV import", quality: "Unverified", estimatedVolume: null, confirmedVolume: null };
        header.forEach((h, j) => { r[h] = row[j].trim(); });
        if (!r.name || !r.industry) throw new Error(`Row ${i + 2}: name and industry are required.`);
        if (!r.status) r.status = "Unknown"; if (!r.source) r.source = "CSV import"; if (!r.quality) r.quality = "Unverified";
        for (const field of fieldsFor("merchants")) {
          const v = r[field.key];
          if (field.type === "number") { if (v !== "" && v != null && (!Number.isFinite(Number(v)) || Number(v) < 0)) throw new Error(`Row ${i + 2}: invalid ${field.label}.`); r[field.key] = v === "" || v == null ? null : Number(v); }
          if (field.options && v && !field.options.includes(String(v))) throw new Error(`Row ${i + 2}: invalid ${field.label}.`);
          if (field.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) throw new Error(`Row ${i + 2}: invalid email.`);
          if (field.type === "date" && v && (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || Number.isNaN(Date.parse(String(v))))) throw new Error(`Row ${i + 2}: date must use YYYY-MM-DD.`);
        }
        if (!r.country) r.country = "Canada";
        return r;
      });
      setRecords(parsed);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function importRows() {
    setBusy(true); setError("");
    try { const count = await importMerchants(records); toast.success(`${count} ${OFFLINE_PREVIEW ? "local test " : ""}merchants imported`); onClose(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  if (!OFFLINE_PREVIEW && !isAdmin) return null;
  return <Dialog open onOpenChange={v => !v && !busy && onClose()}><DialogContent className="max-w-lg rounded-xl"><DialogHeader><DialogTitle>{OFFLINE_PREVIEW ? "Import local test merchants" : "Import merchants"}</DialogTitle><DialogDescription className="text-xs">{OFFLINE_PREVIEW ? "Test CSV files are read locally into this tab’s memory only. No upload or database write. Data resets on reload." : "Validated records are saved together in one database transaction."}</DialogDescription></DialogHeader><div className="my-2 flex items-start gap-2 rounded-lg bg-accent p-3 text-[11px] text-accent-foreground"><Info size={15} className="shrink-0" />{OFFLINE_PREVIEW ? "Use fictional test data only. Local imports never sync to Supabase." : "Super Admin import. Existing records are not overwritten or merged. Possible duplicates are flagged after import."}</div><Button variant="outline" className="h-9 justify-start gap-2 text-xs" onClick={() => exportCSV([], columns, `MerchantIQ-${OFFLINE_PREVIEW ? "OFFLINE-TEST-" : ""}import-template.csv`)}><Download size={14} />Download CSV template</Button><p className="text-[11px] leading-relaxed text-muted-foreground">Use exact template headers. Name and industry are required. Dates: YYYY-MM-DD. Leave unknown processing volumes empty. Add contact relationships after import.</p><label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 hover:bg-muted/50"><FileSpreadsheet size={28} className="text-primary" /><span className="text-xs font-medium">{filename || "Choose a CSV file"}</span><span className="text-[10px] text-muted-foreground">Up to 5 MB · 2,000 rows</span><input aria-label="CSV file" type="file" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={e => void load(e.target.files?.[0])} /></label>{error && <p role="alert" className="text-xs text-destructive">{error}</p>}{records.length > 0 && <p className="text-xs text-primary">{records.length} valid records ready to import.</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose} className="h-9 text-xs">Cancel</Button><Button disabled={!records.length || busy} onClick={() => void importRows()} className="h-9 gap-2 text-xs"><Upload size={14} />{busy ? "Please wait…" : "Import records"}</Button></div></DialogContent></Dialog>;
}
