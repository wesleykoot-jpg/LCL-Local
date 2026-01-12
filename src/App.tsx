import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Page imports
import Feed from "./pages/Feed";
import MyEvents from "./pages/MyEvents";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import PrivacySettings from "./pages/PrivacySettings";
import PersonalInformation from "./pages/PersonalInformation";
import VerificationSafety from "./pages/VerificationSafety";
import NotificationPreferences from "./pages/NotificationPreferences";
import ShareProfile from "./pages/ShareProfile";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Main app routes - accessible without login for dev */}
              <Route path="/" element={<Navigate to="/feed" replace />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/my-events" element={<MyEvents />} />
              <Route path="/profile" element={<Profile />} />
              
              {/* Profile Settings routes */}
              <Route path="/profile/privacy-settings" element={<PrivacySettings />} />
              <Route path="/profile/personal-information" element={<PersonalInformation />} />
              <Route path="/profile/verification-safety" element={<VerificationSafety />} />
              <Route path="/profile/notification-preferences" element={<NotificationPreferences />} />
              <Route path="/profile/share" element={<ShareProfile />} />
              
              {/* Auth routes */}
              <Route path="/login" element={<Login />} />
              
              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
