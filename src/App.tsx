import { Toaster } from "@/shared/components/ui/toaster";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/features/auth";
import { LocationProvider } from "@/features/location";
import { FeedProvider } from "@/contexts/FeedContext";
import { ErrorBoundary } from "@/shared/components";

// IO26 Liquid Glass styles
import "@/styles/io26-glass.css";

// Feature-based page imports
import { FeedPage, DiscoveryPage, MyPlanningPage } from "@/features/events";
import { 
  ProfilePage, 
  PrivacySettingsPage, 
  PersonalInformationPage, 
  VerificationSafetyPage, 
  NotificationPreferencesPage, 
  ShareProfilePage 
} from "@/features/profile";
import { LoginPage } from "@/features/auth";
import { GoogleCalendarSettingsPage } from "@/features/calendar";
import { AdminPage } from "@/features/admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours - cache persists for offline use
      staleTime: 1000 * 60 * 5, // 5 minutes before refetch
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});
const storagePersister = typeof window !== 'undefined'
  ? createSyncStoragePersister({ storage: window.localStorage })
  : null;

/**
 * IO26 Refraction SVG Filter
 * 
 * Hidden global SVG filter using feTurbulence and feDisplacementMap
 * to simulate physical light bending at card edges for the Liquid Glass effect.
 */
const IO26RefractionFilter = () => (
  <svg
    style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    aria-hidden="true"
  >
    <defs>
      <filter id="io26-refraction" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.015"
          numOctaves="3"
          result="turbulence"
          seed="42"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="turbulence"
          scale="4"
          xChannelSelector="R"
          yChannelSelector="G"
          result="displaced"
        />
        <feGaussianBlur in="displaced" stdDeviation="0.5" result="blurred" />
        <feMerge>
          <feMergeNode in="blurred" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  </svg>
);

const App = () => (
  <ErrorBoundary>
    <IO26RefractionFilter />
    {storagePersister ? (
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: storagePersister, maxAge: 1000 * 60 * 60 * 24 }}
      >
        <TooltipProvider>
          <AuthProvider>
            <LocationProvider>
              <FeedProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Routes>
                    {/* Main app routes - accessible without login for dev */}
                    <Route path="/" element={<DiscoveryPage />} />
                    <Route path="/feed" element={<FeedPage />} />
                    <Route path="/planning" element={<MyPlanningPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    
                    {/* Profile Settings routes */}
                    <Route path="/profile/privacy-settings" element={<PrivacySettingsPage />} />
                    <Route path="/profile/personal-information" element={<PersonalInformationPage />} />
                    <Route path="/profile/verification-safety" element={<VerificationSafetyPage />} />
                    <Route path="/profile/notification-preferences" element={<NotificationPreferencesPage />} />
                    <Route path="/profile/share" element={<ShareProfilePage />} />
                    <Route path="/profile/calendar" element={<GoogleCalendarSettingsPage />} />
                    
                    {/* Admin routes (dev mode only) */}
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/scraper-admin" element={<AdminPage />} />
                    
                    {/* Auth routes */}
                    <Route path="/login" element={<LoginPage />} />
                    
                    {/* Catch-all */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </FeedProvider>
            </LocationProvider>
          </AuthProvider>
        </TooltipProvider>
      </PersistQueryClientProvider>
    ) : (
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
        <TooltipProvider>
          <AuthProvider>
            <LocationProvider>
              <FeedProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Routes>
                    {/* Main app routes - accessible without login for dev */}
                    <Route path="/" element={<DiscoveryPage />} />
                    <Route path="/feed" element={<FeedPage />} />
                    <Route path="/planning" element={<MyPlanningPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    
                    {/* Profile Settings routes */}
                    <Route path="/profile/privacy-settings" element={<PrivacySettingsPage />} />
                    <Route path="/profile/personal-information" element={<PersonalInformationPage />} />
                    <Route path="/profile/verification-safety" element={<VerificationSafetyPage />} />
                    <Route path="/profile/notification-preferences" element={<NotificationPreferencesPage />} />
                    <Route path="/profile/share" element={<ShareProfilePage />} />
                    <Route path="/profile/calendar" element={<GoogleCalendarSettingsPage />} />
                    
                    {/* Admin routes (dev mode only) */}
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/scraper-admin" element={<AdminPage />} />
                    
                    {/* Auth routes */}
                    <Route path="/login" element={<LoginPage />} />
                    
                    {/* Catch-all */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </FeedProvider>
            </LocationProvider>
          </AuthProvider>
        </TooltipProvider>
      </PersistQueryClientProvider>
    )}
  </ErrorBoundary>
);

export default App;
