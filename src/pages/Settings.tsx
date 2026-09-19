import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User as UserIcon, 
  Upload, 
  Trash2, 
  Check, 
  Sliders, 
  Database, 
  LogOut, 
  ShieldAlert,
  Save,
  Info,
  Pencil,
  X,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  Sun, 
  Moon, 
  Palette, 
  Monitor,
  Heart
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Avatar, AVATAR_PRESETS } from '../components/ui/Avatar';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { SupportModal } from '../components/ui/SupportModal';
import { mockAuth, useCurrentUser, type User } from '../services/mockAuth';
import { authService } from '../services/authService';
import { adminService } from '../services/adminService';
import { storageService } from '../services/storageService';
import { themeService } from '../services/themeService';
import { cloudSaveStatus } from '../services/cloudSaveStatus';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const lastConfirmedAccountSave = cloudSaveStatus.getLastConfirmedSave(currentUser?.id);

  // Edit mode state: default is false (read-only view mode)
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Local form state initialized from current user
  const [name, setName] = useState(currentUser?.name || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatarType, setAvatarType] = useState<'preset' | 'custom' | 'initials'>(
    currentUser?.avatarType || (currentUser?.avatar ? 'custom' : 'preset')
  );
  const [presetAvatar, setPresetAvatar] = useState(
    currentUser?.presetAvatar || (currentUser?.role === 'admin' ? 'shield' : 'terminal')
  );
  const [customAvatar, setCustomAvatar] = useState(currentUser?.avatar || '');
  const [gridStyle, setGridStyle] = useState<'lines' | 'dots' | 'blank'>(
    currentUser?.gridStyle || 'lines'
  );
  const [snapToGrid, setSnapToGrid] = useState<boolean>(
    currentUser?.snapToGrid ?? true
  );
  const [theme, setTheme] = useState<'blueprint' | 'dark' | 'light'>(
    currentUser?.theme || themeService.getTheme() || 'blueprint'
  );

  // Live interactive demo canvas state for testing grid, snapping, and theme live
  const [demoPos, setDemoPos] = useState({ x: 60, y: 30 });
  const [isDemoDragging, setIsDemoDragging] = useState(false);

  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'appearance' | 'storage'>('profile');
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [storageUsageKb, setStorageUsageKb] = useState<number>(0);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isSupportEnabled, setIsSupportEnabled] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync settings for features like creator wallets
  useEffect(() => {
    adminService.getSystemSettings().then((s) => {
      setIsSupportEnabled(s.creator_wallets_enabled !== false);
    }).catch(() => {});
  }, []);

  // Sync state if currentUser changes from outside
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setBio(currentUser.bio || '');
      setAvatarType(currentUser.avatarType || (currentUser.avatar ? 'custom' : 'preset'));
      setPresetAvatar(currentUser.presetAvatar || (currentUser.role === 'admin' ? 'shield' : 'terminal'));
      setCustomAvatar(currentUser.avatar || '');
      setGridStyle(currentUser.gridStyle || 'lines');
      setSnapToGrid(currentUser.snapToGrid ?? true);
      setTheme(currentUser.theme || themeService.getTheme() || 'blueprint');
    }
  }, [currentUser]);

  // Auto-dismiss status message after 5 seconds
  useEffect(() => {
    if (!statusMsg) return;
    const timer = setTimeout(() => {
      setStatusMsg(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [statusMsg]);

  // Calculate approximate localStorage usage
  useEffect(() => {
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const val = localStorage.getItem(key) || '';
        totalBytes += (key.length + val.length) * 2;
      }
    }
    setStorageUsageKb(Math.round(totalBytes / 1024));
  }, []);

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditing) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatusMsg({ text: 'File must be an image (PNG, JPG, SVG, WebP).', type: 'error' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setStatusMsg({ text: 'Image exceeds 2MB limit. Please choose a smaller image.', type: 'error' });
      return;
    }

    setIsUploadingAvatar(true);
    setStatusMsg({ text: 'Uploading avatar to cloud storage...', type: 'success' });

    try {
      const result = await storageService.uploadAvatar(file);
      if (result.error || !result.url) {
        // Fallback to local base64 reader if storage upload fails or offline
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setCustomAvatar(base64);
          setAvatarType('custom');
          setStatusMsg({ text: 'Avatar image loaded locally. Click "save_changes()" to commit.', type: 'success' });
        };
        reader.readAsDataURL(file);
      } else {
        setCustomAvatar(result.url);
        setAvatarType('custom');
        setStatusMsg({ text: 'Avatar uploaded to Supabase Storage!', type: 'success' });
      }
    } catch {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setCustomAvatar(base64);
        setAvatarType('custom');
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveCustomAvatar = async () => {
    if (!isEditing) return;
    await storageService.removeAvatar();
    setCustomAvatar('');
    setAvatarType('preset');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setStatusMsg({ text: 'Custom avatar removed.', type: 'success' });
  };

  const handleCancelEdit = () => {
    if (currentUser) {
      setName(currentUser.name || '');
      setBio(currentUser.bio || '');
      setAvatarType(currentUser.avatarType || (currentUser.avatar ? 'custom' : 'preset'));
      setPresetAvatar(currentUser.presetAvatar || (currentUser.role === 'admin' ? 'shield' : 'terminal'));
      setCustomAvatar(currentUser.avatar || '');
    }
    setIsEditing(false);
    setStatusMsg(null);
  };

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const updates: Partial<User> = {
      name: name.trim() || undefined,
      bio: bio.trim() || undefined,
      avatarType,
      presetAvatar,
      avatar: avatarType === 'custom' ? customAvatar : undefined,
      gridStyle,
      snapToGrid,
      theme,
    };

    // Update via live authService if connected
    await authService.updateProfile({
      name: name.trim() || undefined,
      avatarType,
      presetAvatar,
      avatar: avatarType === 'custom' ? customAvatar : undefined,
      gridStyle,
      snapToGrid,
      theme,
    });

    mockAuth.updateUser(updates);
    setIsEditing(false);
    setStatusMsg({ text: 'Workspace preferences updated successfully!', type: 'success' });
    setTimeout(() => {
      setStatusMsg(null);
    }, 4000);
  };

  const handleSaveAppearance = async () => {
    themeService.setTheme(theme);
    mockAuth.updateUser({ theme });
    await authService.updateProfile({ theme });
    setStatusMsg({ text: `Appearance saved! Theme set to ${theme.toUpperCase()}.`, type: 'success' });
    setTimeout(() => {
      setStatusMsg(null);
    }, 4000);
  };

  const [isConfirmWipeOpen, setIsConfirmWipeOpen] = useState(false);

  const handleResetStorageConfirm = () => {
    localStorage.clear();
    setStatusMsg({ text: 'LocalStorage database cleared. Re-seeding defaults...', type: 'success' });
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

  const handleResetStorage = () => {
    setIsConfirmWipeOpen(true);
  };

  const handleLogout = async () => {
    await authService.signOut();
    navigate('/');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setStatusMsg({ text: 'Password must be at least 6 characters.', type: 'error' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setStatusMsg({ text: 'Passwords do not match.', type: 'error' });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await authService.updatePassword(newPassword);
      if (res.error) {
        setStatusMsg({ text: res.error, type: 'error' });
      } else {
        setNewPassword('');
        setConfirmNewPassword('');
        setStatusMsg({ text: 'Password updated successfully!', type: 'success' });
      }
    } catch (err: any) {
      setStatusMsg({ text: err?.message || 'Failed to update password.', type: 'error' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Preview user constructed from local active form state
  const previewUser: Partial<User> = {
    email: currentUser?.email || 'user@diagrid.dev',
    role: currentUser?.role || 'user',
    name: name || currentUser?.name,
    avatarType,
    presetAvatar,
    avatar: customAvatar,
    bio,
  };

  return (
    <div className="p-8 flex flex-col gap-6 text-ink max-w-[840px] select-none">
      {/* Page Header */}
      <div className="border-b border-line pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight">settings</h1>
          <p className="text-[13px] text-ink-soft font-mono mt-1">
            // configure developer profile, identity, and workspace preferences
          </p>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="flex border border-line bg-paper-raised p-1 font-mono text-[12px] shrink-0">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-ink text-paper font-bold'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            profile_identity
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-3 py-1.5 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'preferences'
                ? 'bg-ink text-paper font-bold'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            workspace_prefs
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`px-3 py-1.5 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'appearance'
                ? 'bg-ink text-paper font-bold'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            appearance
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`px-3 py-1.5 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'storage'
                ? 'bg-ink text-paper font-bold'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            storage_security
          </button>
        </div>
      </div>

      {/* Live Status Toast Banner */}
      {statusMsg && (
        <div 
          className={`border p-3.5 font-mono text-[12px] flex items-center justify-between gap-2 animate-in fade-in duration-200 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-600 text-emerald-800'
              : 'bg-signal/10 border-signal text-signal'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <Info className="w-4 h-4 shrink-0" />}
            <span>STATUS: {statusMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="hover:opacity-75 transition-opacity p-0.5 cursor-pointer shrink-0"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: PROFILE & IDENTITY */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
          {/* Identity Live Preview Card */}
          <Card variant="blueprint" className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6 border-b border-line">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <Avatar user={previewUser} size="xl" showStatus={true} statusOnline={true} />
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg md:text-xl font-bold font-mono text-ink truncate max-w-[240px] sm:max-w-none">
                      {name || currentUser?.email?.split('@')[0] || 'Anonymous Dev'}
                    </span>
                    <span 
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 border ${
                        currentUser?.role === 'admin' 
                          ? 'border-signal text-signal bg-signal/5' 
                          : 'border-blueprint text-blueprint bg-blueprint/5'
                      }`}
                    >
                      [{currentUser?.role?.toUpperCase() || 'USER'}]
                    </span>
                    {currentUser?.isSupporter && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 border border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-500/10 flex items-center gap-1">
                        <Heart className="w-3 h-3 fill-rose-600 text-rose-600" />
                        [❤️ SUPPORTER]
                      </span>
                    )}
                    {isEditing ? (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 border border-blueprint text-blueprint bg-blueprint/10 flex items-center gap-1">
                        <Unlock className="w-3 h-3" />
                        EDIT_ACTIVE
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-ink-soft px-2 py-0.5 border border-line bg-paper flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        VIEW_MODE
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono text-ink-soft truncate">{currentUser?.email}</span>
                  <p className="text-[12px] text-ink-soft italic mt-0.5 max-w-md line-clamp-2">
                    {bio || '// no bio set yet — click edit_profile() to add one'}
                  </p>
                </div>
              </div>

              {!isEditing ? (
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 shrink-0 px-4 py-2 text-[12px] border-ink bg-paper hover:bg-ink hover:text-paper self-start md:self-auto"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  edit_profile()
                </Button>
              ) : (
                <div className="flex items-center gap-2 shrink-0 flex-wrap self-start md:self-auto">
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] text-ink-soft hover:text-signal hover:border-signal"
                  >
                    <X className="w-3.5 h-3.5" />
                    cancel()
                  </Button>
                  <Button 
                    type="submit" 
                    variant="primary" 
                    className="flex items-center gap-1.5 px-4 py-2 text-[12px]"
                  >
                    <Save className="w-3.5 h-3.5" />
                    save_changes()
                  </Button>
                </div>
              )}
            </div>

            {/* Avatar Mode Display / Selector */}
            {!isEditing ? (
              <div className="mt-5 p-3.5 border border-dashed border-line bg-paper/60 flex items-center gap-2.5 font-mono text-[12px] text-ink-soft">
                <Lock className="w-3.5 h-3.5 text-ink-soft shrink-0" />
                <span>
                  Current avatar mode: <strong className="text-ink uppercase">{avatarType}</strong>
                  {avatarType === 'preset' ? ` (${AVATAR_PRESETS.find(p => p.id === presetAvatar)?.name || presetAvatar})` : ''}
                </span>
              </div>
            ) : (
              <div className="mt-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Unlock className="w-4 h-4 text-blueprint animate-pulse" />
                    <div>
                      <h3 className="font-bold text-[14px] font-mono uppercase tracking-wide">
                        avatar_selection_mode
                      </h3>
                      <p className="text-[11px] text-ink-soft font-mono">
                        // choose between retro blueprint presets, uploaded image, or monogram initials
                      </p>
                    </div>
                  </div>
                  <div className="flex border border-line bg-paper text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => setAvatarType('preset')}
                      className={`px-3 py-1 cursor-pointer transition-colors ${
                        avatarType === 'preset' ? 'bg-ink text-paper font-bold' : 'text-ink-soft hover:text-ink'
                      }`}
                    >
                      presets
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarType('custom')}
                      className={`px-3 py-1 cursor-pointer transition-colors ${
                        avatarType === 'custom' ? 'bg-ink text-paper font-bold' : 'text-ink-soft hover:text-ink'
                      }`}
                    >
                      custom_upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarType('initials')}
                      className={`px-3 py-1 cursor-pointer transition-colors ${
                        avatarType === 'initials' ? 'bg-ink text-paper font-bold' : 'text-ink-soft hover:text-ink'
                      }`}
                    >
                      initials
                    </button>
                  </div>
                </div>

                {/* MODE A: PRESETS GRID */}
                {avatarType === 'preset' && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                    {AVATAR_PRESETS.map((preset) => {
                      const isSelected = presetAvatar === preset.id;
                      const Icon = preset.icon;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setPresetAvatar(preset.id)}
                          className={`p-3 border flex flex-col items-center gap-2 text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'border-ink bg-paper-raised ring-2 ring-ink shadow-hard-blueprint scale-[1.02]'
                              : 'border-line bg-paper hover:border-ink hover:bg-paper-raised'
                          }`}
                        >
                          <div className={`w-10 h-10 flex items-center justify-center border border-ink ${preset.bgClass} ${preset.textClass}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <span className="font-mono text-[11px] font-bold text-ink truncate w-full">
                            {preset.name}
                          </span>
                          {isSelected && (
                            <span className="text-[9px] font-mono text-blueprint font-bold uppercase tracking-wider flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" /> ACTIVE
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* MODE B: CUSTOM IMAGE UPLOAD */}
                {avatarType === 'custom' && (
                  <div className="p-4 border border-dashed border-line bg-paper flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {customAvatar ? (
                        <img 
                          src={customAvatar} 
                          alt="Custom Avatar Preview" 
                          className="w-16 h-16 object-cover border border-ink shadow-sm shrink-0" 
                        />
                      ) : (
                        <div className="w-16 h-16 border border-dashed border-ink-soft flex items-center justify-center text-ink-soft font-mono text-[10px] shrink-0 text-center p-1">
                          no_image
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="font-mono text-[12px] font-bold text-ink">
                          {customAvatar ? 'Custom Image Loaded' : 'Upload Developer Portrait'}
                        </span>
                        <span className="text-[11px] font-mono text-ink-soft">
                          Supports PNG, JPG, WebP, or SVG up to 2MB
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        accept="image/*" 
                        className="hidden" 
                      />
                      <Button 
                        type="button" 
                        variant="secondary" 
                        disabled={isUploadingAvatar}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 text-[11px] py-2 px-3"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {isUploadingAvatar ? 'uploading...' : 'choose_file()'}
                      </Button>
                      {customAvatar && (
                        <Button 
                          type="button" 
                          variant="danger" 
                          onClick={handleRemoveCustomAvatar}
                          className="flex items-center gap-1.5 text-[11px] py-2 px-3"
                          title="Remove custom avatar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* MODE C: INITIALS MONOGRAM */}
                {avatarType === 'initials' && (
                  <div className="p-4 border border-line bg-paper flex items-center justify-between gap-4 font-mono">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 border border-ink bg-[#0B3C5D] text-white flex items-center justify-center font-bold text-lg shadow-sm">
                        {name ? name.slice(0, 2).toUpperCase() : (currentUser?.email?.slice(0, 2).toUpperCase() || 'DG')}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-ink">Procedural 2-Letter Monogram</span>
                        <span className="text-[11px] text-ink-soft">
                          Colors are deterministically derived from your account handle and name.
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-blueprint border border-blueprint px-2 py-1 bg-blueprint/5">
                      AUTO_GENERATED
                    </span>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Profile Identity Details Form */}
          <Card variant="blueprint" className="p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[18px] font-bold tracking-tight">developer_profile</h2>
                <p className="text-[11px] text-ink-soft font-mono mt-0.5">
                  // public metadata shown across your diagrams, headers, and comments
                </p>
              </div>
              {!isEditing ? (
                <span className="text-[11px] font-mono text-ink-soft border border-dashed border-line px-2 py-1 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  read_only
                </span>
              ) : (
                <span className="text-[11px] font-mono text-blueprint border border-blueprint px-2 py-1 bg-blueprint/5 flex items-center gap-1 font-bold">
                  <Unlock className="w-3 h-3" />
                  editable
                </span>
              )}
            </div>

            <div className="flex flex-col gap-4 mt-2">
              {/* Name field */}
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[12px] font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                  <span>display_name:</span>
                  {!isEditing && <Lock className="w-3 h-3 text-ink-soft" />}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!isEditing}
                  placeholder="e.g. Ada Lovelace"
                  className={`font-mono text-[13px] px-3.5 py-2.5 border transition-colors ${
                    isEditing
                      ? 'bg-paper border-ink text-ink focus:outline-none focus:ring-1 focus:ring-ink'
                      : 'bg-paper-raised/60 border-line text-ink cursor-not-allowed select-text'
                  }`}
                />
                <span className="text-[10px] font-mono text-ink-soft">
                  Displayed in navigation bars, project authorship, and export signatures.
                </span>
              </div>

              {/* Email field */}
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[12px] font-bold text-ink uppercase tracking-wider">
                  account_email (session):
                </label>
                <input
                  type="email"
                  value={currentUser?.email || ''}
                  disabled
                  className="font-mono text-[13px] px-3.5 py-2.5 bg-paper-raised border border-line text-ink-soft cursor-not-allowed"
                />
              </div>

              {/* Bio field */}
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[12px] font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                  <span>developer_bio / title:</span>
                  {!isEditing && <Lock className="w-3 h-3 text-ink-soft" />}
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={!isEditing}
                  placeholder="e.g. Lead Systems Engineer tinkering with ERDs and microservice schemas."
                  className={`font-mono text-[13px] px-3.5 py-2.5 border transition-colors resize-none ${
                    isEditing
                      ? 'bg-paper border-ink text-ink focus:outline-none focus:ring-1 focus:ring-ink'
                      : 'bg-paper-raised/60 border-line text-ink cursor-not-allowed select-text'
                  }`}
                />
              </div>
            </div>

            {/* Bottom Form Actions (Only visible when editing to save or cancel) */}
            {isEditing && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 border-t border-line pt-4">
                <span className="font-mono text-[11px] text-blueprint flex items-center gap-1.5">
                  <Unlock className="w-3.5 h-3.5 animate-pulse" />
                  editing active — remember to save changes
                </span>
                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] text-ink-soft hover:text-signal hover:border-signal"
                  >
                    <X className="w-3.5 h-3.5" />
                    cancel()
                  </Button>
                  <Button 
                    type="submit" 
                    variant="primary" 
                    className="flex items-center gap-1.5 px-4 py-2 text-[12px]"
                  >
                    <Save className="w-3.5 h-3.5" />
                    save_changes()
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Support Creator Card in Profile */}
          {isSupportEnabled && (
            <Card variant="blueprint" className="p-6 border-rose-500/40 bg-rose-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 border border-rose-500 bg-rose-500/10 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400">
                  <Heart className="w-5 h-5 fill-rose-600 text-rose-600" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[14px] font-bold text-ink flex items-center gap-2">
                    support_creator()
                    <span className="text-[10px] px-1.5 py-0.2 bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500 font-bold uppercase">
                      [❤️ SUPPORTER_PERKS]
                    </span>
                  </span>
                  <p className="text-[11.5px] text-ink-soft font-sans max-w-lg">
                    Diagrid is built by independent developers. Scan our digital wallet QR to support database costs and unlock your exclusive supporter badge!
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsSupportModalOpen(true)}
                className="shrink-0 border-rose-500 text-rose-700 dark:text-rose-400 hover:bg-rose-600 hover:text-white font-bold text-[12px] flex items-center gap-1.5 px-4 py-2"
              >
                <Heart className="w-3.5 h-3.5 fill-current" />
                open_qr_wallet()
              </Button>
            </Card>
          )}
        </form>
      )}

      {/* TAB 2: WORKSPACE PREFERENCES */}
      {activeTab === 'preferences' && (
        <Card variant="blueprint" className="p-6 flex flex-col gap-6">
          <div>
            <h2 className="text-[18px] font-bold tracking-tight">workspace_preferences</h2>
            <p className="text-[11px] text-ink-soft font-mono mt-0.5">
              // set default canvas grid styling, magnetic snapping, and visual theme
            </p>
          </div>

          <div className="flex flex-col gap-6 font-mono text-[13px]">
            {/* Canvas Grid Style */}
            <div className="flex flex-col gap-2 pb-5 border-b border-line">
              <span className="font-bold text-ink uppercase text-[12px]">canvas_grid_pattern:</span>
              <p className="text-[11px] text-ink-soft -mt-1 font-mono">
                Choose the background drafting grid pattern displayed in the visual canvas.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                {[
                  { id: 'lines', label: 'Grid Lines', desc: 'Standard 20px blueprint square grid' },
                  { id: 'dots', label: 'Dot Matrix', desc: 'Subtle dotted alignment points' },
                  { id: 'blank', label: 'Blank Canvas', desc: 'Clean white/solid drafting sheet' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setGridStyle(item.id as any)}
                    className={`p-3 border text-left flex flex-col gap-1 transition-colors cursor-pointer ${
                      gridStyle === item.id 
                        ? 'border-ink bg-paper-raised ring-2 ring-blueprint shadow-sm font-bold' 
                        : 'border-line bg-paper hover:border-ink'
                    }`}
                  >
                    <span className="font-bold text-[12px] text-ink">{item.label}</span>
                    <span className="text-[10px] text-ink-soft">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Snap to Grid Behavior */}
            <div className="flex flex-col gap-2 pb-5 border-b border-line">
              <span className="font-bold text-ink uppercase text-[12px]">magnetic_snapping:</span>
              <p className="text-[11px] text-ink-soft -mt-1 font-mono">
                Control coordinate alignment when dragging and positioning schematic elements.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                {[
                  { val: true, label: '20px Snap to Grid (Recommended)', desc: 'Keeps nodes, ports, and orthogonal lines cleanly aligned' },
                  { val: false, label: 'Freeform Positioning', desc: 'Fluid 1px precision without snapping constraints' },
                ].map((item) => (
                  <button
                    key={String(item.val)}
                    type="button"
                    onClick={() => setSnapToGrid(item.val)}
                    className={`p-3 border text-left flex flex-col gap-1 transition-colors cursor-pointer ${
                      snapToGrid === item.val 
                        ? 'border-ink bg-paper-raised ring-2 ring-blueprint shadow-sm font-bold' 
                        : 'border-line bg-paper hover:border-ink'
                    }`}
                  >
                    <span className="font-bold text-[12px] text-ink">{item.label}</span>
                    <span className="text-[10px] text-ink-soft">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>


            {/* Live Interactive Blueprint Preview */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink uppercase text-[12px]">live_canvas_preview:</span>
                <span className="text-[11px] text-blueprint font-mono">
                  // drag node below to test {snapToGrid ? '20px magnetic snap' : 'fluid freeform drag'}
                </span>
              </div>
              <div
                onMouseMove={(e) => {
                  if (!isDemoDragging) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const rawX = e.clientX - rect.left - 60;
                  const rawY = e.clientY - rect.top - 20;
                  const nextX = snapToGrid ? Math.round(rawX / 20) * 20 : Math.round(rawX);
                  const nextY = snapToGrid ? Math.round(rawY / 20) * 20 : Math.round(rawY);
                  setDemoPos({
                    x: Math.max(10, Math.min(nextX, rect.width - 150)),
                    y: Math.max(10, Math.min(nextY, rect.height - 60)),
                  });
                }}
                onMouseUp={() => setIsDemoDragging(false)}
                onMouseLeave={() => setIsDemoDragging(false)}
                className={`w-full h-44 border-2 border-ink rounded-none relative overflow-hidden select-none diagram-canvas ${
                  gridStyle === 'dots' ? 'bg-grid-dots' :
                  gridStyle === 'blank' ? 'bg-grid-blank' :
                  'bg-grid-lines'
                }`}
              >
                {/* Visual coordinate HUD */}
                <div className="absolute top-2 left-2 px-2 py-0.5 border border-line bg-paper/90 font-mono text-[10px] text-ink-soft pointer-events-none z-10">
                  x: {demoPos.x}px | y: {demoPos.y}px | grid: {gridStyle} | snap: {snapToGrid ? '20px' : 'off'} | theme: {theme}
                </div>

                {/* Draggable Demo Node */}
                <div
                  onMouseDown={() => setIsDemoDragging(true)}
                  style={{ transform: `translate(${demoPos.x}px, ${demoPos.y}px)` }}
                  className="absolute top-0 left-0 w-36 h-12 border-2 border-ink bg-paper-raised shadow-hard-blueprint cursor-grab active:cursor-grabbing flex items-center justify-center font-mono text-[11px] font-bold text-ink hover:border-blueprint transition-shadow"
                >
                  <div className="flex items-center gap-1.5 pointer-events-none">
                    <span className="w-2 h-2 rounded-full bg-blueprint"></span>
                    <span>Test Node</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-line pt-4">
            <Button variant="primary" onClick={() => handleSaveProfile()}>
              save_preferences()
            </Button>
          </div>
        </Card>
      )}

      {/* TAB: APPEARANCE */}
      {activeTab === 'appearance' && (
        <Card variant="blueprint" className="p-6 flex flex-col gap-6">
          <div>
            <h2 className="text-[18px] font-bold tracking-tight">appearance</h2>
            <p className="text-[11px] text-ink-soft font-mono mt-0.5">
              // control the app-wide color mode — applies instantly everywhere
            </p>
          </div>

          <div className="flex flex-col gap-4 font-mono">
            <span className="text-[11px] font-bold text-ink uppercase tracking-wider">color_mode:</span>

            {/* 3 large theme tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  id: 'blueprint' as const,
                  label: 'Blueprint',
                  desc: 'Light paper with blueprint ink',
                  icon: Palette,
                  bg: '#F6F7F5',
                  panel: '#FFFFFF',
                  accent: '#1E5C8C',
                  textMain: '#15191C',
                  textSoft: '#4A5359',
                  border: '#D7DBD8',
                  tag: 'LIGHT',
                },
                {
                  id: 'light' as const,
                  label: 'Light',
                  desc: 'Clean minimal white mode',
                  icon: Sun,
                  bg: '#F8FAFC',
                  panel: '#FFFFFF',
                  accent: '#2563EB',
                  textMain: '#0F172A',
                  textSoft: '#64748B',
                  border: '#E2E8F0',
                  tag: 'LIGHT',
                },
                {
                  id: 'dark' as const,
                  label: 'Dark',
                  desc: 'High-contrast dark console',
                  icon: Moon,
                  bg: '#0E1317',
                  panel: '#161D22',
                  accent: '#388BFD',
                  textMain: '#F0F6FC',
                  textSoft: '#8B949E',
                  border: '#263038',
                  tag: 'DARK',
                },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = theme === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTheme(item.id)}
                    className={`relative group border-2 text-left flex flex-col overflow-hidden transition-all cursor-pointer ${
                      isActive
                        ? 'border-blueprint shadow-hard-blueprint scale-[1.02]'
                        : 'border-line hover:border-ink hover:shadow-hard-ink'
                    }`}
                  >
                    {/* Large mock UI preview */}
                    <div
                      className="w-full h-28 p-3 flex flex-col gap-2 relative"
                      style={{ backgroundColor: item.bg }}
                    >
                      {/* Mock topbar */}
                      <div
                        className="w-full h-5 flex items-center gap-1.5 px-2 rounded-sm"
                        style={{ backgroundColor: item.panel, border: `1px solid ${item.border}` }}
                      >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.accent }} />
                        <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: item.textSoft, opacity: 0.25 }} />
                        <div className="w-8 h-1.5 rounded-full" style={{ backgroundColor: item.accent, opacity: 0.5 }} />
                      </div>
                      {/* Mock content rows */}
                      <div className="flex gap-2 flex-1">
                        {/* Mock sidebar */}
                        <div
                          className="w-10 h-full rounded-sm flex flex-col gap-1 p-1"
                          style={{ backgroundColor: item.panel, border: `1px solid ${item.border}` }}
                        >
                          {[0.8, 0.4, 0.4].map((op, i) => (
                            <div key={i} className="h-1.5 rounded-full w-full" style={{ backgroundColor: item.textMain, opacity: op * 0.5 }} />
                          ))}
                        </div>
                        {/* Mock canvas */}
                        <div
                          className="flex-1 h-full rounded-sm flex items-center justify-center"
                          style={{ 
                            backgroundColor: item.bg,
                            border: `1px solid ${item.border}`,
                            backgroundImage: `radial-gradient(${item.border} 1px, transparent 1px)`,
                            backgroundSize: '8px 8px',
                          }}
                        >
                          <div
                            className="w-14 h-5 rounded-sm flex items-center justify-center text-[6px] font-bold"
                            style={{ backgroundColor: item.panel, border: `1.5px solid ${item.accent}`, color: item.textMain }}
                          >
                            NODE
                          </div>
                        </div>
                      </div>
                      {/* Active checkmark badge */}
                      {isActive && (
                        <div
                          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: item.accent }}
                        >
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>

                    {/* Label footer */}
                    <div
                      className="px-3 py-2.5 flex items-center gap-2 border-t"
                      style={{ borderColor: item.border, backgroundColor: item.panel }}
                    >
                      <Icon
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: isActive ? item.accent : item.textSoft }}
                      />
                      <div className="flex-1">
                        <div
                          className="text-[12px] font-bold"
                          style={{ color: item.textMain }}
                        >
                          {item.label}
                        </div>
                        <div className="text-[10px]" style={{ color: item.textSoft }}>
                          {item.desc}
                        </div>
                      </div>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm"
                        style={{
                          backgroundColor: isActive ? item.accent : item.border,
                          color: isActive ? '#fff' : item.textSoft,
                        }}
                      >
                        {item.tag}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Current mode indicator */}
            <div className="flex items-center gap-2 text-[11px] text-ink-soft border border-line bg-paper p-2.5">
              <Monitor className="w-3.5 h-3.5 shrink-0 text-blueprint" />
              <span>
                Current mode: <strong className="text-ink uppercase">{theme}</strong>
                {' — '}click save below to apply and persist
              </span>
            </div>

            {/* Appearance Save Button */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-line pt-4 mt-2">
              <span className="font-mono text-[11px] text-ink-soft">
                // theme applies across dashboard, settings, and visual schematic editor
              </span>
              <Button 
                type="button"
                variant="primary" 
                onClick={handleSaveAppearance}
                className="flex items-center gap-1.5 px-4 py-2 text-[12px] self-end sm:self-auto cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                save_appearance()
              </Button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'storage' && (
        <div className="flex flex-col gap-6">
          {/* Account Info card */}
          <Card variant="blueprint" className="p-6 flex flex-col gap-4">
            <div>
              <h2 className="text-[18px] font-bold tracking-tight">account_session</h2>
              <p className="text-[11px] text-ink-soft font-mono mt-0.5">// active authentication token and metadata</p>
            </div>
            
            <div className="flex flex-col gap-3 mt-2 font-mono text-[13px]">
              <div className="grid grid-cols-3 border-b border-line pb-2.5">
                <span className="text-ink-soft">USER_EMAIL:</span>
                <span className="col-span-2 font-bold text-ink">{currentUser?.email || 'guest_user'}</span>
              </div>
              <div className="grid grid-cols-3 border-b border-line pb-2.5">
                <span className="text-ink-soft">ROLE_PERMISSION:</span>
                <span className={`col-span-2 font-bold uppercase ${currentUser?.role === 'admin' ? 'text-signal' : 'text-blueprint'}`}>
                  {currentUser?.role || 'user'}
                </span>
              </div>
              <div className="grid grid-cols-3 border-b border-line pb-2.5">
                <span className="text-ink-soft">LOCAL_DB_USAGE:</span>
                <span className="col-span-2 text-ink">~{storageUsageKb} KB stored in browser</span>
              </div>
              <div className="grid grid-cols-3 border-b border-line pb-2.5">
                <span className="text-ink-soft">Last account save:</span>
                <span className="col-span-2 text-ink">
                  {lastConfirmedAccountSave
                    ? new Date(lastConfirmedAccountSave).toLocaleString()
                    : 'No confirmed save on this device yet'}
                </span>
              </div>
              <div className="grid grid-cols-3">
                <span className="text-ink-soft">ENGINE_VERSION:</span>
                <span className="col-span-2 text-ink-soft">V0.1 (UI-FIRST SPRINT)</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4 border-t border-line pt-4">
              <Button variant="secondary" onClick={handleLogout} className="flex items-center gap-1.5">
                <LogOut className="w-3.5 h-3.5" />
                sign_out()
              </Button>
            </div>
          </Card>

          {/* Security / Password Management Card */}
          <Card variant="blueprint" className="p-6 flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blueprint" />
                <h2 className="text-[18px] font-bold tracking-tight">security_credentials</h2>
              </div>
              <p className="text-[11px] text-ink-soft font-mono mt-0.5">
                // change your account authentication password
              </p>
            </div>

            <form onSubmit={handleChangePassword} className="flex flex-col gap-4 mt-1 max-w-[480px]">
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[11px] text-ink-soft">NEW_PASSWORD</label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-ink-soft absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border border-line bg-paper pl-9 pr-10 py-2 text-[13px] font-mono focus:border-ink focus:outline-none"
                    placeholder="min. 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink cursor-pointer bg-transparent border-none p-0"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-mono text-[11px] text-ink-soft">CONFIRM_NEW_PASSWORD</label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-ink-soft absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirmNewPassword ? 'text' : 'password'}
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full border border-line bg-paper pl-9 pr-10 py-2 text-[13px] font-mono focus:border-ink focus:outline-none"
                    placeholder="re-enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink cursor-pointer bg-transparent border-none p-0"
                  >
                    {showConfirmNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-start pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isChangingPassword || !newPassword}
                  className="flex items-center gap-1.5 text-[12px] py-2 px-4"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  {isChangingPassword ? 'updating_password()...' : 'update_password()'}
                </Button>
              </div>
            </form>
          </Card>

          {/* Storage config card */}
          <Card variant="signal" className="p-6 flex flex-col gap-4">
            <div>
              <h2 className="text-[18px] font-bold tracking-tight text-signal">developer_storage_controls</h2>
              <p className="text-[11px] text-ink-soft font-mono mt-0.5">// management tools for prototype client db</p>
            </div>

            <p className="text-[13px] text-ink-soft leading-relaxed mt-1">
              Diagrid stores all custom projects, diagrams, and code snippets inside your browser's local sandbox state. If you experience visual styling bugs or want to reset to original template files, you can trigger a full database wipe below.
            </p>

            <div className="flex justify-end gap-3 mt-4 border-t border-line pt-4">
              <Button variant="danger" onClick={handleResetStorage} className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                wipe_local_database()
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Database Wipe Confirmation Modal */}
      <ConfirmModal
        isOpen={isConfirmWipeOpen}
        onClose={() => setIsConfirmWipeOpen(false)}
        onConfirm={handleResetStorageConfirm}
        title="WIPE_LOCAL_DATABASE"
        message="Wipe local sandbox database and reset defaults?"
        description="WARNING: This will permanently delete ALL custom projects, diagrams, and local settings and re-seed defaults. This cannot be undone."
        confirmText="Wipe Everything"
        danger={true}
        requireMatchString="RESET"
      />

      {/* Support Creator Modal */}
      <SupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        onClaimSubmitted={() => {
          setStatusMsg({ text: 'Support request sent. Your badge will appear after payment verification.', type: 'success' });
        }}
      />
    </div>
  );
};
