import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TenantProvider, useTenant } from "@/contexts/TenantContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import AcceptInvite from "./pages/AcceptInvite.tsx";
import TeamInvites from "./pages/TeamInvites.tsx";
const Locations = lazy(() => import("./pages/Locations.tsx"));
const TeamStaff = lazy(() => import("./pages/TeamStaff.tsx"));
const SettingsFeatures = lazy(() => import("./pages/SettingsFeatures.tsx"));

const Index = lazy(() => import("./pages/Index.tsx"));
const Menu = lazy(() => import("./pages/Menu.tsx"));
const PlatformAdmin = lazy(() => import("./pages/PlatformAdmin.tsx"));
const QAReport = lazy(() => import("./pages/QAReport.tsx"));
const SecurityEvents = lazy(() => import("./pages/SecurityEvents.tsx"));
const OfflineAdmin = lazy(() => import("./pages/OfflineAdmin.tsx"));
const Pair = lazy(() => import("./pages/Pair.tsx"));
const Devices = lazy(() => import("./pages/Devices.tsx"));
const SecuritySettings = lazy(() => import("./pages/SecuritySettings.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const MarketingHome = lazy(() => import("./pages/marketing/Home.tsx"));
const MarketingFeatures = lazy(() => import("./pages/marketing/Features.tsx"));
const MarketingPricing = lazy(() => import("./pages/marketing/Pricing.tsx"));
const MarketingContact = lazy(() => import("./pages/marketing/Contact.tsx"));
const MarketingDemo = lazy(() => import("./pages/marketing/Demo.tsx"));

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { isPlatformLevel } = useTenant();
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/accept-invite/:token" element={<AcceptInvite />} />
        <Route path="/pair" element={<Pair />} />
        <Route path="/devices" element={<ProtectedRoute><Devices /></ProtectedRoute>} />
        <Route path="/settings/security" element={<ProtectedRoute><SecuritySettings /></ProtectedRoute>} />
        <Route path="/admin" element={<PlatformAdmin />} />
        <Route path="/admin/qa-report" element={<QAReport />} />
        <Route path="/admin/security-events" element={<SecurityEvents />} />
        <Route path="/admin/offline" element={<ProtectedRoute><OfflineAdmin /></ProtectedRoute>} />
        <Route path="/menu/:tableId" element={<Menu />} />
        <Route path="/team" element={<ProtectedRoute><TeamInvites /></ProtectedRoute>} />
        <Route path="/team/staff" element={<ProtectedRoute><TeamStaff /></ProtectedRoute>} />
        <Route path="/locations" element={<ProtectedRoute><Locations /></ProtectedRoute>} />
        <Route path="/settings/features" element={<ProtectedRoute><SettingsFeatures /></ProtectedRoute>} />

        {isPlatformLevel ? (
          <>
            <Route path="/" element={<MarketingHome />} />
            <Route path="/features" element={<MarketingFeatures />} />
            <Route path="/pricing" element={<MarketingPricing />} />
            <Route path="/contact" element={<MarketingContact />} />
            <Route path="/demo" element={<MarketingDemo />} />
            <Route path="/app" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          </>
        ) : (
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
        )}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <TenantProvider>
          <AuthProvider>
            <LocationProvider>
              <AppRoutes />
            </LocationProvider>
          </AuthProvider>
        </TenantProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
