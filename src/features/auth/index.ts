// Auth Feature Module - Public API
// Contains authentication context, hooks, and components

// Context
export { AuthContext, AuthProvider } from './AuthContext';

// Hooks
export { useAuth } from './hooks/useAuth';

// Components
export { LoginView } from './components/LoginView';
export { SignUpView } from './components/SignUpView';

// Page (for route usage)
export { default as LoginPage } from './Login';
