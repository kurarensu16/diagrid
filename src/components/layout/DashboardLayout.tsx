import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Folder, Compass, Settings, LogOut, HelpCircle } from 'lucide-react';
import { mockAuth, useCurrentUser } from '../../services/mockAuth';
import { Avatar } from '../ui/Avatar';
import { Logo } from '../ui/Logo';
import { FeedbackModal } from '../ui/FeedbackModal';

export const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

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
        
        <div className="flex items-center gap-4 font-mono text-[12px] text-ink-soft">
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

          {/* Bottom sidebar actions: Feedback & Support + Sign Out */}
          <div className="px-4 border-t border-line pt-4 mx-4 flex flex-col gap-2.5">
            <button
              onClick={() => setIsFeedbackOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 font-mono text-[12px] border border-line hover:border-blueprint hover:bg-paper-raised text-ink transition-colors cursor-pointer text-left group"
              title="Send feedback or get support"
            >
              <HelpCircle className="w-4 h-4 text-blueprint shrink-0 group-hover:scale-105 transition-transform" />
              <span className="group-hover:text-blueprint transition-colors font-medium">feedback_support()</span>
            </button>

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
    </div>
  );
};

