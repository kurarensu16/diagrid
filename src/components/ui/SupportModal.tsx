import React, { useState, useEffect } from 'react';
import { 
  X, 
  Heart, 
  Send, 
  ShieldCheck, 
  Sparkles,
  Wallet,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useCurrentUser } from '../../services/mockAuth';
import { adminService, type PlatformSettings, type CreatorWallet } from '../../services/adminService';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaimSubmitted?: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose, onClaimSubmitted }) => {
  const user = useCurrentUser();
  const [referenceCode, setReferenceCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('w-1');
  const [settings, setSettings] = useState<PlatformSettings>(() => {
    try {
      const cached = localStorage.getItem('diagrid_platform_settings');
      if (cached) return JSON.parse(cached);
    } catch {}
    return {
      maintenance_mode: false,
      registration_policy: 'open',
      max_projects_per_user: 10,
      public_sharing: true,
      pdf_export: false,
      audit_retention_days: 30,
      creator_wallets: [
        { id: 'w-1', name: 'GCash', account_name: '', account_number: '', qr_url: '', enabled: true },
        { id: 'w-2', name: 'Maya', account_name: '', account_number: '', qr_url: '', enabled: true },
      ],
    };
  });

  useEffect(() => {
    if (isOpen) {
      adminService.getSystemSettings().then((s) => {
        setSettings(s);
        const active = (s.creator_wallets || []).filter(w => w.enabled);
        if (active.length > 0) {
          setSelectedWalletId(active[0].id);
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  if (!isOpen) return null;

  const activeWallets: CreatorWallet[] = (settings.creator_wallets && settings.creator_wallets.length > 0)
    ? settings.creator_wallets.filter(w => w.enabled)
    : [
        {
          id: 'w-1',
          name: settings.creator_wallet_name || 'GCash',
          account_name: '',
          account_number: '',
          qr_url: settings.creator_wallet_qr_url || '',
          enabled: true
        }
      ];

  const currentWallet: CreatorWallet = 
    activeWallets.find(w => w.id === selectedWalletId) || activeWallets[0] || {
      id: 'default',
      name: 'Digital Wallet',
      account_number: '',
      enabled: true
    };

  const handleClaimBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referenceCode.trim()) return;
    if (settings.creator_wallets_enabled === false) {
      setClaimStatus('NOTICE: Supporter claims are not available right now.');
      return;
    }

    setIsSubmitting(true);
    setClaimStatus(null);

    try {
      const result = await adminService.submitFeedback({
        userEmail: user?.email || 'supporter@diagrid.dev',
        type: 'feature',
        rating: 5,
        ratingLabel: 'Supporter Contribution',
        message: `[SUPPORTER CLAIM] Wallet/Bank: ${currentWallet.name} | Reference Code: ${referenceCode.trim()} (Sent by ${user?.email || 'Anonymous'})`,
      });

      if (result.error) throw new Error(result.error);

      onClaimSubmitted?.();
      setClaimStatus('REQUEST LOGGED: An administrator will verify your payment before activating the badge.');
      setReferenceCode('');
    } catch {
      setClaimStatus('ERROR: We could not log your reference. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/75 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div 
        className="bg-paper border-2 border-rose-600 shadow-[8px_8px_0px_0px_rgba(225,29,72,0.3)] w-full max-w-lg max-h-[92vh] flex flex-col text-ink font-sans overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-paper-raised">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-rose-500/10 border border-rose-500 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <Heart className="w-4.5 h-4.5 fill-rose-600 text-rose-600" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold tracking-tight font-mono flex items-center gap-2 text-ink">
                support_creator()
                <span className="text-[10px] px-1.5 py-0.2 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500 uppercase tracking-widest font-bold">
                  REVIEW_REQUIRED
                </span>
              </h2>
              <p className="text-[11px] text-ink-soft font-mono mt-0.5">
                // keep diagrid independent, open & free
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-paper border border-transparent hover:border-line text-ink-soft hover:text-rose-600 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          
          {/* Feature Disabled Notice */}
          {settings.creator_wallets_enabled === false && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/50 text-amber-900 dark:text-amber-200 font-mono text-[12px] flex items-start gap-2.5">
              <span>// NOTICE: Digital wallet contributions are temporarily on pause by the administrator.</span>
            </div>
          )}

          {/* Status Alert */}
          {claimStatus && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-600 text-emerald-800 dark:text-emerald-300 font-mono text-[12px] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{claimStatus}</span>
            </div>
          )}

          {/* Multiple Active Wallet Selector (if > 1 enabled) */}
          {activeWallets.length > 1 && (
            <div className="flex flex-col gap-1.5 font-mono">
              <span className="text-[11px] text-ink-soft uppercase font-bold">// select_payment_method:</span>
              <div className="flex flex-wrap gap-1.5">
                {activeWallets.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWalletId(w.id)}
                    className={`px-3 py-1.5 border font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors ${
                      selectedWalletId === w.id
                        ? 'border-rose-600 bg-rose-600 text-white shadow-sm'
                        : 'border-line text-ink-soft bg-paper hover:border-ink hover:text-ink'
                    }`}
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    {w.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* QR Code Focused Card */}
          <div className="border border-line bg-paper-raised p-6 flex flex-col items-center text-center gap-4">
            
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 border border-rose-600 text-rose-600 dark:text-rose-400 text-[11px] uppercase font-bold font-mono tracking-wider bg-rose-500/10">
                {currentWallet.name}
              </span>
            </div>

            {/* Image Container: Flexibly sized to fit tall standees or square QRs cleanly */}
            {currentWallet.qr_url ? (
              <div className="flex flex-col items-center gap-2">
                <div 
                  className="relative group cursor-zoom-in"
                  onClick={() => setIsFullscreen(true)}
                  title="Click to view full screen"
                >
                  <div className="w-full max-w-[280px] bg-white border border-rose-500/50 p-2 flex items-center justify-center shadow-md transition-all group-hover:border-rose-600">
                    <img 
                      src={currentWallet.qr_url} 
                      alt={`${currentWallet.name} QR Code`} 
                      className="w-full h-auto max-h-[420px] object-contain"
                    />
                  </div>
                  <div className="absolute inset-0 bg-ink/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="bg-ink text-paper font-mono text-[11px] font-bold px-2.5 py-1 border border-ink flex items-center gap-1.5 shadow-lg">
                      <Maximize2 className="w-3.5 h-3.5" />
                      view_fullscreen()
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFullscreen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 border border-line hover:border-rose-600 hover:text-rose-600 font-mono text-[11px] font-bold cursor-pointer transition-colors text-ink-soft bg-paper mt-1"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  fullscreen_qr()
                </button>
              </div>
            ) : (
              <div className="w-full max-w-[280px] border border-dashed border-line p-8 flex flex-col items-center justify-center text-ink-soft gap-2 text-center">
                <span className="font-mono text-[11px] text-ink-soft uppercase font-bold">
                  // no_qr_code_uploaded
                </span>
                <span className="font-mono text-[10px] text-ink-soft">
                  Please upload a QR code image in system settings.
                </span>
              </div>
            )}

            <div className="flex flex-col items-center gap-1 font-mono text-[11px] text-ink-soft">
              <span>// scan the qr code above with your {currentWallet.name} app</span>
            </div>

          </div>

          {/* Perks Highlight Box */}
          <div className="border border-rose-500/40 bg-rose-500/5 p-4 flex flex-col gap-2 font-mono text-[12px]">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold">
              <Sparkles className="w-4 h-4 text-rose-500" />
              <span>// SUPPORTER_EXCLUSIVE_PERKS</span>
            </div>
            <ul className="text-ink-soft space-y-1.5 pl-6 list-disc text-[12px]">
              <li>
                <strong className="text-ink">[❤️ SUPPORTER] Badge</strong> displayed beside your handle after your payment is verified.
              </li>
              <li>
                Directly covers Supabase database hosting, backups, and new canvas tools.
              </li>
            </ul>
          </div>

          {/* Claim Badge Submission Form */}
          <form onSubmit={handleClaimBadge} className="border border-line p-4 bg-paper flex flex-col gap-3">
            <div>
              <span className="font-mono font-bold text-[12px] text-ink flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                request_supporter_badge()
              </span>
              <p className="text-[11px] text-ink-soft font-mono mt-0.5">
                // sent a tip? enter your transfer reference or transaction code below
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
                placeholder="e.g. Reference # 1002 9482 1192"
                className="flex-1 px-3 py-2 border border-line bg-paper-raised text-[12px] font-mono focus:border-rose-600 focus:outline-none"
                required
              />
              <button
                type="submit"
                disabled={isSubmitting || !referenceCode.trim()}
                className="px-4 py-2 border border-rose-600 bg-rose-600 text-white hover:bg-rose-700 font-mono text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                {isSubmitting ? 'submitting...' : 'submit_request()'}
              </button>
            </div>
          </form>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-line bg-paper-raised flex items-center justify-between text-[11px] font-mono text-ink-soft">
          <span>diagrid // open developer architecture</span>
          <button 
            onClick={onClose}
            className="hover:text-rose-600 underline cursor-pointer"
          >
            close()
          </button>
        </div>
      </div>
      {/* Fullscreen QR Lightbox Modal */}
      {isFullscreen && currentWallet.qr_url && (
        <div 
          className="fixed inset-0 z-[100] bg-ink/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-8 animate-fadeIn"
          onClick={() => setIsFullscreen(false)}
        >
          <div 
            className="relative max-h-[92vh] max-w-[92vw] bg-white border-2 border-rose-600 shadow-2xl p-4 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-line mb-3 font-mono text-[12px]">
              <span className="font-bold text-ink flex items-center gap-2">
                <span className="px-2 py-0.5 border border-rose-600 bg-rose-500/10 text-rose-600 uppercase font-bold">
                  {currentWallet.name}
                </span>
                // qr_code_fullscreen
              </span>
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="p-1.5 border border-line hover:border-ink bg-paper text-ink transition-colors cursor-pointer flex items-center gap-1 font-mono text-[11px] font-bold"
                title="Close fullscreen view (Esc)"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                close_fullscreen()
              </button>
            </div>

            {/* Lightbox Large Image */}
            <div className="flex items-center justify-center overflow-auto max-h-[78vh]">
              <img 
                src={currentWallet.qr_url} 
                alt={`${currentWallet.name} Fullscreen QR`}
                className="w-auto h-auto max-h-[75vh] max-w-[85vw] object-contain" 
              />
            </div>

            {/* Lightbox Footer */}
            <div className="w-full pt-3 border-t border-line mt-3 flex items-center justify-between font-mono text-[11px] text-ink-soft">
              <span>// scan directly from your screen with your mobile banking or e-wallet app</span>
              <span className="hidden sm:inline">[press ESC or click outside to exit]</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
