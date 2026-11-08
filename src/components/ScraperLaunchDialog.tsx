import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { scraperCreateSchema, responseJson, type ScraperCreateInput } from "@/lib/scraper-contract";
import { ScraperHttpError } from "@/lib/scraper-transport";
import { errorMessage } from "@/lib/errors";
import { OFFLINE_PREVIEW } from "@/lib/offline-preview";

export default function ScraperLaunchDialog({ open, onOpenChange, launch }: {
  open: boolean; onOpenChange: (open: boolean) => void;
  launch: (input: ScraperCreateInput) => Promise<unknown>;
}) {
  const [name, setName] = useState(""), [keywords, setKeywords] = useState("");
  const [lat, setLat] = useState(""), [lon, setLon] = useState("");
  const [radiusKm, setRadiusKm] = useState("10"), [lang, setLang] = useState("en");
  const [zoom, setZoom] = useState("15"), [depth, setDepth] = useState("1"), [seconds, setSeconds] = useState("300");
  const [email, setEmail] = useState(false), [fastMode, setFastMode] = useState(false), [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [uncertain, setUncertain] = useState(false);
  const [receipt, setReceipt] = useState<{ value: unknown } | null>(null);
  const submitting = useRef(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || uncertain || receipt || OFFLINE_PREVIEW) return;
    const parsed = scraperCreateSchema.safeParse({
      name, keywords: keywords.split(/\r?\n/).map(value => value.trim()).filter(Boolean),
      lang, lat, lon, radius: Math.round(Number(radiusKm) * 1000),
      zoom: Number(zoom), depth: Number(depth), max_time: Number(seconds), email, fast_mode: fastMode,
    });
    if (!parsed.success) { setError(parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(" ")); return; }
    if (!verified) { setError("Verify the location on Google Maps before starting."); return; }
    submitting.current = true; setBusy(true); setError("");
    try {
      const value = await launch(parsed.data);
      setReceipt({ value });
    } catch (error) {
      const rejected = error instanceof ScraperHttpError && [400, 401, 403, 404, 405, 422].includes(error.status);
      setUncertain(!rejected);
      setError(`${errorMessage(error)}${rejected ? "" : " We couldn’t confirm whether the scrape started. Check Scraping Jobs before trying again to avoid a duplicate."}`);
    } finally { submitting.current = false; setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={value => !busy && onOpenChange(value)}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-xl">
    <DialogHeader><DialogTitle>New Scrape</DialogTitle><DialogDescription className="text-xs">Choose what to search for and verify your target area before starting.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={busy || !!receipt || uncertain || OFFLINE_PREVIEW} className="space-y-4">
        <div><label htmlFor="live-name" className="mb-1.5 block text-xs font-medium">Job name</label><input id="live-name" className="field text-xs" required maxLength={100} value={name} onChange={event => setName(event.target.value)} /></div>
        <div><label htmlFor="live-keywords" className="mb-1.5 block text-xs font-medium">Search keywords · one per line, up to five</label><textarea id="live-keywords" className="field min-h-24 py-2 text-xs" required rows={3} value={keywords} onChange={event => setKeywords(event.target.value)} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="live-lat" className="mb-1.5 block text-xs font-medium">Latitude</label><input id="live-lat" className="field text-xs" type="number" step="any" min={-90} max={90} required value={lat} aria-describedby="coordinate-help" onChange={event => { setLat(event.target.value); setVerified(false); }} /></div>
          <div><label htmlFor="live-lon" className="mb-1.5 block text-xs font-medium">Longitude</label><input id="live-lon" className="field text-xs" type="number" step="any" min={-180} max={180} required value={lon} aria-describedby="coordinate-help" onChange={event => { setLon(event.target.value); setVerified(false); }} /></div>
        </div>
        <p id="coordinate-help" className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed">📍 Need coordinates? Ask ChatGPT for the latitude and longitude of your target city or area, then copy them here. Verify the location on Google Maps before launching.</p>
        {lat.trim() && lon.trim() && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) && <a className="inline-block text-xs font-medium text-primary underline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`} target="_blank" rel="noopener noreferrer">Verify location on Google Maps ↗</a>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="live-radius" className="mb-1.5 block text-xs font-medium">Search radius (kilometres)</label><input id="live-radius" className="field text-xs" type="number" step="0.001" min="0.1" required value={radiusKm} onChange={event => setRadiusKm(event.target.value)} /><p className="mt-1 text-[10px] text-muted-foreground">Distance from your chosen coordinates. Minimum 0.1 km.</p></div>
          <div><label htmlFor="live-language" className="mb-1.5 block text-xs font-medium">Language</label><select id="live-language" className="field text-xs" value={lang} onChange={event => setLang(event.target.value)}><option value="en">English</option><option value="fr">French</option></select></div>
        </div>
        <details className="rounded-lg border p-3"><summary className="cursor-pointer text-xs font-semibold">Advanced settings</summary><div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div><label htmlFor="live-zoom" className="mb-1.5 block text-xs font-medium">Zoom (1–21)</label><input id="live-zoom" className="field text-xs" type="number" min={1} max={21} step={1} required value={zoom} onChange={event => setZoom(event.target.value)} /></div>
          <div><label htmlFor="live-depth" className="mb-1.5 block text-xs font-medium">Search depth (1–10)</label><input id="live-depth" className="field text-xs" type="number" min={1} max={10} step={1} required value={depth} onChange={event => setDepth(event.target.value)} /></div>
          <div><label htmlFor="live-seconds" className="mb-1.5 block text-xs font-medium">Max runtime (seconds)</label><input id="live-seconds" className="field text-xs" type="number" min={30} max={3600} step={1} required value={seconds} onChange={event => setSeconds(event.target.value)} /></div>
        </div><div className="mt-4 flex flex-wrap gap-4 text-xs"><label className="flex items-center gap-2"><input type="checkbox" className="accent-primary" checked={email} onChange={event => setEmail(event.target.checked)} />Collect email addresses</label><label className="flex items-center gap-2"><input type="checkbox" className="accent-primary" checked={fastMode} onChange={event => setFastMode(event.target.checked)} />Fast mode</label></div><p className="mt-3 text-[10px] text-muted-foreground">Runtime can be set between 30 and 3,600 seconds.</p></details>
        <p className="text-xs text-muted-foreground">The number of businesses found varies by search and location.</p>
        <label className="flex items-start gap-2 text-xs leading-relaxed"><input className="mt-0.5 accent-primary" type="checkbox" required checked={verified} onChange={event => setVerified(event.target.checked)} />I verified the location on Google Maps and want to start a real scrape.</label>
      </fieldset>
      {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-xs text-destructive">{error}</p>}
      {uncertain && <Button type="button" variant="outline" className="h-auto whitespace-normal text-xs" onClick={() => { if (window.confirm("Have you checked Scraping Jobs and confirmed another attempt is appropriate? A duplicate scrape is possible.")) { setUncertain(false); setError(""); } }}>I checked Scraping Jobs · try again</Button>}
      {receipt && <div className="space-y-3 rounded-xl border p-4">
        <p className="text-sm font-semibold">Scrape request received</p>
        <p className="text-xs leading-relaxed text-muted-foreground">Your request was acknowledged. Check Scraping Jobs to confirm the job and its status. This does not mean the scrape has completed.</p>
        <details className="rounded-lg border p-3"><summary className="cursor-pointer text-xs font-medium">Technical Details</summary><pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-all text-[11px]">{responseJson(receipt.value)}</pre></details>
        <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => { setReceipt(null); setVerified(false); }}>New Scrape</Button>
      </div>}
      {OFFLINE_PREVIEW && <p className="text-xs text-muted-foreground">Scraping is unavailable in offline preview.</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} className="h-9 text-xs" onClick={() => onOpenChange(false)}>Close</Button><Button type="submit" disabled={busy || uncertain || !!receipt || OFFLINE_PREVIEW} className="h-9 text-xs">{busy ? "Submitting…" : "Start Scraping"}</Button></div>
    </form>
  </DialogContent></Dialog>;
}
