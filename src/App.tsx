import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Auth } from './pages/Auth';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { ProjectDetail } from './pages/ProjectDetail';
import { Editor } from './pages/Editor';
import { Templates } from './pages/Templates';
import { Settings } from './pages/Settings';
import { Docs } from './pages/Docs';
import { PublicViewer } from './pages/PublicViewer';
import { EmbedWidget } from './pages/EmbedWidget';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { NotFound } from './pages/NotFound';
import { Forbidden } from './pages/Forbidden';
import { ServerError } from './pages/ServerError';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { useCurrentUser, useAuthSession } from './services/mockAuth';
import { authService } from './services/authService';
import { themeService } from './services/themeService';
import { Avatar } from './components/ui/Avatar';
import { Logo } from './components/ui/Logo';
import { Menu, X } from 'lucide-react';

// Global theme sync handler: Keeps landing and public pages in classic blueprint mode, and applies user theme only to app workspace routes
const ThemeSyncHandler: React.FC = () => {
  const user = useCurrentUser();
  const location = useLocation();

  useEffect(() => {
    themeService.applyCurrentRouteTheme(user?.theme, Boolean(user));
  }, [user, user?.theme, location.pathname]);

  return null;
};

// Global auth redirect handler for incoming email confirmation links
const AuthRedirectHandler: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if the current URL hash contains an auth redirect (e.g. from confirmation email)
    const hash = window.location.hash;
    if (hash && (hash.includes('access_token=') || hash.includes('type=signup') || hash.includes('type=recovery') || hash.includes('type=invite'))) {
      const isRecovery = hash.includes('type=recovery');
      const unsubscribe = authService.onAuthStateChange((user) => {
        if (user) {
          if (isRecovery) {
            navigate('/reset-password', { replace: true });
          } else if (user.role === 'admin') {
            navigate('/admin', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        }
      });
      return () => unsubscribe();
    }
  }, [navigate]);

  return null;
};

// Route Guard to protect workspace pages (normal users only)
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuthSession();
  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center font-mono text-sm text-ink-muted">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-blueprint border-t-transparent rounded-full animate-spin"></div>
          <span>loading_workspace...</span>
        </div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  // Admins do not have a user workspace; route directly to admin portal
  if (user.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
};

// Route Guard to protect admin pages (administrators only)
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuthSession();
  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center font-mono text-sm text-ink-muted">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-signal border-t-transparent rounded-full animate-spin"></div>
          <span>verifying_admin_access...</span>
        </div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  if (user.role !== 'admin') {
    return <Navigate to="/403" replace />;
  }
  return <>{children}</>;
};

// Admin imports
import { AdminLayout } from './components/layout/AdminLayout';
import { AdminOverview } from './pages/admin/AdminOverview';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminStorage } from './pages/admin/AdminStorage';
import { AdminFeedbackPage } from './pages/admin/AdminFeedback';
import { AdminActivity } from './pages/admin/AdminActivity';
import { AdminSystem } from './pages/admin/AdminSystem';

