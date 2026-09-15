import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Mail } from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Card } from '../components/ui/Card';

export const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col font-sans select-none">
      {/* Top Header */}
      <header className="border-b-2 border-ink bg-paper-raised px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-1.5 font-mono text-xs border border-line px-2.5 py-1.5 hover:border-ink hover:bg-paper text-ink-soft hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>back_to_home()</span>
          </Link>
          <Logo size="md" />
        </div>

        <div className="flex items-center gap-3 font-mono text-xs text-ink-soft">
          <span className="hidden sm:inline">// document_ref:</span>
          <span className="border border-line bg-paper px-2 py-0.5 text-ink font-bold">
            LEGAL_PRIVACY_v1.0
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 sm:p-10 flex flex-col gap-8">
        {/* Title Banner */}
        <div className="border-b-2 border-ink pb-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-blueprint font-mono text-xs font-bold uppercase tracking-wider">
            <Shield className="w-4 h-4" />
            <span>Compliance & Data Protection</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink font-sans">
            Privacy Policy
          </h1>
          <p className="font-mono text-xs text-ink-soft">
            Last Updated: September 12, 2026 • Effective Date: September 12, 2026
          </p>
        </div>

        {/* Highlight Callout */}
        <Card variant="blueprint" className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-blueprint/5 border-blueprint">
          <div className="p-2.5 border border-blueprint bg-blueprint/10 text-blueprint shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-1 font-mono text-xs">
            <span className="font-bold text-ink uppercase">Core Privacy Principle:</span>
            <p className="text-ink-soft leading-relaxed font-sans text-sm">
              Diagrid is built with privacy-by-default. Your diagram structures, mermaid code, and database schemas remain strictly private to your account. We never monetize, scrape, or train public AI models on your private diagram workspaces.
            </p>
          </div>
        </Card>

        {/* Policy Sections */}
        <div className="flex flex-col gap-8 text-sm leading-relaxed select-text font-sans">
          {/* Section 1 */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink font-mono flex items-center gap-2 border-b border-line pb-2">
              <span className="text-blueprint">01.</span> Information We Collect
            </h2>
            <p className="text-ink-soft">
              We collect only the minimum information necessary to provide, secure, and maintain the Diagrid diagramming service:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-2 text-ink-soft marker:text-blueprint">
              <li>
                <strong className="text-ink">Account Credentials:</strong> When you register an account, we store your email address and optional display name through our secure authentication provider (Supabase Auth).
              </li>
              <li>
                <strong className="text-ink">Diagram & Workspace Data:</strong> All diagrams, nodes, edges, text annotations, Mermaid source code, and project configurations created in the Editor are stored in row-level security (RLS) protected database tables.
              </li>
              <li>
                <strong className="text-ink">Diagnostic Telemetry (Feedback & Support Only):</strong> When you submit feedback or a bug report through the in-app feedback modal, we capture opt-in diagnostic details (browser version, operating system, viewport size, and active canvas metadata) to assist engineering triage.
              </li>
              <li>
                <strong className="text-ink">Screenshot Attachments:</strong> If you upload or paste a screenshot with a feedback report, the image is stored in an encrypted Supabase storage bucket solely for debugging purposes.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink font-mono flex items-center gap-2 border-b border-line pb-2">
              <span className="text-blueprint">02.</span> How We Use Your Information
            </h2>
            <p className="text-ink-soft">
              Your information is used exclusively for the following operational objectives:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
              <div className="p-3 border border-line bg-paper-raised">
                <span className="font-bold text-ink block mb-1">Canvas Synchronization</span>
                <span className="text-ink-soft">Syncing real-time changes and versions across your devices and sessions.</span>
              </div>
              <div className="p-3 border border-line bg-paper-raised">
                <span className="font-bold text-ink block mb-1">Security & Access Control</span>
                <span className="text-ink-soft">Enforcing tenant isolation so unauthorized users cannot view your diagrams.</span>
              </div>
              <div className="p-3 border border-line bg-paper-raised">
                <span className="font-bold text-ink block mb-1">Public Sharing & Embeds</span>
                <span className="text-ink-soft">Generating read-only shareable links and embed widgets only when you toggle public access.</span>
              </div>
              <div className="p-3 border border-line bg-paper-raised">
                <span className="font-bold text-ink block mb-1">Bug Resolution & Support</span>
                <span className="text-ink-soft">Investigating reported rendering issues and notifying you of resolution status.</span>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink font-mono flex items-center gap-2 border-b border-line pb-2">
              <span className="text-blueprint">03.</span> Diagram Sharing & Visibility
            </h2>
            <p className="text-ink-soft">
              Diagrid gives you granular control over the visibility of your blueprints:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-2 text-ink-soft marker:text-blueprint">
              <li>
                <strong className="text-ink">Private Workspaces (Default):</strong> By default, all diagrams are private and accessible exclusively by your authenticated account.
              </li>
              <li>
                <strong className="text-ink">Public Viewer & Embed Widgets:</strong> If you explicitly enable public sharing, a unique UUID link is generated. Anyone with the URL will be able to view or embed the diagram in read-only mode. You can revoke public access at any time.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink font-mono flex items-center gap-2 border-b border-line pb-2">
              <span className="text-blueprint">04.</span> Data Retention & Deletion Rights
            </h2>
            <p className="text-ink-soft">
              You maintain full ownership of your data at all times:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-2 text-ink-soft marker:text-blueprint">
              <li>
                <strong className="text-ink">Local & Cloud Exports:</strong> You can export your diagrams as SVG, PNG, PDF, or raw JSON at any time without restriction.
              </li>
              <li>
                <strong className="text-ink">Account & Data Deletion:</strong> You can delete projects, diagrams, or your entire account directly from the Settings menu. Deletions cascade immediately, permanently purging associated records from our database.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink font-mono flex items-center gap-2 border-b border-line pb-2">
              <span className="text-blueprint">05.</span> Third-Party Infrastructure
            </h2>
            <p className="text-ink-soft">
              We rely on industry-standard infrastructure providers to host and secure the platform:
            </p>
            <div className="p-4 border border-line bg-paper-raised flex flex-col gap-2 font-mono text-xs">
              <div className="flex justify-between items-center border-b border-line pb-1.5">
                <span className="font-bold text-ink">Supabase (PostgreSQL & Storage)</span>
                <span className="text-ink-soft">Database hosting, auth & file storage</span>
              </div>
              <div className="flex justify-between items-center border-b border-line pb-1.5">
                <span className="font-bold text-ink">Vercel / Cloudflare Pages</span>
                <span className="text-ink-soft">Edge CDN static asset delivery & SSL encryption</span>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink font-mono flex items-center gap-2 border-b border-line pb-2">
              <span className="text-blueprint">06.</span> Contact & Inquiries
            </h2>
            <p className="text-ink-soft">
              For any questions regarding this Privacy Policy, data requests, or compliance inquiries, please contact our engineering team:
            </p>
            <div className="p-4 border border-line bg-paper flex items-center justify-between font-mono text-xs">
              <div className="flex items-center gap-2 text-ink">
                <Mail className="w-4 h-4 text-blueprint" />
                <span className="font-bold">support@diagrid.dev</span>
              </div>
              <Link to="/docs" className="text-blueprint hover:underline">
                view_docs()
              </Link>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-8 border-t-2 border-ink bg-paper-raised flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-ink-soft">
        <div className="flex items-center gap-2">
          <span>© {new Date().getFullYear()} Diagrid. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/terms" className="hover:text-ink transition-colors">Terms of Service</Link>
          <Link to="/docs" className="hover:text-ink transition-colors">Documentation</Link>
          <Link to="/" className="hover:text-ink transition-colors">Home</Link>
        </div>
      </footer>
    </div>
  );
};
