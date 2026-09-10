import React from 'react';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '../services/mockAuth';
import { Logo } from '../components/ui/Logo';

export const ServerError: React.FC<{ error?: Error | string; resetErrorBoundary?: () => void }> = ({ 
  resetErrorBoundary
}) => {
  const user = useCurrentUser();

  const homeTarget = user
    ? (user.role === 'admin' ? '/admin' : '/dashboard')
    : '/';

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
            500 error
          </span>

          <h1 className="font-mono text-6xl font-bold tracking-tight text-ink mb-3">
            500
          </h1>

          <h2 className="text-xl font-bold tracking-tight text-ink mb-2">
            Something went wrong
          </h2>

          <p className="text-sm text-ink-muted leading-relaxed mb-8 max-w-sm">
            An unexpected error occurred while processing your request. Please try reloading the page.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={() => {
                if (resetErrorBoundary) {
                  resetErrorBoundary();
                } else {
                  window.location.reload();
                }
              }}
              className="flex-1 py-2.5 px-4 bg-ink text-paper hover:bg-blueprint font-mono text-xs font-bold transition-colors border border-ink text-center cursor-pointer"
            >
              Reload Page
            </button>

            <Link
              to={homeTarget}
              className="py-2.5 px-5 bg-paper text-ink hover:bg-paper-raised font-mono text-xs border border-line hover:border-ink transition-colors text-center"
            >
              {user?.role === 'admin' ? 'Back to Admin' : user ? 'Back to Dashboard' : 'Back to Home'}
            </Link>
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
