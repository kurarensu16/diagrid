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
import { Menu, X, MessageSquare } from 'lucide-react';
import { FeedbackModal } from './components/ui/FeedbackModal';

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
import { BroadcastBanner } from './components/ui/BroadcastBanner';
import { AdminLayout } from './components/layout/AdminLayout';
import { AdminOverview } from './pages/admin/AdminOverview';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminStorage } from './pages/admin/AdminStorage';
import { AdminFeedbackPage } from './pages/admin/AdminFeedback';
import { AdminSupporters } from './pages/admin/AdminSupporters';
import { AdminActivity } from './pages/admin/AdminActivity';
import { AdminSystem } from './pages/admin/AdminSystem';

// Public App Layout for guest users (identical navbar & footer to landing page)
const PublicAppLayout = () => {
  const user = useCurrentUser();
  const location = useLocation();

  const isTemplates = location.pathname === '/templates';
  const isDocs = location.pathname === '/docs';
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-paper text-ink select-none">
      {/* 0. High-Contrast Dark Top Navbar - Identical to Landing Page */}
      <nav className="relative flex justify-between items-center py-3 sm:py-4 px-4 sm:px-6 lg:px-12 border-b-2 border-ink bg-[#15191C] text-paper sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 select-none group text-paper hover:text-white transition-colors">
            <Logo variant="paper" size="md" />
            <span className="font-mono text-[10px] tracking-[0.18em] text-blueprint border-l border-[#2D363C] pl-2">
              STUDIO
            </span>
          </Link>
        </div>

        <div className="hidden lg:flex gap-8 text-[13px] text-[#A6B2AD] font-mono">
          <Link to="/#diagrams" className="hover:text-white transition-colors">Diagrams</Link>
          <Link to="/#how-it-works" className="hover:text-white transition-colors">How It Works</Link>
          <Link to="/#code-to-diagram" className="hover:text-white transition-colors">Code to Diagram</Link>
          <Link to="/#comparison" className="hover:text-white transition-colors">Why Diagrid?</Link>
          <Link to="/templates" className={`${isTemplates ? 'text-white font-bold' : 'hover:text-white transition-colors'}`}>Templates</Link>
          <Link to="/docs" className={`${isDocs ? 'text-white font-bold' : 'hover:text-white transition-colors'}`}>Help & Docs</Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 font-mono">
          {user ? (
            <div className="flex items-center gap-3">
              <Link 
                to="/settings" 
                className="flex items-center gap-2 hover:opacity-85 transition-opacity" 
                title="Profile Settings"
              >
                <Avatar user={user} size="xs" showStatus={true} statusOnline={true} />
                <span className="text-[#A6B2AD] text-[12px] hidden sm:inline">
                  {user.name || user.email.split('@')[0]}
                </span>
              </Link>
              <Link 
                to={user.role === 'admin' ? "/admin" : "/dashboard"} 
                className="text-[11px] sm:text-[12px] border border-paper text-paper px-2.5 sm:px-4 py-1.5 hover:bg-paper hover:text-ink transition-colors font-bold flex items-center gap-1.5 shadow-sm"
              >
                {user.role === 'admin' ? 'Admin Portal' : 'My Workspace'}
              </Link>
            </div>
          ) : (
            <Link 
              to="/auth" 
              className="text-[11px] sm:text-[12px] bg-blueprint text-paper border border-blueprint px-2.5 sm:px-4 py-1.5 hover:bg-white hover:text-ink hover:border-white transition-colors font-bold shadow-sm"
            >
              Sign In
            </Link>
          )}
          <button
            type="button"
            onClick={() => setIsNavOpen((open) => !open)}
            className="lg:hidden p-2 border border-[#A6B2AD] text-paper cursor-pointer"
            aria-label={isNavOpen ? 'Close site navigation' : 'Open site navigation'}
            aria-expanded={isNavOpen}
          >
            {isNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
        {isNavOpen && (
          <div className="absolute top-full left-0 right-0 lg:hidden border-b-2 border-ink bg-[#15191C] px-4 py-3 shadow-md">
            <div className="flex flex-col gap-1 text-[13px] text-[#A6B2AD] font-mono">
              <Link to="/#diagrams" onClick={() => setIsNavOpen(false)} className="px-3 py-3 hover:bg-white/10 hover:text-white">Diagrams</Link>
              <Link to="/#how-it-works" onClick={() => setIsNavOpen(false)} className="px-3 py-3 hover:bg-white/10 hover:text-white">How It Works</Link>
              <Link to="/#code-to-diagram" onClick={() => setIsNavOpen(false)} className="px-3 py-3 hover:bg-white/10 hover:text-white">Code to Diagram</Link>
              <Link to="/#comparison" onClick={() => setIsNavOpen(false)} className="px-3 py-3 hover:bg-white/10 hover:text-white">Why Diagrid?</Link>
              <Link to="/templates" onClick={() => setIsNavOpen(false)} className="px-3 py-3 hover:bg-white/10 hover:text-white">Templates</Link>
              <Link to="/docs" onClick={() => setIsNavOpen(false)} className="px-3 py-3 hover:bg-white/10 hover:text-white">Help & Docs</Link>
            </div>
          </div>
        )}
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>

      {/* 8. High-Contrast Dark Footer - Identical to Landing Page */}
      <footer className="py-6 sm:py-8 px-4 sm:px-8 lg:px-12 flex flex-col sm:flex-row justify-between items-center gap-4 font-mono text-[12px] bg-[#101417] text-[#9AA5A0] border-t-2 border-ink shrink-0">
        <div className="flex items-center gap-3">
          <Logo variant="paper" size="sm" />
          <span className="font-mono text-[9px] tracking-[0.18em] text-blueprint border-l border-[#2D363C] pl-2">
            STUDIO
          </span>
          <span>•</span>
          <span>Made for people who want neat diagrams without the hassle.</span>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-[12px]">
          <Link to="/#diagrams" className="hover:text-white transition-colors">Diagrams</Link>
          <Link to="/templates" className="hover:text-white transition-colors">Templates</Link>
          <Link to="/docs" className="hover:text-white transition-colors">Help & Docs</Link>
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
          <button
            onClick={() => setIsFeedbackOpen(true)}
            className="hover:text-white transition-colors text-[#9AA5A0] flex items-center gap-1.5 cursor-pointer bg-transparent border-none p-0 font-mono text-[12px]"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Feedback
          </button>
          <a
            href="https://github.com/kurarensu16/diagrid"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors flex items-center gap-1.5 font-mono"
            title="GitHub Repository"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
        </div>
      </footer>

      {/* Feedback Modal */}
      <FeedbackModal 
        isOpen={isFeedbackOpen} 
        onClose={() => setIsFeedbackOpen(false)} 
      />
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
        <BroadcastBanner />
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
            <Route path="/admin/supporters" element={<AdminSupporters />} />
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
