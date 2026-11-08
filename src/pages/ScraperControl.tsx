import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeading } from "@/components/CRMShared";
import LiveScraperJobs from "@/components/LiveScraperJobs";
import SupabaseScraperRecords from "@/components/SupabaseScraperRecords";

export default function ScraperControl() {
  return <>
    <PageHeading eyebrow="Admin · Data operations" title="Scraper Control" description="Search Google Maps for businesses, track your scrapes, and download results." />
    <Tabs defaultValue="live"><TabsList className="mb-5 h-auto flex-wrap rounded-lg border bg-card p-1"><TabsTrigger value="live" className="rounded-md px-4 py-2 text-xs">Scraping Jobs</TabsTrigger><TabsTrigger value="database" className="rounded-md px-4 py-2 text-xs">Drafts & processing</TabsTrigger></TabsList>
      <TabsContent value="live"><LiveScraperJobs /></TabsContent>
      <TabsContent value="database"><SupabaseScraperRecords /></TabsContent>
    </Tabs>
  </>;
}
