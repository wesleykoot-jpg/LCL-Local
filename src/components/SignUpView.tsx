import React, { useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { Loader2 } from 'lucide-react';

interface SignUpViewProps {
  onSwitchToLogin: () => void;
}

export function SignUpView({ onSwitchToLogin }: SignUpViewProps) {
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    return null;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    const { error: signUpError } = await signUpWithEmail(email, password, fullName);

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError(null);
    setLoading(true);

    const { error: signInError } = await signInWithGoogle();

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    }
  };

  const passwordStrength = (pwd: string) => {
    if (pwd.length === 0) return { text: '', color: '', width: '0%' };
    if (pwd.length < 6) return { text: 'Weak', color: 'bg-destructive', width: '33%' };
    if (pwd.length < 10) return { text: 'Good', color: 'bg-yellow-500', width: '66%' };
    return { text: 'Strong', color: 'bg-green-500', width: '100%' };
  };

  const strength = passwordStrength(password);
  const isFormValid = fullName && email && password && confirmPassword && password === confirmPassword && password.length >= 8;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-border">
        <h1 className="text-[28px] font-bold text-foreground tracking-tight text-center">
          Create your account
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 max-w-md mx-auto w-full overflow-y-auto">
        <p className="text-[17px] text-foreground font-semibold mb-6">
          Welcome to LCL
        </p>

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-[15px]">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSignUp} className="space-y-0 mb-4">
          {/* Full Name */}
          <div className="border border-border rounded-t-xl overflow-hidden">
            <div className="relative">
              <label className="absolute left-4 top-2 text-[12px] text-muted-foreground font-medium">
                Full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
                className="w-full bg-card pt-7 pb-3 px-4 text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary disabled:opacity-50"
                placeholder="John Doe"
              />
            </div>
          </div>

          {/* Email */}
          <div className="border border-t-0 border-border overflow-hidden">
            <div className="relative">
              <label className="absolute left-4 top-2 text-[12px] text-muted-foreground font-medium">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full bg-card pt-7 pb-3 px-4 text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary disabled:opacity-50"
                placeholder="your@email.com"
              />
            </div>
          </div>

          {/* Password */}
          <div className="border border-t-0 border-border overflow-hidden">
            <div className="relative">
              <label className="absolute left-4 top-2 text-[12px] text-muted-foreground font-medium">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full bg-card pt-7 pb-3 px-4 text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary disabled:opacity-50"
                placeholder="At least 8 characters"
              />
            </div>
          </div>

          {/* Confirm Password */}
          <div className="border border-t-0 border-border rounded-b-xl overflow-hidden">
            <div className="relative">
              <label className="absolute left-4 top-2 text-[12px] text-muted-foreground font-medium">
                Confirm password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full bg-card pt-7 pb-3 px-4 text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary disabled:opacity-50"
                placeholder="••••••••"
              />
            </div>
          </div>
        </form>

        {/* Password Strength Indicator */}
        {password && (
          <div className="mb-4">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full ${strength.color} transition-all duration-300`}
                style={{ width: strength.width }}
              />
            </div>
            <p className="text-[12px] text-muted-foreground mt-1">
              Password strength: <span className="font-medium">{strength.text}</span>
            </p>
          </div>
        )}

        <p className="text-[12px] text-muted-foreground mb-4">
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </p>

        <button
          onClick={handleSignUp}
          disabled={loading || !isFormValid}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-[16px] min-h-[52px]"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'Create account'
          )}
        </button>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-[13px]">
            <span className="px-4 bg-background text-muted-foreground">or</span>
          </div>
        </div>

        {/* Social Sign Up */}
        <button
          onClick={handleGoogleSignUp}
          disabled={loading}
          className="w-full bg-card hover:bg-secondary text-foreground font-semibold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-border text-[15px] min-h-[52px]"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        {/* Switch to Login */}
        <div className="mt-8 text-center pb-8">
          <p className="text-[14px] text-muted-foreground">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              disabled={loading}
              className="text-primary hover:underline font-semibold disabled:opacity-50"
            >
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
