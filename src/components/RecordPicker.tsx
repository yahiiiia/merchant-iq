import { useState } from "react";
import { useRecord, useRecords, type Entity } from "@/lib/crm";
import { errorMessage } from "@/lib/errors";

export default function RecordPicker({ entity = "merchants", value, onChange, required = false, merchantId, id, label = "merchant" }: { entity?: Entity; value: string; onChange: (id: string) => void; required?: boolean; merchantId?: string; id: string; label?: string }) {
  const [search, setSearch] = useState("");
  const enabled = entity === "merchants" || !!merchantId;
  const result = useRecords(entity, { search, filters: entity === "contacts" ? { merchantId: merchantId || "" } : {}, sort: "name", asc: true, pageSize: 50 }, enabled);
  const selected = useRecord(entity, value || undefined);
  const rows = result.data?.rows || [];
  const selectedRecord = selected.data;
  const options = selectedRecord && !rows.some(r => r.id === selectedRecord.id) ? [selectedRecord, ...rows] : rows;
  return <div className="space-y-2"><input className="field h-8 text-[11px]" aria-label={`Search ${label} options`} placeholder={`Search ${label}s…`} value={search} onChange={e => setSearch(e.target.value)} disabled={!enabled} /><select className="field text-xs" id={id} required={required} value={value} onChange={e => onChange(e.target.value)} disabled={!enabled}><option value="">{required ? `Select ${label}` : `No ${label} selected`}</option>{options.map(r => <option key={r.id} value={r.id}>{r.name}{entity === "contacts" && r.title ? ` — ${r.title}` : ""}</option>)}</select>{result.isFetching && <p className="text-[10px] text-muted-foreground">Loading options…</p>}{result.error && <p role="alert" className="text-[10px] text-destructive">{errorMessage(result.error)}</p>}{result.data && result.data.total > 50 && <p className="text-[10px] text-muted-foreground">Showing 50 of {result.data.total}. Search to narrow the options.</p>}{!enabled && <p className="text-[10px] text-muted-foreground">Select a merchant first.</p>}</div>;
}
