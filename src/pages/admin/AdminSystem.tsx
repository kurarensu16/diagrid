import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { mockAdmin, type TemplateConfig } from '../../services/mockAdmin';
import { TEMPLATES } from '../../services/mockDb';
import { Sliders, CheckCircle, XCircle } from 'lucide-react';

export const AdminSystem: React.FC = () => {
  const [templateConfigs, setTemplateConfigs] = useState<TemplateConfig[]>([]);

  useEffect(() => {
    loadTemplateConfigs();
  }, []);

  const loadTemplateConfigs = () => {
    // Ensure all TEMPLATES from mockDb are mapped into configs
    const storedConfigs = mockAdmin.getTemplateConfigs();
    const configMap = new Map(storedConfigs.map(c => [c.id, c]));
    
    // Sync with TEMPLATES from mockDb
    const syncedConfigs: TemplateConfig[] = TEMPLATES.map(t => {
      const existing = configMap.get(t.id);
      return {
        id: t.id,
        title: t.title,
        type: t.type,
        enabled: existing ? existing.enabled : true,
        featured: existing ? existing.featured : false,
      };
    });

    setTemplateConfigs(syncedConfigs);
  };

  const handleToggleEnabled = (id: string, currentEnabled: boolean) => {
    mockAdmin.updateTemplateConfig(id, { enabled: !currentEnabled });
    loadTemplateConfigs();
  };

  const handleToggleFeatured = (id: string, currentFeatured: boolean) => {
    mockAdmin.updateTemplateConfig(id, { featured: !currentFeatured });
    loadTemplateConfigs();
  };

  // System info panel diagnostics
  const systemInfo = [
    { label: 'build_version', value: 'v0.1.0-alpha (Diagrid Blueprint Edition)' },
    { label: 'storage_engine', value: 'localStorage (Simulated) → Supabase ready' },
    { label: 'auth_provider', value: 'Mock Auth Service → Supabase ready' },
    { label: 'routing_namespace', value: 'React Router v7 /admin/*' },
  ];

  // Feature Flags (read-only for now)
  const featureFlags = [
    { name: 'ai_generation', enabled: false, desc: 'Generate visual diagram schemas from text inputs using Google Gemini API.' },
    { name: 'public_sharing', enabled: true, desc: 'Generate read-only share links for guest viewing.' },
    { name: 'pdf_export', enabled: false, desc: 'High-resolution vector PDF export engine for academic thesis submissions.' }
  ];

  return (
    <div className="p-8 flex flex-col gap-6 text-ink">
      {/* Header */}
      <div className="border-b border-line pb-6">
        <h1 className="text-[32px] font-bold tracking-tight">system_settings</h1>
        <p className="text-[13px] text-ink-soft font-mono mt-1">// inspect platform variables, feature gates, and template profiles</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: System variables & Feature gates */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Diagnostics variables */}
          <Card variant="blueprint" className="p-6 flex flex-col gap-4">
            <div>
              <h2 className="text-[17px] font-bold tracking-tight">system_diagnostics</h2>
              <p className="text-[11px] text-ink-soft font-mono mt-0.5">// core engine variables</p>
            </div>

            <div className="flex flex-col gap-3 font-mono text-[12px] mt-2">
              {systemInfo.map((p) => (
                <div key={p.label} className="flex flex-col gap-1 border-b border-line border-dashed pb-2 last:border-0 last:pb-0">
                  <span className="text-ink-soft uppercase text-[10px]">// {p.label}</span>
                  <span className="text-ink font-bold break-all">{p.value}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Feature flags gates */}
          <Card variant="signal" className="p-6 flex flex-col gap-4">
            <div>
              <h2 className="text-[17px] font-bold tracking-tight text-signal">feature_toggles</h2>
              <p className="text-[11px] text-ink-soft font-mono mt-0.5">// compile-time toggle gates</p>
            </div>

            <div className="flex flex-col gap-4 mt-2">
              {featureFlags.map((flag) => (
                <div key={flag.name} className="flex gap-3 items-start border-b border-line pb-3 last:border-0 last:pb-0">
                  <div className="mt-0.5">
                    {flag.enabled ? (
                      <CheckCircle className="w-4 h-4 text-blueprint shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-signal shrink-0" />
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-[12px] font-bold text-ink uppercase tracking-wide">
                      {flag.name}
                    </span>
                    <span className="text-[11.5px] text-ink-soft leading-relaxed">
                      {flag.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Side: Template visibility config manager */}
        <div className="lg:col-span-2">
          <Card variant="blueprint" className="p-6 flex flex-col gap-4 h-full">
            <div>
              <h2 className="text-[18px] font-bold tracking-tight">template_configurations</h2>
              <p className="text-[11px] text-ink-soft font-mono mt-0.5">// publish configurations for the template gallery</p>
            </div>

            <div className="flex flex-col gap-3 mt-2">
              {templateConfigs.map((c) => (
                <div 
                  key={c.id} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-line p-4 bg-paper bg-opacity-30 font-mono text-[12px]"
                >
                  <div className="flex items-center gap-3">
                    <Sliders className="w-4 h-4 text-ink-soft shrink-0" />
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-ink text-[13px]">{c.title}</span>
                        <span className="text-[9px] text-blueprint border border-blueprint px-1 uppercase tracking-wide">
                          {c.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-ink-soft mt-0.5 block">
                        CONFIG_ID: {c.id}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {/* Enabled toggle button */}
                    <button
                      onClick={() => handleToggleEnabled(c.id, c.enabled)}
                      className={`px-3 py-1.5 border text-[10px] uppercase font-bold tracking-wider cursor-pointer transition-colors ${
                        c.enabled 
                          ? 'border-blueprint text-blueprint hover:bg-blueprint hover:text-paper bg-blueprint bg-opacity-5'
                          : 'border-line text-ink-soft hover:border-ink hover:text-ink'
                      }`}
                    >
                      {c.enabled ? 'enabled' : 'disabled'}
                    </button>

                    {/* Featured toggle button */}
                    <button
                      onClick={() => handleToggleFeatured(c.id, c.featured)}
                      className={`px-3 py-1.5 border text-[10px] uppercase font-bold tracking-wider cursor-pointer transition-colors ${
                        c.featured 
                          ? 'border-signal text-signal hover:bg-signal hover:text-paper bg-signal bg-opacity-5'
                          : 'border-line text-ink-soft hover:border-ink hover:text-ink'
                      }`}
                    >
                      {c.featured ? 'featured' : 'standard'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
