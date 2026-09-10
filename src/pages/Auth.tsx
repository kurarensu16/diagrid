import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  User as UserIcon, 
  ArrowRight, 
  AlertCircle,
  X,
  CheckCircle2,
  KeyRound
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';
import { authService } from '../services/authService';

export const Auth: React.FC = () => {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isSignUp = authMode === 'signup';
  const isForgot = authMode === 'forgot';

  // Auto-dismiss error message after 5 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      setError('');
    }, 5000);
    return () => clearTimeout(timer);
  }, [error]);

  // Auto-dismiss info message after 6 seconds
  useEffect(() => {
    if (!infoMessage) return;
    const timer = setTimeout(() => {
      setInfoMessage('');
    }, 6000);
    return () => clearTimeout(timer);
  }, [infoMessage]);

  // Redirect to dashboard if already authenticated or upon email confirmation
  useEffect(() => {
    const user = authService.getUserSync();
    if (user) {
      if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
      return;
    }

    const unsubscribe = authService.onAuthStateChange((newUser) => {
      if (newUser) {
        if (newUser.role === 'admin') {
          navigate('/admin', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Compute password strength for signup
  const passwordStrength = useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return Math.min(score, 4);
  }, [password]);

  const strengthLabels = ['Too weak', 'Weak', 'Medium', 'Strong', 'Very strong'];
  const strengthColors = ['bg-line', 'bg-signal', 'bg-amber-500', 'bg-blueprint', 'bg-emerald-600'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    // Handle Forgot Password flow
    if (isForgot) {
      setIsLoading(true);
      try {
        const res = await authService.resetPassword(email);
        if (res.error) {
          setError(res.error);
        } else {
          setInfoMessage('Password recovery link sent! Please check your email inbox.');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to send recovery email.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        const res = await authService.signUp(email, password, name);
        if (res.error) {
          const lower = res.error.toLowerCase();
          // Only show as green info if it's truly a success notice without errors
          if (!lower.includes('error') && (lower.includes('check your email') || lower.startsWith('account created'))) {
            setInfoMessage(res.error);
            setIsLoading(false);
            return;
          }
          setError(res.error);
          setIsLoading(false);
          return;
        }
        if (res.user) {
          if (res.user.role === 'admin') {
            navigate('/admin');
          } else {
            navigate('/dashboard');
          }
        }
      } else {
        const res = await authService.signIn(email, password);
        if (res.error) {
          setError(res.error);
          setIsLoading(false);
          return;
        }
        if (res.user?.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Authentication failed. Please try again.';
      setError(errorMsg);
      setIsLoading(false);
    }
  };

  const handleOAuth = async (provider: 'Google' | 'GitHub') => {
    setIsLoading(true);
    setError('');
    try {
      const res = await authService.signInWithOAuth(provider.toLowerCase() as 'google' | 'github');
      if (res.error) {
        setError(res.error);
        setIsLoading(false);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : `${provider} sign-in failed.`;
      setError(errorMsg);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-center items-center p-4 sm:p-6 text-ink selection:bg-blueprint selection:text-white">
      <div className="w-full max-w-[420px] flex flex-col gap-5">
        {/* Brand Header */}
        <div 
          onClick={() => navigate('/')} 
          className="flex items-center justify-center cursor-pointer group select-none"
        >
          <Logo size="lg" />
        </div>

        {/* Tab Switcher (Only shown in signin/signup modes) */}
        {!isForgot ? (
          <div className="border border-line bg-paper p-1 grid grid-cols-2 gap-1 text-[13px] font-medium">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setError('');
                setInfoMessage('');
              }}
              className={`py-2 px-3 flex items-center justify-center font-semibold transition-colors cursor-pointer border ${
                authMode === 'signin' 
                  ? 'bg-ink text-paper border-ink shadow-sm' 
                  : 'bg-transparent text-ink-soft border-transparent hover:text-ink hover:bg-paper-raised'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setError('');
                setInfoMessage('');
              }}
              className={`py-2 px-3 flex items-center justify-center font-semibold transition-colors cursor-pointer border ${
                authMode === 'signup' 
                  ? 'bg-ink text-paper border-ink shadow-sm' 
                  : 'bg-transparent text-ink-soft border-transparent hover:text-ink hover:bg-paper-raised'
              }`}
            >
              Create Account
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between border-b border-line pb-2 font-mono text-[12px]">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setError('');
                setInfoMessage('');
              }}
              className="text-blueprint hover:underline cursor-pointer flex items-center gap-1"
            >
              ← back_to_login()
            </button>
            <span className="text-ink-soft">// password_recovery</span>
          </div>
        )}

        {/* Main Card */}
        <Card variant="blueprint" className="p-6 sm:p-7 shadow-hard-ink">
          <div className="mb-5">
            <div className="flex items-center gap-2">
              {isForgot && <KeyRound className="w-5 h-5 text-blueprint" />}
              <h2 className="text-[20px] font-bold tracking-tight font-sans text-ink">
                {isForgot ? 'Reset your password' : isSignUp ? 'Create your account' : 'Welcome back'}
              </h2>
            </div>
            <p className="text-[13px] text-ink-soft mt-1 font-mono">
              {isForgot 
                ? '// enter your registered email to receive recovery instructions'
                : isSignUp 
                  ? '// sign up to start designing and saving diagrams' 
                  : '// enter your credentials to access your workspace'}
            </p>
          </div>

          {!authService.isConfigured() && (
            <div className="bg-amber-50 border-2 border-amber-400 text-amber-950 p-3 text-[12px] font-mono mb-4 flex flex-col gap-1 shadow-sm">
              <span className="font-bold flex items-center gap-1.5 text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                Supabase Setup Required
              </span>
              <span className="text-[11.5px] text-amber-800">
                Add your <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong> to your <code>.env</code> file to enable live user authentication.
              </span>
            </div>
          )}

          {error && (
            <div className="bg-signal/10 border border-signal text-signal p-3 text-[13px] flex items-start justify-between gap-2 mb-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError('')}
                className="text-signal hover:opacity-70 transition-opacity p-0.5 shrink-0 cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {infoMessage && (
            <div className="bg-emerald-50 border border-emerald-600 text-emerald-800 p-3 text-[13px] flex items-start justify-between gap-2 mb-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{infoMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setInfoMessage('')}
                className="text-emerald-800 hover:opacity-70 transition-opacity p-0.5 shrink-0 cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* If Sign Up: Full Name */}
            {isSignUp && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-ink-soft" htmlFor="name">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-line bg-paper pl-9 pr-3 py-2 text-[14px] focus:border-ink focus:outline-none placeholder-ink-soft/50"
                    placeholder="e.g. Jane Doe"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-ink-soft" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-line bg-paper pl-9 pr-3 py-2 text-[14px] focus:border-ink focus:outline-none placeholder-ink-soft/50"
                  placeholder="you@example.com"
                  autoFocus={isForgot}
                />
              </div>
            </div>

            {/* Password (Hidden in Forgot Password mode) */}
            {!isForgot && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-medium text-ink-soft" htmlFor="password">
                    Password
                  </label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('forgot');
                        setError('');
                        setInfoMessage('');
                      }}
                      className="text-[11px] font-mono text-blueprint hover:underline cursor-pointer bg-transparent border-none p-0"
                    >
                      forgot_password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-line bg-paper pl-9 pr-10 py-2 text-[14px] focus:border-ink focus:outline-none placeholder-ink-soft/50"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink cursor-pointer bg-transparent border-none p-0"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password strength indicator in signup */}
                {isSignUp && password.length > 0 && (
                  <div className="mt-1 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] text-ink-soft">
                      <span>Password strength:</span>
                      <span className="font-semibold text-ink">{strengthLabels[passwordStrength]}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 h-1 w-full bg-paper border border-line">
                      {[1, 2, 3, 4].map((step) => (
                        <div 
                          key={step} 
                          className={`h-full transition-colors ${
                            passwordStrength >= step ? strengthColors[passwordStrength] : 'bg-transparent'
                          }`} 
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button 
              type="submit" 
              variant="primary" 
              disabled={isLoading}
              className="w-full mt-1 flex items-center justify-center gap-2 py-2.5 font-bold"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-paper border-t-transparent animate-spin" />
                  Please wait...
                </span>
              ) : (
                <>
                  <span>
                    {isForgot ? 'Send Recovery Link' : isSignUp ? 'Create Account' : 'Sign In'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>

            {isForgot && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setError('');
                    setInfoMessage('');
                  }}
                  className="text-[12px] font-mono text-ink-soft hover:text-ink cursor-pointer bg-transparent border-none"
                >
                  ← back_to_login()
                </button>
              </div>
            )}
          </form>

          {/* Social Sign In (Only in signin/signup modes) */}
          {!isForgot && (
            <>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-line" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wider font-mono">
                  <span className="bg-paper px-2 text-ink-soft">Or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleOAuth('Google')}
                  className="border border-line hover:border-ink bg-paper hover:bg-paper-raised py-2 px-3 flex items-center justify-center gap-2 text-[13px] font-medium text-ink transition-all cursor-pointer shadow-sm active:translate-y-0.5"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Google</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOAuth('GitHub')}
                  className="border border-line hover:border-ink bg-paper hover:bg-paper-raised py-2 px-3 flex items-center justify-center gap-2 text-[13px] font-medium text-ink transition-all cursor-pointer shadow-sm active:translate-y-0.5"
                >
                  <svg className="w-4 h-4 shrink-0 fill-current text-ink" viewBox="0 0 24 24">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    />
                  </svg>
                  <span>GitHub</span>
                </button>
              </div>
            </>
          )}
        </Card>

        {/* Return Home Link */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-center text-[13px] text-ink-soft hover:text-ink cursor-pointer hover:underline bg-transparent border-none outline-none py-1"
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
};
