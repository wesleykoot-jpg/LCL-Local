// Profile Feature Module - Public API
// Contains user profile, settings, badges, stats, and onboarding

// Components
export { OnboardingWizard } from "./components/OnboardingWizard";
export { ConfirmModal } from "./components/ConfirmModal";
export { MorphingHeader } from "./components/MorphingHeader";
export { LivingPassport } from "./components/LivingPassport";
export { IdentityCard } from "./components/IdentityCard";
export { SettingsDeck } from "./components/SettingsDeck";

// Legacy (kept for backwards compatibility)
// export { PassportGrid } from './components/PassportGrid';

// Hooks
export { useOnboarding } from "./hooks/useOnboarding";

// Pages (for route usage)
export { default as ProfilePage } from "./pages/Profile";
export { default as PrivacySettingsPage } from "./pages/PrivacySettings";
export { default as PersonalInformationPage } from "./pages/PersonalInformation";
export { default as VerificationSafetyPage } from "./pages/VerificationSafety";
export { default as NotificationPreferencesPage } from "./pages/NotificationPreferences";
export { default as ShareProfilePage } from "./pages/ShareProfile";
export { default as UatQualityDashboardPage } from "./pages/UatQualityDashboard";
