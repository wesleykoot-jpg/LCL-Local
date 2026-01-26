import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LoginView } from "./components/LoginView";
import { SignUpView } from "./components/SignUpView";
import { useAuth } from "./hooks/useAuth";
import { useEffect } from "react";

const Login = () => {
  const [authView, setAuthView] = useState<"login" | "signup">("login");
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user && profile?.profile_complete) {
      navigate("/discovery");
    }
  }, [user, profile, navigate]);

  if (authView === "signup") {
    return <SignUpView onSwitchToLogin={() => setAuthView("login")} />;
  }

  return <LoginView onSwitchToSignUp={() => setAuthView("signup")} />;
};

export default Login;
