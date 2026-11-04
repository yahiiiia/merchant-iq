import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContextProvider } from "@/components/SessionProvider";
import AuthGuard from "@/components/AuthGuard";
import CRMLayout from "@/components/CRMLayout";
import Login from "@/pages/Login";
import Pending from "@/pages/Pending";
import AuthCallback from "@/pages/AuthCallback";
import ResetPassword from "@/pages/ResetPassword";
import Index from "@/pages/Index";
import Records from "@/pages/Records";
import RecordDetail from "@/pages/RecordDetail";
import VPSControl from "@/pages/VPSControl";
import Access from "@/pages/Access";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 10000, retry: 1, refetchOnWindowFocus: true } } });
export default function App() {
  return <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}><TooltipProvider><Toaster richColors position="bottom-right" />
      <SessionContextProvider><BrowserRouter><Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/pending" element={<Pending />} />
        <Route element={<AuthGuard />}><Route element={<CRMLayout />}>
          <Route path="/" element={<Index />} />
          <Route path="/merchants" element={<Records key="merchants" entity="merchants" />} />
          <Route path="/merchants/:id" element={<RecordDetail key="merchant-detail" entity="merchants" />} />
          <Route path="/contacts" element={<Records key="contacts" entity="contacts" />} />
          <Route path="/contacts/:id" element={<RecordDetail key="contact-detail" entity="contacts" />} />
          <Route path="/leads" element={<Records key="leads" entity="leads" />} />
          <Route path="/leads/:id" element={<RecordDetail key="lead-detail" entity="leads" />} />
          <Route element={<AuthGuard adminOnly />}>
            <Route path="/vps" element={<VPSControl />} />
            <Route path="/access" element={<Access />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route></Route>
      </Routes></BrowserRouter></SessionContextProvider>
    </TooltipProvider></QueryClientProvider>
  </ThemeProvider>;
}
