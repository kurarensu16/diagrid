import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';
import { authService } from '../services/authService';
import { adminService } from '../services/adminService';
import { Wrench, RefreshCw, Shield, LogOut } from 'lucide-react';

export const Maintenance: React.FC = () => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const currentUser = authService.getUserSync();

  const handleCheckStatus = async () => {
    setIsChecking(true);
    setNotice(null);
    try {
      const settings = await adminService.getSystemSettings();
      if (!settings.maintenance_mode) {
        if (currentUser?.role === 'admin') {
          navigate('/admin', { replace: true });
        } else if (currentUser) {
          navigate('/dashboard', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else {
        setNotice('Maintenance is still ongoing. Please check back in a few minutes.');
      }
    } catch {
      setNotice('Could not verify platform status. Retrying soon.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleSignOut = async () => {
    await authService.signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col justify-between selection:bg-blueprint selection:text-white font-sans">
      {/* Header */}
      <header className="h-[64px] border-b border-line px-8 flex items-center justify-between bg-paper select-none">
        <Link to="/" className="flex items-center gap-2 select-none group">
          <Logo size="md" />
        </Link>
        {currentUser?.role === 'admin' && (
          <Link
            to="/admin"
            className="flex items-center gap-1.5 font-mono text-[11px] font-bold border border-signal text-signal px-3 py-1.5 hover:bg-signal hover:text-paper transition-colors"
          >
            <Shield className="w-3.5 h-3.5" />
            admin_console()
          </Link>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none"></div>

        <div className="w-full max-w-[500px] bg-paper border-2 border-ink shadow-hard-ink p-8 sm:p-10 relative z-10 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full border-2 border-signal/40 bg-signal/10 flex items-center justify-center text-signal mb-4">
            <Wrench className="w-6 h-6 animate-pulse" />
          </div>

          <span className="font-mono text-xs text-signal font-bold uppercase tracking-wider border border-signal/30 bg-signal/5 px-2.5 py-1 mb-3">
            // maintenance_mode_active
          </span>

          <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-ink mb-3">
            platform_under_maintenance()
          </h1>

          <p className="text-[13px] text-ink-muted leading-relaxed mb-6 font-mono">
            Diagrid is currently undergoing scheduled platform upgrades and database maintenance. Workspace access and canvas editing are temporarily frozen to ensure absolute data integrity.
          </p>

          {notice && (
            <div className="w-full p-2.5 mb-5 border border-line bg-paper-raised font-mono text-[11.5px] text-ink">
              {notice}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 w-full font-mono text-[12px]">
            <button
              onClick={handleCheckStatus}
              disabled={isChecking}
              className="flex-1 py-2.5 px-4 bg-ink text-paper hover:bg-blueprint font-bold transition-colors border border-ink flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'checking...' : 'check_status()'}</span>
            </button>

            {currentUser && (
              <button
                onClick={handleSignOut}
                className="py-2.5 px-4 bg-paper text-ink hover:text-signal hover:border-signal font-bold border border-line transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>sign_out()</span>
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 px-8 border-t border-line text-center font-mono text-xs text-ink-muted select-none">
        diagrid // scheduled_maintenance
      </footer>
    </div>
  );
};
