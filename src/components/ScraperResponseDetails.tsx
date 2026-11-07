import { responseJson } from "@/lib/scraper-contract";

export default function ScraperResponseDetails({ value }: { value: unknown }) {
  const fields = value !== null && typeof value === "object" && !Array.isArray(value)
    ? Object.entries(value).filter(([key, item]) => !/^(proxies|authorization|access_token|refresh_token|password|secret)$/i.test(key) && (item === null || ["string", "number", "boolean"].includes(typeof item)))
    : [];
  return <div className="space-y-4">
    {fields.length > 0 && <dl className="grid gap-4 rounded-lg border p-4 text-xs sm:grid-cols-2">{fields.map(([key, item]) => <div key={key}><dt className="break-all text-[10px] font-medium text-muted-foreground">{key}</dt><dd className="mt-1 whitespace-pre-wrap break-all">{item === null ? "null" : String(item)}</dd></div>)}</dl>}
    <details className="rounded-lg border p-3" open={!fields.length}><summary className="cursor-pointer text-xs font-semibold">Complete backend response · sensitive fields redacted</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all text-[11px]">{responseJson(value)}</pre></details>
  </div>;
}
