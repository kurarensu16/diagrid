import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Folder, Compass, Settings, LogOut, HelpCircle, Heart } from 'lucide-react';
import { mockAuth, useCurrentUser } from '../../services/mockAuth';
import { adminService } from '../../services/adminService';
import { Avatar } from '../ui/Avatar';
import { Logo } from '../ui/Logo';
import { FeedbackModal } from '../ui/FeedbackModal';
import { SupportModal } from '../ui/SupportModal';
import { offlineSyncService } from '../../services/offlineSyncService';

export const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isSupportEnabled, setIsSupportEnabled] = useState(false);
  const [githubUrl, setGithubUrl] = useState('https://github.com/kurarensu16/diagrid');

  useEffect(() => {
    adminService.getSystemSettings().then((s) => {
      if (s.github_repo_url) setGithubUrl(s.github_repo_url);
      setIsSupportEnabled(s.creator_wallets_enabled !== false);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const retryWhenOnline = () => { void offlineSyncService.syncPending(); };
    window.addEventListener('online', retryWhenOnline);
    return () => window.removeEventListener('online', retryWhenOnline);
  }, []);

  const handleLogout = () => {
    mockAuth.logout();
    navigate('/');
  };

  const menuItems = [
    { label: 'projects', path: '/dashboard', icon: Folder },
    { label: 'templates', path: '/templates', icon: Compass },
    { label: 'settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="h-screen flex flex-col bg-paper overflow-hidden">
      {/* Top Header navbar */}
      <nav className="h-[64px] border-b border-line flex items-center justify-between px-8 bg-paper-raised select-none z-10">
        <Link to="/" className="flex items-center gap-2 select-none group">
          <Logo size="md" />
        </Link>
        
        <div className="flex items-center gap-3 font-mono text-[12px] text-ink-soft">
          {/* Support Creator Pill (Red Theme) */}
          {isSupportEnabled && (
            <button
              onClick={() => setIsSupportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-500/50 hover:border-rose-600 bg-rose-500/5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold transition-all cursor-pointer"
              title="Support Diagrid Creator & Unlock Perks"
            >
              <Heart className="w-3.5 h-3.5 text-rose-600 fill-rose-600" />
              <span>support_creator()</span>
            </button>
          )}

          {user ? (
            <Link
              to="/settings"
              className="flex items-center gap-2.5 px-3 py-1.5 border border-line hover:border-ink bg-paper hover:bg-paper-raised transition-all group"
              title="Open Profile Settings"
            >
              <Avatar user={user} size="xs" showStatus={true} statusOnline={true} />
              <div className="flex items-center gap-2">
                <span className="text-ink font-bold group-hover:text-blueprint transition-colors">
                  {user.name || user.email.split('@')[0]}
                </span>

                {/* Supporter Badge (Red Theme) */}
                {user.isSupporter && (
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 border border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-500/10 flex items-center gap-1">
                    <Heart className="w-2.5 h-2.5 fill-rose-600 text-rose-600" />
                    SUPPORTER
                  </span>
                )}

                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 border ${
                  user.role === 'admin' 
                    ? 'border-signal text-signal bg-signal/5' 
                    : 'border-line text-ink-soft bg-paper-raised'
                }`}>
                  {user.role}
                </span>
              </div>
            </Link>
          ) : (
            <Link 
              to="/auth" 
              className="border border-ink px-4 py-1.5 text-ink hover:bg-ink hover:text-paper transition-colors"
            >
              sign_in()
            </Link>
          )}
        </div>
      </nav>

      {/* Main Body with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-[240px] border-r border-line bg-paper flex flex-col justify-between py-6 select-none overflow-hidden shrink-0">
          <div className="flex flex-col gap-1 px-4">
            <div className="font-mono text-[11px] text-blueprint tracking-wider px-3 mb-2">// workspace_nav</div>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path === '/dashboard' && location.pathname.startsWith('/project/'));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 font-mono text-[13px] border transition-colors ${
                    isActive
                      ? 'bg-ink text-paper border-ink'
                      : 'text-ink-soft border-transparent hover:text-ink hover:bg-paper-raised hover:border-line'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Bottom sidebar actions: Support, Feedback, GitHub & Sign Out */}
          <div className="px-4 border-t border-line pt-4 mx-4 flex flex-col gap-2">
            {isSupportEnabled && (
              <button
                onClick={() => setIsSupportOpen(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 font-mono text-[12px] border border-rose-500/40 hover:border-rose-600 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer text-left group font-bold"
                title="Support the Creator"
              >
                <Heart className="w-4 h-4 text-rose-600 fill-rose-600 shrink-0 group-hover:scale-110 transition-transform" />
                <span className="font-medium">support_creator()</span>
              </button>
            )}

            <button
              onClick={() => setIsFeedbackOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 font-mono text-[12px] border border-line hover:border-blueprint hover:bg-paper-raised text-ink transition-colors cursor-pointer text-left group"
              title="Send feedback or get support"
            >
              <HelpCircle className="w-4 h-4 text-blueprint shrink-0 group-hover:scale-105 transition-transform" />
              <span className="group-hover:text-blueprint transition-colors font-medium">Feedback & help</span>
            </button>

            {/* Admin-Managed GitHub Link */}
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-2.5 px-3 py-2 font-mono text-[12px] border border-line hover:border-ink hover:bg-paper-raised text-ink transition-colors cursor-pointer text-left group"
              title="View on GitHub"
            >
              <svg className="w-4 h-4 fill-current text-ink-soft group-hover:text-ink shrink-0" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span className="group-hover:text-ink transition-colors font-medium">github_repo()</span>
            </a>

            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-1.5 hover:text-signal hover:border-signal transition-colors text-ink uppercase border border-line px-3 py-2 bg-paper font-mono text-[12px] cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              sign_out()
            </button>
          </div>
        </aside>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto bg-paper flex flex-col">
          <Outlet />
        </main>
      </div>

      {/* In-app Feedback & Support Modal */}
      <FeedbackModal 
        isOpen={isFeedbackOpen} 
        onClose={() => setIsFeedbackOpen(false)} 
      />

      {/* Support Creator Modal */}
      <SupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />
    </div>
  );
};
