import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileCheck, CheckCircle2, ShieldAlert, Cpu, Award, Mail } from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Card } from '../components/ui/Card';

export const TermsOfService: React.FC = () => {
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
            LEGAL_TERMS_v1.0
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 sm:p-10 flex flex-col gap-8">
        {/* Title Banner */}
        <div className="border-b-2 border-ink pb-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-blueprint font-mono text-xs font-bold uppercase tracking-wider">
            <FileCheck className="w-4 h-4" />
            <span>Platform Agreement</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink font-sans">
            Terms of Service
          </h1>
          <p className="font-mono text-xs text-ink-soft">
            Last Updated: September 12, 2026 • Effective Date: September 12, 2026
          </p>
        </div>

        {/* Highlight Callout */}
        <Card variant="blueprint" className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-blueprint/5 border-blueprint">
          <div className="p-2.5 border border-blueprint bg-blueprint/10 text-blueprint shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-1 font-mono text-xs">
            <span className="font-bold text-ink uppercase">100% Content Ownership Guarantee:</span>
            <p className="text-ink-soft leading-relaxed font-sans text-sm">
              You own all intellectual property rights to the diagrams, architecture blueprints, flowcharts, ERD schemas, and export files you create on Diagrid. We claim zero rights or royalties over your designs.
            </p>
          </div>
        </Card>

        {/* Terms Sections */}
        <div className="flex flex-col gap-8 text-sm leading-relaxed select-text font-sans">
          {/* Section 1 */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink font-mono flex items-center gap-2 border-b border-line pb-2">
              <span className="text-blueprint">01.</span> Acceptance of Terms
            </h2>
            <p className="text-ink-soft">
              By accessing or using Diagrid (the "Service"), you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may not access or use the application.
            </p>
          </section>

          {/* Section 2 */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink font-mono flex items-center gap-2 border-b border-line pb-2">
              <span className="text-blueprint">02.</span> User Accounts & Authentication
            </h2>
            <p className="text-ink-soft">
              When creating an account on Diagrid:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-2 text-ink-soft marker:text-blueprint">
              <li>You agree to provide an accurate email address for authentication and recovery.</li>
              <li>You are responsible for maintaining the confidentiality of your session and credentials.</li>
              <li>You must notify us immediately of any unauthorized access or security breach regarding your account.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink font-mono flex items-center gap-2 border-b border-line pb-2">
              <span className="text-blueprint">03.</span> Intellectual Property & Export Rights
            </h2>
            <p className="text-ink-soft">
              Our licensing and ownership terms are clear and developer-friendly:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
              <div className="p-3.5 border border-line bg-paper-raised flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-emerald-700 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Your Diagrams & Exports</span>
                </div>
                <p className="text-ink-soft font-sans text-xs">
                  You own 100% of your created content, SVG graphics, PNG exports, PDF sheets, and Mermaid code. You may use your exported diagrams for any commercial or private project.
                </p>
              </div>

              <div className="p-3.5 border border-line bg-paper-raised flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-blueprint font-bold">
                  <Cpu className="w-4 h-4" />
                  <span>Platform Software</span>
                </div>
                <p className="text-ink-soft font-sans text-xs">
                  The Diagrid application UI, brand assets, source code, and design system are protected by applicable intellectual property and open-source licenses.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink font-mono flex items-center gap-2 border-b border-line pb-2">
              <span className="text-blueprint">04.</span> Acceptable Use Policy
            </h2>
            <p className="text-ink-soft">
              You agree not to misuse the Diagrid platform. Prohibited actions include:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-2 text-ink-soft marker:text-signal">
              <li>Attempting to bypass row-level security (RLS) policies or access other tenants' workspaces.</li>
              <li>Uploading malicious scripts, exploits, or illegal content to storage buckets or shared diagrams.</li>
              <li>Engaging in automated scraping, denial-of-service attacks, or excessive API hammering that degrades service for other users.</li>
              <li>Reverse-engineering or attempting to extract proprietary platform source code without authorization.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink font-mono flex items-center gap-2 border-b border-line pb-2">
              <span className="text-blueprint">05.</span> Service Availability & Disclaimers
            </h2>
            <p className="text-ink-soft">
              Diagrid is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express or implied. While we strive for 99.9% uptime and continuous data redundancy through Supabase PostgreSQL:
            </p>
            <div className="p-4 border border-line bg-paper-raised font-mono text-xs flex flex-col gap-2 text-ink-soft">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>We encourage regular offline backups using our 1-click JSON, SVG, and Mermaid export features.</span>
              </div>
              <p className="font-sans text-xs">
                Diagrid shall not be liable for any indirect, incidental, or consequential damages resulting from downtime, data corruption, or service interruption.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink font-mono flex items-center gap-2 border-b border-line pb-2">
              <span className="text-blueprint">06.</span> Termination
            </h2>
            <p className="text-ink-soft">
              We reserve the right to suspend or terminate accounts that violate our Acceptable Use Policy. You may terminate your account at any time by deleting your profile in Settings.
            </p>
          </section>

          {/* Section 7 */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink font-mono flex items-center gap-2 border-b border-line pb-2">
              <span className="text-blueprint">07.</span> Contact Information
            </h2>
            <p className="text-ink-soft">
              If you have any questions regarding these Terms of Service, reach out to:
            </p>
            <div className="p-4 border border-line bg-paper flex items-center justify-between font-mono text-xs">
              <div className="flex items-center gap-2 text-ink">
                <Mail className="w-4 h-4 text-blueprint" />
                <span className="font-bold">legal@diagrid.dev</span>
              </div>
              <Link to="/privacy" className="text-blueprint hover:underline">
                view_privacy_policy()
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
          <Link to="/privacy" className="hover:text-ink transition-colors">Privacy Policy</Link>
          <Link to="/docs" className="hover:text-ink transition-colors">Documentation</Link>
          <Link to="/" className="hover:text-ink transition-colors">Home</Link>
        </div>
      </footer>
    </div>
  );
};
