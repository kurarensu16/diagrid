import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, X, ArrowRight, KeyRound } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';
import { authService } from '../services/authService';

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLinkExpired, setIsLinkExpired] = useState(false);
  const [success, setSuccess] = useState(false);

  // Check URL hash for error parameters (e.g. otp_expired)
  useEffect(() => {
    const raw = window.location.hash || window.location.search;
    if (raw) {
      const clean = raw.replace(/^[#?]/, '');
      const params = new URLSearchParams(clean);
      const errorCode = params.get('error_code');
      const errorDesc = params.get('error_description');
      if (errorCode === 'otp_expired' || errorDesc?.toLowerCase().includes('expired') || errorDesc?.toLowerCase().includes('invalid')) {
        setIsLinkExpired(true);
        setError('This recovery link is invalid or has expired. Please request a new recovery link.');
      } else if (errorDesc) {
        setError(decodeURIComponent(errorDesc.replace(/\+/g, ' ')));
      }
    }
  }, []);

  // Auto-dismiss error after 6s unless link expired
  useEffect(() => {
    if (!error || isLinkExpired) return;
    const timer = setTimeout(() => setError(''), 6000);
    return () => clearTimeout(timer);
  }, [error, isLinkExpired]);

  // Compute password strength
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

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const { error: updateError } = await authService.updatePassword(password);
      if (updateError) {
        setError(updateError);
      } else {
        setSuccess(true);
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 2200);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-between p-4 sm:p-6 text-ink selection:bg-blueprint selection:text-paper">
      {/* Header with [+] Logo */}
      <header className="flex justify-between items-center max-w-5xl mx-auto w-full py-4 border-b border-line">
        <Link to="/" className="cursor-pointer hover:opacity-85 transition-opacity">
          <Logo size="md" />
        </Link>
        <span className="font-mono text-[11px] text-ink-soft">// password_recovery</span>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center py-8">
        <div className="w-full max-w-[420px]">
          <Card variant="blueprint" className="p-8">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <KeyRound className="w-5 h-5 text-blueprint" />
                <h1 className="text-[24px] font-bold tracking-tight">set_new_password()</h1>
              </div>
              <p className="text-[12px] text-ink-soft font-mono">
                // enter your new secure account credentials
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-3 bg-signal/10 border border-signal text-signal text-[12px] font-mono flex items-center justify-between gap-2 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>ERROR: {error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setError('')}
                  className="hover:opacity-75 p-0.5 cursor-pointer shrink-0"
                  title="Dismiss error"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Success Message */}
            {success ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-600 text-emerald-800 text-[13px] font-mono flex flex-col items-center text-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 animate-bounce" />
                <div>
                  <strong className="block text-ink">Password Updated Successfully!</strong>
                  <span className="text-[12px] text-ink-soft">Redirecting you to the dashboard...</span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* New Password */}
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[11px] text-ink-soft">NEW_PASSWORD</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-ink-soft absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full border border-line bg-paper pl-9 pr-10 py-2 text-[14px] font-mono focus:border-ink focus:outline-none"
                      placeholder="min. 6 characters"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Meter */}
                  {password && (
                    <div className="mt-1.5 flex flex-col gap-1">
                      <div className="flex gap-1 h-1">
                        {[1, 2, 3, 4].map((step) => (
                          <div
                            key={step}
                            className={`flex-1 transition-colors duration-200 ${
                              step <= passwordStrength ? strengthColors[passwordStrength] : 'bg-line/40'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] font-mono text-ink-soft text-right">
                        strength: {strengthLabels[passwordStrength]}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[11px] text-ink-soft">CONFIRM_PASSWORD</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-ink-soft absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full border border-line bg-paper pl-9 pr-10 py-2 text-[14px] font-mono focus:border-ink focus:outline-none"
                      placeholder="re-enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink cursor-pointer"
                      title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isLinkExpired && (
                  <div className="p-3 bg-amber-500/10 border border-amber-600 text-amber-900 text-[12px] font-mono flex flex-col gap-2">
                    <span>This link has expired. You can request a fresh reset email right now:</span>
                    <Link
                      to="/auth"
                      className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-ink text-paper text-[11px] font-bold hover:bg-ink-light"
                    >
                      request_new_link() →
                    </Link>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 flex items-center justify-center gap-2 mt-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-paper border-t-transparent rounded-full animate-spin"></div>
                      updating_password()...
                    </>
                  ) : (
                    <>
                      commit_password()
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            )}

            <div className="mt-6 pt-4 border-t border-line text-center">
              <Link to="/auth" className="text-[12px] font-mono text-blueprint hover:underline">
                ← back_to_login()
              </Link>
            </div>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full py-4 text-center font-mono text-[11px] text-ink-soft border-t border-line">
        [+] diagrid architecture ide // encrypted session
      </footer>
    </div>
  );
};
