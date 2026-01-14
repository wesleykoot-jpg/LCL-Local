import { Toaster } from "@/shared/components/ui/toaster";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/features/auth";
import { LocationProvider } from "@/features/location";
import { ErrorBoundary } from "@/shared/components";

// Feature-based page imports
import { FeedPage, MyEventsPage } from "@/features/events";
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

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <LocationProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Main app routes - accessible without login for dev */}
                <Route path="/" element={<Navigate to="/feed" replace />} />
                <Route path="/feed" element={<FeedPage />} />
                <Route path="/my-events" element={<MyEventsPage />} />
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
                
                {/* Auth routes */}
                <Route path="/login" element={<LoginPage />} />
                
                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </LocationProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
