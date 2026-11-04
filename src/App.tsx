import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { CRMProvider } from "@/lib/crm";
import CRMLayout from "@/components/CRMLayout";
import Index from "@/pages/Index";
import Records from "@/pages/Records";
import RecordDetail from "@/pages/RecordDetail";
import VPSControl from "@/pages/VPSControl";
import Access from "@/pages/Access";
import NotFound from "@/pages/NotFound";

export default function App() {
  return <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}><TooltipProvider><Toaster richColors position="bottom-right" /><CRMProvider><BrowserRouter><Routes>
    <Route element={<CRMLayout />}>
      <Route path="/" element={<Index />} />
      <Route path="/merchants" element={<Records key="merchants" entity="merchants" />} />
      <Route path="/merchants/:id" element={<RecordDetail key="merchant-detail" entity="merchants" />} />
      <Route path="/contacts" element={<Records key="contacts" entity="contacts" />} />
      <Route path="/contacts/:id" element={<RecordDetail key="contact-detail" entity="contacts" />} />
      <Route path="/leads" element={<Records key="leads" entity="leads" />} />
      <Route path="/leads/:id" element={<RecordDetail key="lead-detail" entity="leads" />} />
      <Route path="/vps" element={<VPSControl />} />
      <Route path="/access" element={<Access />} />
      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes></BrowserRouter></CRMProvider></TooltipProvider></ThemeProvider>;
}