// Public App Layout for guest users (no dashboard sidebar navigation)
const PublicAppLayout = () => {
  const user = useCurrentUser();
  const location = useLocation();

  const isTemplates = location.pathname === '/templates';
  const isDocs = location.pathname === '/docs';
  const [isNavOpen, setIsNavOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-paper text-ink select-none">
      <nav className="relative flex justify-between items-center py-3 sm:py-4 px-4 sm:px-8 lg:px-12 border-b-2 border-ink bg-[#15191C] text-paper sticky top-0 z-30 shadow-md">
        <Link to="/" className="flex items-center gap-2 text-paper hover:text-white transition-colors group">
          <Logo variant="paper" size="md" />
        </Link>
        <div className="hidden md:flex gap-8 text-[13px] text-[#A6B2AD] font-mono">
          <Link to="/templates" className={`${isTemplates ? 'text-white font-bold' : 'hover:text-white transition-colors'}`}>
            // templates
          </Link>
          <Link to="/docs" className={`${isDocs ? 'text-white font-bold' : 'hover:text-white transition-colors'}`}>
            // docs
          </Link>
          <Link to="/" className="hover:text-white transition-colors">// home</Link>
        </div>
        {user ? (
          <div className="flex items-center gap-3">
            <Link 
              to="/settings" 
              className="flex items-center gap-2 hover:opacity-80 transition-opacity" 
              title="Profile Settings"
            >
              <Avatar user={user} size="xs" showStatus={true} statusOnline={true} />
              <span className="font-mono text-[12px] text-[#A6B2AD] hidden sm:inline">
                {user.name || user.email.split('@')[0]}
              </span>
            </Link>
            <Link 
              to={user.role === 'admin' ? "/admin" : "/dashboard"} 
              className="font-mono text-[11px] sm:text-[12px] border border-paper text-paper px-2.5 sm:px-4 py-1.5 hover:bg-paper hover:text-ink transition-colors font-bold"
            >
              {user.role === 'admin' ? 'admin_portal()' : 'dashboard()'}
            </Link>
          </div>
        ) : (
          <Link to="/auth" className="font-mono text-[11px] sm:text-[12px] bg-blueprint text-paper border border-blueprint px-2.5 sm:px-4 py-1.5 hover:bg-white hover:text-ink hover:border-white transition-colors font-bold">
            sign_in()
          </Link>
        )}
        <button
          type="button"
          onClick={() => setIsNavOpen((open) => !open)}
          className="md:hidden p-2 border border-[#A6B2AD] text-paper cursor-pointer"
          aria-label={isNavOpen ? 'Close site navigation' : 'Open site navigation'}
          aria-expanded={isNavOpen}
        >
          {isNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
        {isNavOpen && (
          <div className="absolute top-full left-0 right-0 md:hidden border-b-2 border-ink bg-[#15191C] px-4 py-3 shadow-md">
            <div className="flex flex-col gap-1 text-[13px] text-[#A6B2AD] font-mono">
              <Link onClick={() => setIsNavOpen(false)} to="/templates" className="px-3 py-3 hover:bg-white/10 hover:text-white">// templates</Link>
              <Link onClick={() => setIsNavOpen(false)} to="/docs" className="px-3 py-3 hover:bg-white/10 hover:text-white">// docs</Link>
              <Link onClick={() => setIsNavOpen(false)} to="/" className="px-3 py-3 hover:bg-white/10 hover:text-white">// home</Link>
            </div>
          </div>
        )}
      </nav>
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
      <footer className="py-5 sm:py-7 px-4 sm:px-12 flex flex-col sm:flex-row gap-2 sm:gap-0 sm:justify-between font-mono text-[11px] sm:text-[12px] text-[#9AA5A0] bg-[#101417] border-t-2 border-ink shrink-0">
        <span className="text-white font-bold">diagrid — build_v0.1</span>
        <span>made for people who'd rather drag than type</span>
      </footer>
    </div>
  );
};

// Wrapper that chooses DashboardLayout (with sidebar) if normal user, or PublicAppLayout if admin/guest
const DynamicLayoutWrapper = () => {
  const user = useCurrentUser();
  if (user?.role === 'admin') {
    return <PublicAppLayout />;
  }
  return user ? <DashboardLayout /> : <PublicAppLayout />;
};

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AppErrorBoundary] Unhandled render exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ServerError 
          error={this.state.error || undefined} 
          resetErrorBoundary={() => this.setState({ hasError: false, error: null })} 
        />
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <ThemeSyncHandler />
        <AuthRedirectHandler />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />

          {/* Public Read-Only Blueprint Viewer & Embed Routes */}
          <Route path="/view/:id" element={<PublicViewer />} />
          <Route path="/share/:id" element={<PublicViewer />} />
          <Route path="/embed/:id" element={<EmbedWidget />} />

          {/* Publicly viewable Templates wrapped dynamically */}
          <Route element={<DynamicLayoutWrapper />}>
            <Route path="/templates" element={<Templates />} />
          </Route>

          {/* Public Docs layout: accessed from outside without workspace sidebar */}
          <Route element={<PublicAppLayout />}>
            <Route path="/docs" element={<Docs />} />
          </Route>

          {/* Workspace protected layout routes (normal users only) */}
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/project/:id" element={<ProjectDetail />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* Standalone layout protected routes */}
          <Route
            path="/editor/:id"
            element={
              <ProtectedRoute>
                <Editor />
              </ProtectedRoute>
            }
          />

          {/* Admin protected layout routes */}
          <Route
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route path="/admin" element={<AdminOverview />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/storage" element={<AdminStorage />} />
            <Route path="/admin/content" element={<Navigate to="/admin/storage" replace />} />
            <Route path="/admin/feedback" element={<AdminFeedbackPage />} />
            <Route path="/admin/activity" element={<AdminActivity />} />
            <Route path="/admin/system" element={<AdminSystem />} />
          </Route>

          {/* Security and Error Pages */}
          <Route path="/403" element={<Forbidden />} />
          <Route path="/500" element={<ServerError />} />
          <Route path="/404" element={<NotFound />} />

          {/* Catch-all fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;
