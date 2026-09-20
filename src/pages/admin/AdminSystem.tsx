import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { adminService, type TemplateConfig, type PlatformSettings, type CreatorWallet } from '../../services/adminService';
import { TEMPLATES } from '../../services/mockDb';
import { 
  Sliders, 
  RefreshCw, 
  ShieldAlert, 
  UserCheck, 
  Share2, 
  FileDown, 
  Database, 
  Clock, 
  Layers, 
  CheckCircle2,
  AlertTriangle,
  Globe,
  Wallet,
  Plus,
  Trash2,
  QrCode,
  Check,
  X,
  Upload
} from 'lucide-react';

type PendingConfirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  action: () => Promise<void> | void;
};

export const AdminSystem: React.FC = () => {
  const [templateConfigs, setTemplateConfigs] = useState<TemplateConfig[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>({
    maintenance_mode: false,
    registration_policy: 'open',
    max_projects_per_user: 10,
    public_sharing: true,
    pdf_export: false,
    audit_retention_days: 30,
    creator_wallets: [
      { id: 'w-1', name: 'GCash', account_name: 'Diagrid Creator', account_number: '0912 345 6789', qr_url: '', enabled: true },
      { id: 'w-2', name: 'Maya', account_name: 'Diagrid Creator', account_number: '0912 345 6789', qr_url: '', enabled: true },
    ],
    github_repo_url: 'https://github.com/kurarensu16/diagrid',
  });
  const [systemHealth, setSystemHealth] = useState<{
    connected: boolean;
    latencyMs: number;
    database: string;
    auth: string;
    storage: string;
  }>({
    connected: false,
    latencyMs: 0,
    database: 'Checking...',
    auth: 'Checking...',
    storage: 'Checking...',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [health, storedConfigs, fetchedSettings] = await Promise.all([
        adminService.getSystemStatus(),
        adminService.getTemplateConfigs(),
        adminService.getSystemSettings(),
      ]);
      setSystemHealth(health);
      setSettings(fetchedSettings);

      const configMap = new Map(storedConfigs.map((c) => [c.id, c]));
      const syncedConfigs: TemplateConfig[] = TEMPLATES.map((t) => {
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
    } finally {
      setIsLoading(false);
    }
  };

  const requestConfirmation = (confirmation: PendingConfirmation) => {
    if (isUpdating) return;
    setPendingConfirmation(confirmation);
  };

  const confirmPendingAction = async () => {
    if (!pendingConfirmation) return;
    const action = pendingConfirmation.action;
    setPendingConfirmation(null);
    try {
      await action();
    } catch {
      showToast('Action failed. No settings were changed.');
    }
  };

  const handleUpdateSetting = async <K extends keyof PlatformSettings>(
    key: K, 
    value: PlatformSettings[K]
  ): Promise<boolean> => {
    setIsUpdating(true);
    const prev = { ...settings };
    const updated = { ...settings, [key]: value };
    setSettings(updated);

    try {
      const res = await adminService.updateSystemSettings({ [key]: value });
      if (res.error) {
        setSettings(prev);
        showToast(`Error updating ${key}: ${res.error}`);
        return false;
      } else {
        showToast(`Updated platform policy [${key}] successfully.`);
        return true;
      }
    } catch {
      setSettings(prev);
      showToast(`Network error updating ${key}.`);
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const requestSettingUpdate = <K extends keyof PlatformSettings>(
    key: K,
    value: PlatformSettings[K],
    description: string,
    danger = false,
  ) => {
    requestConfirmation({
      title: `confirm_setting_change(${key})`,
      description,
      confirmLabel: 'apply_change()',
      danger,
      action: async () => {
        await handleUpdateSetting(key, value);
      },
    });
  };

  // Multi-Wallet Handlers
  const handleToggleWalletEnabled = async (walletId: string) => {
    const currentWallets = settings.creator_wallets || [];
    const updated = currentWallets.map((w) =>
      w.id === walletId ? { ...w, enabled: !w.enabled } : w
    );
    const target = updated.find((w) => w.id === walletId);
    requestConfirmation({
      title: `${target?.enabled ? 'enable' : 'disable'}_wallet(${target?.name || 'wallet'})`,
      description: `This changes whether ${target?.name || 'this payment method'} is visible to supporters.`,
      confirmLabel: target?.enabled ? 'enable_wallet()' : 'disable_wallet()',
      action: async () => {
        const saved = await handleUpdateSetting('creator_wallets', updated);
        if (saved) showToast(`Payment method [${target?.name || 'Wallet'}] ${target?.enabled ? 'ACTIVATED' : 'MUTED'}.`);
      },
    });
  };

  const handleAddWallet = async (presetName: string = 'GCash') => {
    const currentWallets = settings.creator_wallets || [];
    const newWallet: CreatorWallet = {
      id: `w-${Date.now()}`,
      name: presetName,
      account_name: '',
      account_number: '',
      qr_url: '',
      enabled: true,
    };
    const updated = [...currentWallets, newWallet];
    requestConfirmation({
      title: `add_wallet(${presetName})`,
      description: `Add ${presetName} as a new supporter payment method?`,
      confirmLabel: 'add_wallet()',
      action: async () => {
        const saved = await handleUpdateSetting('creator_wallets', updated);
        if (saved) showToast(`Added [${presetName}] to digital wallets.`);
      },
    });
  };

  const handleQrFileUpload = (walletId: string, file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, SVG, WEBP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image size exceeds 2MB limit. Please upload a smaller QR code image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;

      const currentWallets = settings.creator_wallets || [];
      const updated = currentWallets.map((w) =>
        w.id === walletId ? { ...w, qr_url: dataUrl } : w
      );
      setSettings((prev) => ({ ...prev, creator_wallets: updated }));
      const saved = await handleUpdateSetting('creator_wallets', updated);
      if (saved) showToast('QR code image uploaded and saved successfully.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveQrCode = async (walletId: string) => {
    const currentWallets = settings.creator_wallets || [];
    const updated = currentWallets.map((w) =>
      w.id === walletId ? { ...w, qr_url: '' } : w
    );
    setSettings((prev) => ({ ...prev, creator_wallets: updated }));
    const saved = await handleUpdateSetting('creator_wallets', updated);
    if (saved) showToast('QR code image removed.');
  };

  const handleDeleteWallet = async (walletId: string) => {
    const currentWallets = settings.creator_wallets || [];
    const target = currentWallets.find((w) => w.id === walletId);
    const updated = currentWallets.filter((w) => w.id !== walletId);
    requestConfirmation({
      title: `remove_wallet(${target?.name || 'entry'})`,
      description: 'This removes the payment method from the platform configuration.',
      confirmLabel: 'remove_wallet()',
      danger: true,
      action: async () => {
        const saved = await handleUpdateSetting('creator_wallets', updated);
        if (saved) showToast(`Removed wallet [${target?.name || 'entry'}].`);
      },
    });
  };

  const handleToggleEnabled = async (id: string, currentEnabled: boolean) => {
    requestConfirmation({
      title: 'change_template_visibility()',
      description: `${currentEnabled ? 'Hide' : 'Publish'} this template in the developer gallery?`,
      confirmLabel: currentEnabled ? 'hide_template()' : 'publish_template()',
      action: async () => {
        const result = await adminService.updateTemplateConfig(id, { enabled: !currentEnabled });
        if (result.error) return showToast(`Error updating template: ${result.error}`);
        setTemplateConfigs((prev) => prev.map((c) => (c.id === id ? { ...c, enabled: !currentEnabled } : c)));
        showToast(`Template visibility toggled.`);
      },
    });
  };

  const handleToggleFeatured = async (id: string, currentFeatured: boolean) => {
    requestConfirmation({
      title: 'change_template_featured_state()',
      description: `${currentFeatured ? 'Remove this template from' : 'Pin this template to'} the featured gallery list?`,
      confirmLabel: currentFeatured ? 'unfeature_template()' : 'feature_template()',
      action: async () => {
        const result = await adminService.updateTemplateConfig(id, { featured: !currentFeatured });
        if (result.error) return showToast(`Error updating template: ${result.error}`);
        setTemplateConfigs((prev) => prev.map((c) => (c.id === id ? { ...c, featured: !currentFeatured } : c)));
        showToast(`Template featured pin toggled.`);
      },
    });
  };

  // Diagnostic parameters
  const systemInfo = [
    { label: 'database_engine', value: `Supabase PostgreSQL (${systemHealth.database})` },
    { label: 'latency_ping', value: `${systemHealth.latencyMs}ms` },
    { label: 'auth_provider', value: `Supabase Auth (${systemHealth.auth})` },
    { label: 'storage_engine', value: `Supabase Cloud Storage (${systemHealth.storage})` },
    { label: 'build_version', value: 'v0.1.0-alpha (Diagrid Blueprint Edition)' },
    { label: 'routing_namespace', value: 'React Router v7 /admin/*' },
  ];

  return (
    <div className="p-8 flex flex-col gap-6 text-ink">
      {/* Header */}
      <div className="border-b border-line pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight">system_settings</h1>
          <p className="text-[13px] text-ink-soft font-mono mt-1">// inspect platform variables, feature gates, and template profiles</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadAll}
            disabled={isLoading || isUpdating}
            className="flex items-center gap-1.5 font-mono text-[11px] border border-line px-3 py-1.5 hover:border-ink hover:bg-paper-raised transition-colors cursor-pointer"
            title="Ping Supabase and reload diagnostics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            ping_supabase()
          </button>
          <div className="font-mono text-[12px] flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${systemHealth.connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-ink-soft">{systemHealth.connected ? 'SUPABASE_CONNECTED' : 'STANDBY'}</span>
          </div>
        </div>
      </div>

      {/* Action Notification Toast */}
      {statusMessage && (
        <div className="bg-[#EBF3FA] dark:bg-[#152332] border border-[#1E5C8C] text-[#1E5C8C] dark:text-[#388BFD] px-4 py-2.5 font-mono text-[12px] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>STATUS: {statusMessage}</span>
        </div>
      )}

      {/* Configuration overview */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'registration', value: settings.registration_policy.replace('_', ' '), tone: 'text-blueprint' },
          { label: 'project_limit', value: settings.max_projects_per_user === 0 ? 'unlimited' : `${settings.max_projects_per_user} / user`, tone: 'text-ink' },
          { label: 'wallets_active', value: `${(settings.creator_wallets || []).filter((wallet) => wallet.enabled).length} / ${(settings.creator_wallets || []).length}`, tone: 'text-rose-600' },
          { label: 'templates_published', value: `${templateConfigs.filter((template) => template.enabled).length} / ${templateConfigs.length}`, tone: 'text-signal' },
        ].map((item) => (
          <div key={item.label} className="border border-line bg-paper-raised px-4 py-3 shadow-[2px_2px_0px_0px_rgba(21,25,28,0.08)]">
            <span className="block font-mono text-[10px] uppercase tracking-wide text-ink-soft">// {item.label}</span>
            <span className={`block mt-1 font-mono text-[15px] font-bold uppercase ${item.tone}`}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* Maintenance Mode Alert Banner if active */}
      {settings.maintenance_mode && (
        <div className="bg-amber-500/10 border border-amber-500/50 text-amber-900 dark:text-amber-200 p-4 font-mono text-[12.5px] flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block text-[13px] font-bold tracking-wide">// MAINTENANCE_MODE_ACTIVE</strong>
            <p className="text-[12px] opacity-90 mt-0.5">
              Client mutations are frozen. All diagram and project write operations will be rejected in read-only mode until turned off.
            </p>
          </div>
        </div>
      )}

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2 Cards) */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* Card 1: Platform & Access Governance */}
          <Card variant="blueprint" className="p-6 flex flex-col gap-5">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-blueprint shrink-0" />
              <div>
                <h2 className="text-[17px] font-bold tracking-tight">platform_governance</h2>
                <p className="text-[11px] text-ink-soft font-mono mt-0.5">// access and operational policies</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 font-mono text-[12px]">
              
              {/* Maintenance Mode Switch */}
              <div className="flex flex-col gap-1.5 border-b border-line pb-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">// maintenance_mode</span>
                  <button
                    onClick={() => requestSettingUpdate('maintenance_mode', !settings.maintenance_mode, `${settings.maintenance_mode ? 'Disable' : 'enable'} maintenance mode? Diagram and project writes will ${settings.maintenance_mode ? 'resume' : 'be frozen'}.`, !settings.maintenance_mode)}
                    disabled={isUpdating}
                    className={`px-3 py-1 border text-[10px] uppercase font-bold tracking-wider cursor-pointer transition-colors ${
                      settings.maintenance_mode
                        ? 'border-rose-600 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
                        : 'border-line text-ink-soft hover:border-ink hover:text-ink'
                    }`}
                  >
                    {settings.maintenance_mode ? 'ENABLED (LOCKED)' : 'OFF (NORMAL)'}
                  </button>
                </div>
                <p className="text-[11px] text-ink-soft font-sans">
                  Freeze diagram writes during database migrations.
                </p>
              </div>

              {/* Registration Policy */}
              <div className="flex flex-col gap-2 border-b border-line pb-3.5">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-ink-soft" />
                  <span className="font-bold text-ink">// registration_policy</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['open', 'invite_only', 'disabled'] as const).map((policy) => (
                    <button
                      key={policy}
                      onClick={() => requestSettingUpdate('registration_policy', policy, `Change registration policy to ${policy.replace('_', ' ')}?`, policy === 'disabled')}
                      disabled={isUpdating}
                      className={`py-1.5 px-2 border text-[10px] uppercase font-bold tracking-wider text-center cursor-pointer transition-colors ${
                        settings.registration_policy === policy
                          ? 'border-[#1E5C8C] text-[#1E5C8C] dark:text-[#388BFD] bg-[#EBF3FA] dark:bg-[#152332]'
                          : 'border-line text-ink-soft hover:border-ink hover:text-ink'
                      }`}
                    >
                      {policy.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Project Quota Limit */}
              <div className="flex flex-col gap-2 border-b border-line pb-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-ink-soft" />
                    <span className="font-bold text-ink">// max_projects_per_user</span>
                  </div>
                  <span className="text-blueprint font-bold text-[13px]">
                    {settings.max_projects_per_user === 0 ? 'UNLIMITED' : `${settings.max_projects_per_user} projects`}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[5, 10, 25, 0].map((limit) => (
                    <button
                      key={limit}
                      onClick={() => requestSettingUpdate('max_projects_per_user', limit, `Set the maximum projects per user to ${limit === 0 ? 'unlimited' : limit}?`)}
                      disabled={isUpdating}
                      className={`py-1 border text-[10px] font-bold text-center cursor-pointer transition-colors ${
                        settings.max_projects_per_user === limit
                          ? 'border-ink text-ink bg-paper-raised font-bold'
                          : 'border-line text-ink-soft hover:border-ink hover:text-ink'
                      }`}
                    >
                      {limit === 0 ? 'MAX' : `${limit}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audit Retention Days */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-ink-soft" />
                    <span className="font-bold text-ink">// audit_retention_days</span>
                  </div>
                  <span className="text-blueprint font-bold text-[13px]">
                    {settings.audit_retention_days} days
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[30, 60, 90, 365].map((days) => (
                    <button
                      key={days}
                      onClick={() => requestSettingUpdate('audit_retention_days', days, `Keep audit logs for ${days} days?`)}
                      disabled={isUpdating}
                      className={`py-1 border text-[10px] font-bold text-center cursor-pointer transition-colors ${
                        settings.audit_retention_days === days
                          ? 'border-ink text-ink bg-paper-raised font-bold'
                          : 'border-line text-ink-soft hover:border-ink hover:text-ink'
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </Card>

          {/* Card 2: Feature Gates */}
          <Card variant="signal" className="p-6 flex flex-col gap-5">
            <div>
              <h2 className="text-[17px] font-bold tracking-tight text-signal">feature_toggles</h2>
              <p className="text-[11px] text-ink-soft font-mono mt-0.5">// platform capability toggles</p>
            </div>

            <div className="flex flex-col gap-4 font-mono text-[12px]">
              {/* Public Sharing */}
              <div className="flex items-start justify-between gap-4 border-b border-line pb-3.5">
                <div className="flex gap-2.5">
                  <Share2 className="w-4 h-4 text-ink-soft shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-ink block">public_sharing</span>
                    <span className="text-[11px] text-ink-soft font-sans">
                      Enable read-only guest URLs for diagram reviews.
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => requestSettingUpdate('public_sharing', !settings.public_sharing, `${settings.public_sharing ? 'Disable' : 'enable'} public sharing links?`, settings.public_sharing)}
                  disabled={isUpdating}
                  className={`px-3 py-1 border text-[10px] uppercase font-bold tracking-wider shrink-0 cursor-pointer transition-colors ${
                    settings.public_sharing
                      ? 'border-[#1E5C8C] text-[#1E5C8C] dark:text-[#388BFD] bg-[#EBF3FA] dark:bg-[#152332]'
                      : 'border-line text-ink-soft hover:border-ink'
                  }`}
                >
                  {settings.public_sharing ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* Vector PDF Export */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-2.5">
                  <FileDown className="w-4 h-4 text-ink-soft shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-ink block">pdf_export</span>
                    <span className="text-[11px] text-ink-soft font-sans">
                      High-resolution vector PDF rendering engine.
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => requestSettingUpdate('pdf_export', !settings.pdf_export, `${settings.pdf_export ? 'Disable' : 'enable'} vector PDF export?`, settings.pdf_export)}
                  disabled={isUpdating}
                  className={`px-3 py-1 border text-[10px] uppercase font-bold tracking-wider shrink-0 cursor-pointer transition-colors ${
                    settings.pdf_export
                      ? 'border-[#D45B33] text-[#D45B33] dark:text-[#F78166] bg-[#FDF2EC] dark:bg-[#2C1610]'
                      : 'border-line text-ink-soft hover:border-ink'
                  }`}
                >
                  {settings.pdf_export ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>
            </div>
          </Card>

              {/* Card 3: GitHub Repository & Community Links */}
              <Card variant="blueprint" className="p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blueprint shrink-0" />
                  <div>
                    <h2 className="text-[17px] font-bold tracking-tight text-ink">// github_repository_link</h2>
                    <p className="text-[11px] text-ink-soft font-mono mt-0.5">// link displayed in platform footer & sidebars</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 font-mono text-[12px] mt-1">
                  <div className="flex flex-col gap-1">
                    <label className="text-ink-soft uppercase text-[10px]">// repository_url</label>
                    <input
                      type="text"
                      value={settings.github_repo_url || ''}
                      onChange={(e) => setSettings({ ...settings, github_repo_url: e.target.value })}
                      onBlur={() => requestSettingUpdate('github_repo_url', settings.github_repo_url || 'https://github.com/kurarensu16/diagrid', 'Save the repository URL used by platform GitHub links?')}
                      placeholder="https://github.com/kurarensu16/diagrid"
                      className="px-2.5 py-1.5 border border-line bg-paper-raised text-[12px] font-mono focus:border-blueprint focus:outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-ink-soft font-sans">
                    Controls the destination of the GitHub logo link in the user dashboard, admin dashboard, and landing page footers.
                  </p>
                </div>
              </Card>

              {/* Card 4: Diagnostics variables */}
              <Card variant="blueprint" className="p-6 flex flex-col gap-4">
                <div>
                  <h2 className="text-[17px] font-bold tracking-tight">system_diagnostics</h2>
                  <p className="text-[11px] text-ink-soft font-mono mt-0.5">// core engine variables</p>
                </div>

                <div className="flex flex-col gap-3 font-mono text-[12px] mt-1">
                  {systemInfo.map((p) => (
                    <div key={p.label} className="flex flex-col gap-0.5 border-b border-line border-dashed pb-2 last:border-0 last:pb-0">
                      <span className="text-ink-soft uppercase text-[10px]">// {p.label}</span>
                      <span className="text-ink font-bold break-all">{p.value}</span>
                    </div>
                  ))}
                </div>
              </Card>

        </div>

        {/* Right Column: Multi-Wallet Manager & Template Visibility */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Multi-Wallet Management Card */}
          <Card variant="blueprint" className="p-6 flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-rose-500/10 border border-rose-500 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-[18px] font-bold tracking-tight text-ink">// creator_digital_wallets</h2>
                  <p className="text-[11px] text-ink-soft font-mono mt-0.5">
                    // enable or disable the entire feature, and manage individual wallets (1, 2, 3, or many)
                  </p>
                </div>
              </div>

              {/* Master Global Enable/Disable Toggle & Counter */}
              <div className="flex items-center gap-3 font-mono text-[11px] flex-wrap">
                <span className="px-2 py-0.5 border border-line bg-paper text-ink-soft font-bold">
                  {(settings.creator_wallets || []).filter(w => w.enabled).length} ACTIVE / {(settings.creator_wallets || []).length} CONFIGURED
                </span>

                <button
                  onClick={() => requestSettingUpdate('creator_wallets_enabled', settings.creator_wallets_enabled === false ? true : false, `${settings.creator_wallets_enabled === false ? 'Enable' : 'disable'} the Support Creator payment feature globally.`, settings.creator_wallets_enabled !== false)}
                  disabled={isUpdating}
                  className={`px-3 py-1.5 border text-[11px] uppercase font-bold tracking-wider cursor-pointer transition-colors ${
                    settings.creator_wallets_enabled !== false
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                      : 'border-line text-ink-soft bg-paper hover:border-ink hover:text-ink'
                  }`}
                  title={settings.creator_wallets_enabled !== false ? 'Click to disable support creator globally' : 'Click to enable support creator globally'}
                >
                  {settings.creator_wallets_enabled !== false ? '● FEATURE: ACTIVE' : '○ FEATURE: DISABLED'}
                </button>
              </div>
            </div>

            {/* Feature Muted Alert Banner if disabled */}
            {settings.creator_wallets_enabled === false && (
              <div className="bg-amber-500/10 border border-amber-500/50 text-amber-900 dark:text-amber-200 p-3.5 font-mono text-[12px] flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  // FEATURE_MUTED: The Support Creator feature and payment modals are currently disabled globally across the platform.
                </span>
              </div>
            )}

            {/* Quick Add Preset Bar */}
            <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-paper-raised border border-line p-3 ${settings.creator_wallets_enabled === false ? 'opacity-60 pointer-events-none' : ''}`}>
              <span className="font-mono text-[11px] font-bold text-ink-soft uppercase">// quick_add_preset:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {['GCash', 'Maya', 'QRPh / Bank', 'PayPal', 'GoTyme'].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handleAddWallet(preset)}
                    className="flex items-center gap-1 px-2.5 py-1 border border-line hover:border-rose-600 hover:text-rose-600 bg-paper text-ink font-mono text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    <Plus className="w-3 h-3 text-rose-600" />
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Wallets List */}
            <div className="flex flex-col gap-4">
              {(settings.creator_wallets || []).length === 0 ? (
                <div className="border border-dashed border-line p-6 text-center text-ink-soft font-mono text-[12px]">
                  No wallets configured yet. Click a preset above to create your first digital wallet option.
                </div>
              ) : (
                (settings.creator_wallets || []).map((wallet, idx) => (
                  <div 
                    key={wallet.id || idx}
                    className={`border p-4 flex flex-col gap-3 font-mono text-[12px] transition-colors ${
                      wallet.enabled 
                        ? 'border-rose-600/60 bg-rose-500/5 dark:bg-rose-950/20 shadow-sm' 
                        : 'border-line bg-paper/40 opacity-75'
                    }`}
                  >
                    {/* Wallet Row Header with Toggle */}
                    <div className="flex items-center justify-between gap-3 border-b border-line pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink text-[13px]">{wallet.name || 'Untitled Wallet'}</span>
                        <span className="text-[10px] text-ink-soft">({wallet.id})</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Status Toggle Button: Turn ON or OFF */}
                        <button
                          onClick={() => handleToggleWalletEnabled(wallet.id)}
                          className={`px-3 py-1 border text-[10px] uppercase font-bold tracking-wider cursor-pointer transition-colors ${
                            wallet.enabled
                              ? 'border-rose-600 bg-rose-600 text-white shadow-sm'
                              : 'border-line text-ink-soft bg-paper hover:border-ink hover:text-ink'
                          }`}
                          title={wallet.enabled ? 'Wallet is visible to supporters' : 'Wallet is hidden from supporters'}
                        >
                          {wallet.enabled ? '● ACTIVE (ENABLED)' : '○ MUTED (DISABLED)'}
                        </button>

                        {/* Remove button */}
                        <button
                          onClick={() => handleDeleteWallet(wallet.id)}
                          className="p-1 hover:bg-rose-500/10 border border-transparent hover:border-rose-500 text-ink-soft hover:text-rose-600 transition-colors cursor-pointer"
                          title="Delete this wallet option"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* QR Code File Upload Section */}
                    <div className="flex flex-col sm:flex-row items-center gap-5 p-4 border border-line/70 bg-paper-raised">
                      {/* Left: QR Code Preview */}
                      <div className="w-28 h-28 border-2 border-rose-600 bg-white p-2 flex items-center justify-center shrink-0 shadow-sm">
                        {wallet.qr_url ? (
                          <img
                            src={wallet.qr_url}
                            alt={`${wallet.name} QR Code`}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-ink-soft gap-1 text-center">
                            <QrCode className="w-10 h-10 text-rose-500/70" />
                            <span className="text-[9px] font-mono font-bold uppercase text-ink-soft">
                              NO QR CODE
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right: Upload controls and info */}
                      <div className="flex-1 flex flex-col gap-2.5 w-full">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-ink text-[13px] font-mono flex items-center gap-1.5">
                            <Upload className="w-3.5 h-3.5 text-rose-600" />
                            qr_code_file_upload
                          </span>
                          <span className="text-[11px] text-ink-soft font-mono">
                            Upload your {wallet.name} merchant or personal QR code image (PNG, JPG, SVG, WEBP, max 2MB).
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 pt-1">
                          {/* File upload button */}
                          <label className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-600 text-rose-600 hover:bg-rose-600 hover:text-white bg-rose-500/5 font-mono text-[11px] font-bold cursor-pointer transition-colors shadow-sm">
                            <Upload className="w-3.5 h-3.5" />
                            <span>{wallet.qr_url ? 'replace_qr_code()' : 'upload_qr_code()'}</span>
                            <input
                              type="file"
                              accept="image/png, image/jpeg, image/webp, image/svg+xml"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleQrFileUpload(wallet.id, file);
                                e.target.value = '';
                              }}
                              className="hidden"
                            />
                          </label>

                          {/* Remove button if QR exists */}
                          {wallet.qr_url && (
                            <button
                              type="button"
                              onClick={() => void handleRemoveQrCode(wallet.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 border border-line hover:border-signal hover:text-signal text-ink-soft font-mono text-[11px] font-bold cursor-pointer transition-colors"
                              title="Remove this QR code image"
                            >
                              <X className="w-3.5 h-3.5" />
                              remove_qr()
                            </button>
                          )}

                          <span className="text-[10px] font-mono text-ink-soft">
                            {wallet.qr_url ? '● Custom QR uploaded & active' : '○ No file uploaded yet'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Template Configurations Card */}
          <Card variant="blueprint" className="p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-blueprint shrink-0" />
              <div>
                <h2 className="text-[18px] font-bold tracking-tight">template_configurations</h2>
                <p className="text-[11px] text-ink-soft font-mono mt-0.5">// configure templates published to the developer gallery</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-2">
              {templateConfigs.map((c) => (
                <div 
                  key={c.id} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-line p-4 bg-paper bg-opacity-30 font-mono text-[12px] hover:border-ink transition-colors"
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

                  <div className="flex gap-2.5">
                    {/* Enabled toggle button */}
                    <button
                      onClick={() => handleToggleEnabled(c.id, c.enabled)}
                      className={`px-3 py-1.5 border text-[10px] uppercase font-bold tracking-wider cursor-pointer transition-colors ${
                        c.enabled 
                          ? 'border-[#1E5C8C] text-[#1E5C8C] dark:text-[#388BFD] hover:bg-[#1E5C8C] hover:text-white bg-[#EBF3FA] dark:bg-[#152332]'
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
                          ? 'border-[#D45B33] text-[#D45B33] dark:text-[#F78166] hover:bg-[#D45B33] hover:text-white bg-[#FDF2EC] dark:bg-[#2C1610]'
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

      {/* Confirm before any persisted configuration change */}
      {pendingConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(21,25,28,0.28)] backdrop-blur-[1px] p-4">
          <Card variant="blueprint" className="w-full max-w-md p-6 bg-paper shadow-hard">
            <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
              <div className="min-w-0">
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink-soft">// confirmation_required</span>
                <h2 className="mt-1 break-words font-mono text-[16px] leading-tight font-bold tracking-tight">{pendingConfirmation.title}</h2>
              </div>
              <button
                onClick={() => setPendingConfirmation(null)}
                className="p-1 border border-line hover:border-ink cursor-pointer"
                aria-label="Cancel confirmation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="py-5 text-[13px] leading-relaxed text-ink-soft">{pendingConfirmation.description}</p>
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <button
                onClick={() => setPendingConfirmation(null)}
                className="px-3 py-2 border border-line font-mono text-[11px] uppercase cursor-pointer hover:border-ink"
              >
                cancel()
              </button>
              <button
                onClick={confirmPendingAction}
                disabled={isUpdating}
                className={`px-3 py-2 border font-mono text-[11px] uppercase cursor-pointer ${
                  pendingConfirmation.danger
                    ? 'border-signal text-signal hover:bg-signal hover:text-paper'
                    : 'border-blueprint text-blueprint hover:bg-blueprint hover:text-paper'
                }`}
              >
                <Check className="inline-block w-3.5 h-3.5 mr-1.5 -mt-0.5" />
                {pendingConfirmation.confirmLabel}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
