import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';
import { authService } from '../services/authService';
import { ShieldAlert, LogOut, Mail } from 'lucide-react';

export const Deactivated: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = authService.getUserSync();

  const handleSignOut = async () => {
    await authService.signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col justify-between selection:bg-signal selection:text-white font-sans">
      {/* Header */}
      <header className="h-[64px] border-b border-line px-8 flex items-center justify-between bg-paper select-none">
        <Link to="/" className="flex items-center gap-2 select-none group">
          <Logo size="md" />
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none"></div>

        <div className="w-full max-w-[480px] bg-paper border-2 border-signal shadow-hard-ink p-8 sm:p-10 relative z-10 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full border-2 border-signal bg-signal/10 flex items-center justify-center text-signal mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>

          <span className="font-mono text-xs text-signal font-bold uppercase tracking-wider border border-signal/30 bg-signal/5 px-2.5 py-1 mb-3">
            // account_archived
          </span>

          <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-ink mb-3">
            account_deactivated()
          </h1>

          <p className="text-[13px] text-ink-muted leading-relaxed mb-6 font-mono">
            This developer account ({currentUser?.email || 'user'}) has been deactivated or archived by a platform administrator. Workspace access, diagram editing, and cloud synchronization have been suspended.
          </p>

          <div className="w-full p-3 mb-6 border border-line bg-paper-raised font-mono text-[11px] text-left text-ink-soft">
            <div>// status: <strong className="text-signal uppercase">suspended</strong></div>
            <div>// policy: <span className="text-ink">is_active_user() == false</span></div>
            <div className="mt-1 text-ink">// If you believe this was done in error, contact the platform administrators.</div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full font-mono text-[12px]">
            <button
              onClick={handleSignOut}
              className="flex-1 py-2.5 px-4 bg-ink text-paper hover:bg-signal font-bold transition-colors border border-ink flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>sign_out_session()</span>
            </button>

            <a
              href="mailto:support@diagrid.dev"
              className="py-2.5 px-4 bg-paper text-ink hover:bg-paper-raised font-bold border border-line transition-colors flex items-center justify-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5 text-blueprint" />
              <span>contact_support()</span>
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 px-8 border-t border-line text-center font-mono text-xs text-ink-muted select-none">
        diagrid // account_governance
      </footer>
    </div>
  );
};
