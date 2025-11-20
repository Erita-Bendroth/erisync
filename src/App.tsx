import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import Layout from "@/components/Layout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Schedule from "./pages/Schedule";
import Analytics from "./pages/Analytics";
import Manual from "./pages/Manual";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import TestReset from "./pages/TestReset";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import SecurityPolicy from "./pages/SecurityPolicy";
import Contact from "./pages/Contact";
import UnifiedDashboard from "./pages/UnifiedDashboard";

// Protected route wrapper with Layout
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => (
  <Layout>{children}</Layout>
);


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/unified-dashboard" element={<ProtectedRoute><UnifiedDashboard /></ProtectedRoute>} />
            <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/manual" element={<ProtectedRoute><Manual /></ProtectedRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/test-reset" element={<TestReset />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/security-policy" element={<SecurityPolicy />} />
            <Route path="/contact" element={<Contact />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;