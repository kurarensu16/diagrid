import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mockAuth, useCurrentUser } from '../services/mockAuth';
import { Logo } from '../components/ui/Logo';

export const Forbidden: React.FC = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();

  const handleSignOut = () => {
    mockAuth.logout();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col justify-between selection:bg-signal selection:text-white font-sans">
      {/* Simple Header */}
      <header className="h-[64px] border-b border-line px-8 flex items-center justify-between bg-paper select-none">
        <Link to="/" className="flex items-center gap-2 select-none group">
          <Logo size="md" />
        </Link>
      </header>

      {/* Clean Centered Content */}
      <main className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none"></div>

        <div className="w-full max-w-[460px] bg-paper border border-ink shadow-hard-ink p-8 sm:p-10 relative z-10 flex flex-col items-center text-center">
          <span className="font-mono text-xs text-signal font-bold uppercase tracking-wider border border-signal/30 bg-signal/5 px-2.5 py-1 mb-4">
            403 error
          </span>

          <h1 className="font-mono text-6xl font-bold tracking-tight text-ink mb-3">
            403
          </h1>

          <h2 className="text-xl font-bold tracking-tight text-ink mb-2">
            Access denied
          </h2>

          <p className="text-sm text-ink-muted leading-relaxed mb-8 max-w-sm">
            You don't have permission to access this page. This section is restricted to administrators.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            {user ? (
              <Link
                to="/dashboard"
                className="flex-1 py-2.5 px-4 bg-ink text-paper hover:bg-blueprint font-mono text-xs font-bold transition-colors border border-ink text-center"
              >
                Back to Dashboard
              </Link>
            ) : (
              <Link
                to="/auth"
                className="flex-1 py-2.5 px-4 bg-ink text-paper hover:bg-blueprint font-mono text-xs font-bold transition-colors border border-ink text-center"
              >
                Sign In
              </Link>
            )}

            {user && (
              <button
                onClick={handleSignOut}
                className="py-2.5 px-5 bg-paper text-ink hover:text-signal hover:border-signal font-mono text-xs border border-line transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="py-4 px-8 border-t border-line text-center font-mono text-xs text-ink-muted select-none">
        diagrid
      </footer>
    </div>
  );
};
