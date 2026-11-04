import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
export default function QueryState({ error, retry }: { error?: unknown; retry?: () => void }) {
  return <div className="panel p-6" role={error ? "alert" : "status"}>{error ? <><h2 className="mb-2 text-sm font-semibold">Unable to load records</h2><p className="text-xs text-destructive">{errorMessage(error)}</p>{retry && <Button variant="outline" className="mt-4 h-8 text-xs" onClick={retry}>Retry</Button>}</> : <p className="text-xs text-muted-foreground">Loading database records…</p>}</div>;
}
