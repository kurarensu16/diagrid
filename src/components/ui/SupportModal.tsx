import React, { useState, useEffect } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Heart, 
  Send, 
  ShieldCheck, 
  QrCode,
  Sparkles,
  Wallet
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
  const [copied, setCopied] = useState(false);
  const [referenceCode, setReferenceCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('w-1');
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

  if (!isOpen) return null;

  const activeWallets: CreatorWallet[] = (settings.creator_wallets && settings.creator_wallets.length > 0)
    ? settings.creator_wallets.filter(w => w.enabled)
    : [
        {
          id: 'w-1',
          name: settings.creator_wallet_name || 'GCash',
          account_name: 'Diagrid Creator',
          account_number: settings.creator_wallet_account || '0912 345 6789',
          qr_url: settings.creator_wallet_qr_url || '',
          enabled: true
        }
      ];

  const currentWallet: CreatorWallet = 
    activeWallets.find(w => w.id === selectedWalletId) || activeWallets[0] || {
      id: 'default',
      name: 'Digital Wallet',
      account_number: '0912 345 6789',
      enabled: true
    };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentWallet.account_number.replace(/[^0-9+]/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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

            {/* High-contrast QR Code Representation */}
            <div className="w-48 h-48 border-2 border-rose-600 bg-white p-3 flex flex-col items-center justify-center shadow-md relative">
              {currentWallet.qr_url ? (
                <img 
                  src={currentWallet.qr_url} 
                  alt={`${currentWallet.name} QR Code`} 
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-rose-600 gap-1.5 text-center">
                  <QrCode className="w-28 h-28 text-rose-600" strokeWidth={1.5} />
                  <span className="font-mono text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                    SCAN QR TO PAY
                  </span>
                </div>
              )}
            </div>

            {/* Account Details & One-Click Copy */}
            <div className="flex flex-col items-center gap-2 w-full max-w-xs">
              <span className="text-[14px] font-bold font-mono text-ink break-all">
                {currentWallet.account_number}
                {currentWallet.account_name ? ` (${currentWallet.account_name})` : ''}
              </span>

              <button
                onClick={handleCopy}
                className={`w-full py-1.5 border font-mono text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  copied 
                    ? 'border-emerald-600 bg-emerald-600 text-white' 
                    : 'border-rose-600 text-rose-600 hover:bg-rose-600 hover:text-white bg-rose-50 dark:bg-rose-950/30'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'copied_to_clipboard' : 'copy_account_number()'}
              </button>
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
    </div>
  );
};
