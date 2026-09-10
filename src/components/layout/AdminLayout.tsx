import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  BarChart2, 
  Users, 
  Database, 
  Activity, 
  Sliders, 
  ArrowLeft, 
  LogOut,
  ShieldAlert,
  MessageSquare
} from 'lucide-react';
import { mockAuth, useCurrentUser } from '../../services/mockAuth';
import { Avatar } from '../ui/Avatar';
import { Logo } from '../ui/Logo';

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useCurrentUser();

  const handleLogout = () => {
    mockAuth.logout();
    navigate('/');
  };

  const adminMenuItems = [
    { label: 'overview', path: '/admin', icon: BarChart2 },
    { label: 'users', path: '/admin/users', icon: Users },
    { label: 'content', path: '/admin/content', icon: Database },
    { label: 'feedback', path: '/admin/feedback', icon: MessageSquare },
    { label: 'activity_log', path: '/admin/activity', icon: Activity },
    { label: 'system_settings', path: '/admin/system', icon: Sliders },
  ];

  return (
    <div className="h-screen flex flex-col bg-paper overflow-hidden text-ink">
      {/* Admin Top Navbar Header */}
      <nav className="h-[64px] border-b border-line flex items-center justify-between px-8 bg-paper-raised select-none z-10">
        <div className="flex items-center gap-3">
          <Link to="/admin" className="flex items-center gap-2 select-none group">
            <Logo size="md" />
          </Link>
          <span className="font-mono text-[10px] text-signal border border-signal px-1.5 py-0.5 uppercase tracking-wider font-bold flex items-center gap-1 animate-pulse">
            <ShieldAlert className="w-3 h-3" />
            admin_console
          </span>
        </div>
        
        <div className="flex items-center gap-5 font-mono text-[12px] text-ink-soft">
          {user && (
            <Link
              to="/settings"
              className="flex items-center gap-2 px-2.5 py-1 border border-line hover:border-signal bg-paper hover:bg-paper-raised transition-all group"
              title="Admin Profile Settings"
            >
              <Avatar user={user} size="xs" showStatus={true} statusOnline={true} />
              <span className="text-ink font-bold group-hover:text-signal transition-colors">
                {user.name || user.email.split('@')[0]}
              </span>
              <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 border border-signal text-signal bg-signal/5">
                ADMIN
              </span>
            </Link>
          )}

          <Link 
            to="/" 
            className="flex items-center gap-1 text-ink-soft hover:text-ink transition-colors"
            title="View public site"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            view_site()
          </Link>
        </div>
      </nav>

      {/* Main split grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Nav */}
        <aside className="w-[240px] border-r border-line bg-paper flex flex-col justify-between py-6 select-none overflow-hidden shrink-0">
          <div className="flex flex-col gap-1 px-4">
            <div className="font-mono text-[11px] text-signal tracking-wider px-3 mb-2">// admin_nav</div>
            {adminMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 font-mono text-[13px] border transition-colors ${
                    isActive
                      ? 'bg-ink text-paper border-ink shadow-hard-signal'
                      : 'text-ink-soft border-transparent hover:text-ink hover:bg-paper-raised hover:border-line'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="px-4 border-t border-line pt-4 mx-4">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-1.5 hover:text-signal hover:border-signal transition-colors text-ink uppercase border border-line px-3 py-2 bg-paper font-mono text-[12px] cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              sign_out()
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-paper flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

