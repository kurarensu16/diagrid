import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import {
  adminService,
  type SupporterClaim,
  type AdminUser,
  type CreatorWallet,
} from '../../services/adminService';
import {
  Heart,
  Search,
  RefreshCw,
  CheckCircle2,
  Copy,
  Check,
  Clock,
  Wallet,
  ArrowRight,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminSupporters: React.FC = () => {
  const [claims, setClaims] = useState<SupporterClaim[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [wallets, setWallets] = useState<CreatorWallet[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [copiedRefId, setCopiedRefId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [claimsData, usersData, settingsData] = await Promise.all([
        adminService.getSupporterClaims(),
        adminService.getUsers(),
        adminService.getSystemSettings(),
      ]);
      setClaims(claimsData);
      setUsers(usersData);
      setWallets(settingsData.creator_wallets || []);
    } catch (err) {
      console.error('Failed to load supporter data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const promptApprove = (claim: SupporterClaim) => {
    setConfirmModal({
      isOpen: true,
      title: 'approve_supporter_claim()',
      message: `Approve contribution claim for ${claim.userEmail}?`,
      description: `Reference Code: ${claim.referenceCode} (${claim.walletName}). This will activate the [❤️ SUPPORTER] badge and donor perks for this user account.`,
      confirmText: 'approve_and_grant()',
      cancelText: 'cancel()',
      danger: false,
      onConfirm: async () => {
        const res = await adminService.approveSupporterClaim(
          claim.feedbackId,
          claim.userEmail
        );
        if (res.error) {
          showNotice(`Error: ${res.error}`);
        } else {
          showNotice(`Approved! Supporter perk activated for ${claim.userEmail}.`);
          await loadData();
        }
      },
    });
  };

  const promptReject = (claim: SupporterClaim) => {
    setConfirmModal({
      isOpen: true,
      title: 'reject_supporter_claim()',
      message: `Reject contribution claim for ${claim.userEmail}?`,
      description: `Reference Code: ${claim.referenceCode} (${claim.walletName}). This marks the claim as rejected in the queue.`,
      confirmText: 'reject_claim()',
      cancelText: 'cancel()',
      danger: true,
      onConfirm: async () => {
        const res = await adminService.rejectSupporterClaim(
          claim.feedbackId,
          'Reference code could not be verified in wallet transaction history.'
        );
        if (res.error) {
          showNotice(`Error: ${res.error}`);
        } else {
          showNotice(`Rejected claim for ${claim.userEmail}.`);
          await loadData();
        }
      },
    });
  };

  const promptTogglePerk = (userId: string, currentStatus: boolean, email: string) => {
    const nextStatus = !currentStatus;
    setConfirmModal({
      isOpen: true,
      title: nextStatus ? 'grant_supporter_perk()' : 'revoke_supporter_perk()',
      message: `${nextStatus ? 'Grant' : 'Revoke'} supporter badge for ${email}?`,
      description: nextStatus
        ? `This activates the [❤️ SUPPORTER] badge and perks on the user's profile and diagram exports.`
        : `This removes the [❤️ SUPPORTER] badge and perks from this user account.`,
      confirmText: nextStatus ? 'grant_badge()' : 'revoke_badge()',
      cancelText: 'cancel()',
      danger: !nextStatus,
      onConfirm: async () => {
        const res = await adminService.setUserSupporterStatus(userId, nextStatus);
        if (res.error) {
          showNotice(`Error: ${res.error}`);
        } else {
          showNotice(
            `${nextStatus ? 'Granted' : 'Revoked'} supporter perk for ${email}.`
          );
          await loadData();
        }
      },
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRefId(id);
    setTimeout(() => setCopiedRefId(null), 2000);
  };

  // Metrics calculation
  const pendingCount = claims.filter((c) => c.status === 'pending').length;
  const approvedCount = claims.filter((c) => c.status === 'approved').length;
  const activeSupporters = users.filter((u) => u.is_supporter);

  // Filtered claims
  const filteredClaims = claims.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (
      searchQuery &&
      !c.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !c.referenceCode.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !c.walletName.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="p-6 sm:p-8 flex flex-col gap-6 text-ink max-w-[1440px] mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 border-b border-line pb-6">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight flex items-center gap-2.5">
            <Heart className="w-7 h-7 fill-rose-600 text-rose-600" />
            supporters_and_perks
          </h1>
          <p className="text-[12px] sm:text-[13px] text-ink-soft font-mono mt-0.5">
            // verify payment reference codes, activate supporter badges, and manage donor perks
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={isLoading}
          className="flex items-center gap-1.5 font-mono text-[11px] border border-ink bg-paper px-3 py-1.5 hover:bg-paper-raised transition-colors cursor-pointer font-bold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blueprint' : ''}`} />
          sync_claims()
        </button>
      </div>

      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="bg-blueprint/10 border border-blueprint text-blueprint px-4 py-2.5 font-mono text-[12px] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>STATUS: {actionNotice}</span>
        </div>
      )}

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Claims */}
        <Card variant="signal" className="p-5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between font-mono text-[11px] text-ink-soft">
            <span>PENDING_VERIFICATION</span>
            <Clock className="w-4 h-4 text-signal" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[32px] font-bold font-mono text-signal">
              {pendingCount}
            </span>
            <span className="font-mono text-[11px] text-ink-soft">claims</span>
          </div>
          <p className="font-mono text-[10.5px] text-ink-soft">
            // claims awaiting reference verification
          </p>
        </Card>

        {/* Active Supporters */}
        <Card variant="blueprint" className="p-5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between font-mono text-[11px] text-ink-soft">
            <span>ACTIVE_SUPPORTERS</span>
            <Heart className="w-4 h-4 fill-rose-600 text-rose-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[32px] font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {activeSupporters.length}
            </span>
            <span className="font-mono text-[11px] text-ink-soft">profiles</span>
          </div>
          <p className="font-mono text-[10.5px] text-ink-soft">
            // active accounts with [❤️ SUPPORTER] badge
          </p>
        </Card>

        {/* Approved Claims */}
        <Card variant="ink" className="p-5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between font-mono text-[11px] text-ink-soft">
            <span>VERIFIED_CLAIMS</span>
            <UserCheck className="w-4 h-4 text-blueprint" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[32px] font-bold font-mono text-ink">
              {approvedCount}
            </span>
            <span className="font-mono text-[11px] text-ink-soft">approved</span>
          </div>
          <p className="font-mono text-[10.5px] text-ink-soft">
            // confirmed payment transactions
          </p>
        </Card>

        {/* Configured Payment Wallets */}
        <Card variant="blueprint" className="p-5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between font-mono text-[11px] text-ink-soft">
            <span>RECEIVING_WALLETS</span>
            <Wallet className="w-4 h-4 text-blueprint" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[32px] font-bold font-mono text-blueprint">
              {wallets.filter((w) => w.enabled).length}
            </span>
            <span className="font-mono text-[11px] text-ink-soft">wallets</span>
          </div>
          <Link
            to="/admin/system"
            className="font-mono text-[10.5px] text-blueprint hover:underline flex items-center gap-1"
          >
            <span>configure_in_settings()</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </Card>
      </div>

      {/* Main Section: Verification Queue */}
      <Card variant="blueprint" className="p-6 flex flex-col gap-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <h2 className="text-[18px] font-bold tracking-tight text-ink flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-signal" />
              claims_verification_queue
            </h2>
            <p className="text-[11px] text-ink-soft font-mono mt-0.5">
              // match reference codes with your GCash/Maya/Bank ledger, then grant perks
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter Tabs */}
            <div className="inline-flex border border-ink bg-paper p-0.5 font-mono text-[11px]">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 uppercase font-bold cursor-pointer transition-colors ${
                    statusFilter === s
                      ? 'bg-ink text-paper'
                      : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-ink-soft absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="search email / code..."
                className="pl-8 pr-3 py-1 border border-ink bg-paper text-ink font-mono text-[11px] focus:outline-none focus:border-blueprint"
              />
            </div>
          </div>
        </div>

        {/* Claims Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-[12px]">
            <thead>
              <tr className="border-b border-line bg-paper text-ink-soft font-bold text-[11px]">
                <th className="p-3.5 uppercase tracking-wide">supporter_email</th>
                <th className="p-3.5 uppercase tracking-wide">wallet_channel</th>
                <th className="p-3.5 uppercase tracking-wide">reference_code</th>
                <th className="p-3.5 uppercase tracking-wide">submitted_at</th>
                <th className="p-3.5 uppercase tracking-wide text-center">claim_status</th>
                <th className="p-3.5 uppercase tracking-wide text-right">actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-ink-soft font-mono text-[12px]">
                    // no_supporter_claims_found
                  </td>
                </tr>
              ) : (
                filteredClaims.map((claim) => {
                  const isPending = claim.status === 'pending';
                  const isApproved = claim.status === 'approved';
                  const isRejected = claim.status === 'rejected';

                  return (
                    <tr
                      key={claim.id}
                      className="border-b border-line last:border-0 hover:bg-paper hover:bg-opacity-40"
                    >
                      {/* Email */}
                      <td className="p-3.5 font-bold text-ink">
                        <div className="flex flex-col">
                          <span className="break-all">{claim.userEmail}</span>
                          {claim.isSupporterCurrently && (
                            <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1 mt-0.5">
                              <Heart className="w-2.5 h-2.5 fill-rose-600" />
                              [SUPPORTER_ACTIVE]
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Wallet */}
                      <td className="p-3.5 text-ink-soft">
                        <span className="border border-line bg-paper px-2 py-0.5 font-bold text-ink text-[11px]">
                          {claim.walletName}
                        </span>
                      </td>

                      {/* Reference Code with Copy Button */}
                      <td className="p-3.5">
                        <div className="inline-flex items-center gap-1.5 border border-ink bg-paper px-2 py-1 font-mono font-bold text-ink text-[11px]">
                          <span>{claim.referenceCode}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(claim.referenceCode, claim.id)}
                            className="text-ink-soft hover:text-ink cursor-pointer ml-1"
                            title="Copy reference code"
                          >
                            {copiedRefId === claim.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="p-3.5 text-ink-soft text-[11px]">
                        {new Date(claim.timestamp).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Claim Status */}
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 border text-[10px] uppercase font-bold ${
                            isApproved
                              ? 'border-emerald-600 text-emerald-600 bg-emerald-500/10'
                              : isPending
                              ? 'border-signal text-signal bg-signal/10 animate-pulse'
                              : 'border-line text-ink-soft bg-paper'
                          }`}
                        >
                          {claim.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => promptApprove(claim)}
                                className="px-2.5 py-1 border border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-600 hover:text-white text-[11px] font-bold cursor-pointer transition-colors"
                                title="Approve reference code and activate supporter badge"
                              >
                                approve()
                              </button>
                              <button
                                type="button"
                                onClick={() => promptReject(claim)}
                                className="px-2.5 py-1 border border-line text-ink-soft hover:border-signal hover:text-signal text-[11px] font-bold cursor-pointer transition-colors"
                                title="Reject invalid claim"
                              >
                                reject()
                              </button>
                            </>
                          )}

                          {isApproved && claim.userId && (
                            <button
                              type="button"
                              onClick={() =>
                                promptTogglePerk(
                                  claim.userId!,
                                  claim.isSupporterCurrently || false,
                                  claim.userEmail
                                )
                              }
                              className="px-2.5 py-1 border border-line hover:border-signal hover:text-signal text-[11px] font-bold cursor-pointer transition-colors text-ink-soft"
                            >
                              {claim.isSupporterCurrently ? 'revoke_badge()' : 're-grant_badge()'}
                            </button>
                          )}

                          {isRejected && (
                            <span className="text-[10px] text-ink-soft">
                              // {claim.adminNotes || 'rejected'}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Active Supporters Directory */}
      <Card variant="ink" className="p-6 flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-line pb-3">
          <div>
            <h2 className="text-[18px] font-bold tracking-tight text-ink flex items-center gap-2">
              <Heart className="w-4 h-4 fill-rose-600 text-rose-600" />
              active_supporters_directory
            </h2>
            <p className="text-[11px] text-ink-soft font-mono mt-0.5">
              // developers who currently have the [❤️ SUPPORTER] perk badge
            </p>
          </div>
          <div className="font-mono text-[11px] font-bold px-2 py-0.5 border border-line bg-paper text-ink">
            {activeSupporters.length} active
          </div>
        </div>

        {activeSupporters.length === 0 ? (
          <div className="text-ink-soft font-mono text-[11px] py-4 text-center">
            // no_active_supporters_yet
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 font-mono text-[11px]">
            {activeSupporters.map((supporter) => (
              <div
                key={supporter.id}
                className="flex items-center justify-between p-3 border border-rose-500/40 bg-rose-500/5"
              >
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  <span className="font-bold text-ink truncate">{supporter.email}</span>
                  <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                    <Heart className="w-2.5 h-2.5 fill-rose-600" />
                    SUPPORTER PERK ACTIVE
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => promptTogglePerk(supporter.id, true, supporter.email)}
                  className="px-2 py-1 border border-line hover:border-signal hover:text-signal text-[10px] font-bold cursor-pointer shrink-0 ml-2"
                  title="Revoke perk"
                >
                  revoke()
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={async () => {
          await confirmModal.onConfirm();
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }}
        title={confirmModal.title}
        message={confirmModal.message}
        description={confirmModal.description}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        danger={confirmModal.danger}
      />
    </div>
  );
};
