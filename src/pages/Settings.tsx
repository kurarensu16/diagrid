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
  EyeOff
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Avatar, AVATAR_PRESETS } from '../components/ui/Avatar';
import { mockAuth, useCurrentUser, type User } from '../services/mockAuth';
import { authService } from '../services/authService';
import { storageService } from '../services/storageService';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();

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
  const [defaultNotation, setDefaultNotation] = useState<'erd' | 'flowchart' | 'sequence'>(
    currentUser?.defaultNotation || 'erd'
  );
  const [theme, setTheme] = useState<'blueprint' | 'dark' | 'light'>(
    currentUser?.theme || 'blueprint'
  );

  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'storage'>('profile');
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [storageUsageKb, setStorageUsageKb] = useState<number>(0);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if currentUser changes from outside
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setBio(currentUser.bio || '');
      setAvatarType(currentUser.avatarType || (currentUser.avatar ? 'custom' : 'preset'));
      setPresetAvatar(currentUser.presetAvatar || (currentUser.role === 'admin' ? 'shield' : 'terminal'));
      setCustomAvatar(currentUser.avatar || '');
      setDefaultNotation(currentUser.defaultNotation || 'erd');
      setTheme(currentUser.theme || 'blueprint');
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
      defaultNotation,
      theme,
    };

    // Update via live authService if connected
    await authService.updateProfile({
      name: name.trim() || undefined,
      avatarType,
      presetAvatar,
      avatar: avatarType === 'custom' ? customAvatar : undefined,
      theme,
    });

    mockAuth.updateUser(updates);
    setIsEditing(false);
    setStatusMsg({ text: 'Profile configuration updated successfully!', type: 'success' });
    setTimeout(() => {
      setStatusMsg(null);
    }, 4000);
  };

  const handleResetStorage = () => {
    if (confirm('WARNING: This will delete ALL custom projects, diagrams, and local settings and re-seed defaults. Proceed?')) {
      localStorage.clear();
      setStatusMsg({ text: 'LocalStorage database cleared. Re-seeding defaults...', type: 'success' });
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    }
  };

  const handleLogout = async () => {
    await authService.signOut();
    mockAuth.logout();
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
        </form>
      )}

      {/* TAB 2: WORKSPACE PREFERENCES */}
      {activeTab === 'preferences' && (
        <Card variant="blueprint" className="p-6 flex flex-col gap-6">
          <div>
            <h2 className="text-[18px] font-bold tracking-tight">workspace_preferences</h2>
            <p className="text-[11px] text-ink-soft font-mono mt-0.5">
              // set default canvas behaviors, diagram engines, and export styles
            </p>
          </div>

          <div className="flex flex-col gap-5 font-mono text-[13px]">
            {/* Preferred Diagram Engine */}
            <div className="flex flex-col gap-2 pb-4 border-b border-line">
              <span className="font-bold text-ink uppercase text-[12px]">default_diagram_notation:</span>
              <p className="text-[11px] text-ink-soft -mt-1 font-mono">
                When initiating a new project, pre-select this template and visual preset.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                {[
                  { id: 'erd', label: "ERD (Crow's Foot)", desc: 'Relational Database Schema' },
                  { id: 'flowchart', label: 'Flowchart', desc: 'Step-by-step logic workflows' },
                  { id: 'sequence', label: 'Sequence', desc: 'Message exchange protocols' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDefaultNotation(item.id as any)}
                    className={`p-3 border text-left flex flex-col gap-1 transition-colors cursor-pointer ${
                      defaultNotation === item.id 
                        ? 'border-ink bg-paper-raised ring-1 ring-ink shadow-sm' 
                        : 'border-line bg-paper hover:border-ink'
                    }`}
                  >
                    <span className="font-bold text-[12px] text-ink">{item.label}</span>
                    <span className="text-[10px] text-ink-soft">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Canvas Theme */}
            <div className="flex flex-col gap-2 pb-4 border-b border-line">
              <span className="font-bold text-ink uppercase text-[12px]">blueprint_theme_styling:</span>
              <p className="text-[11px] text-ink-soft -mt-1 font-mono">
                Configure default background grid pattern and visual ink contrast.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                {[
                  { id: 'blueprint', label: 'Paper Blueprint', desc: 'Light blueprint paper with ink lines' },
                  { id: 'dark', label: 'Terminal Dark', desc: 'High-contrast darkroom console' },
                  { id: 'light', label: 'Clean Drafting', desc: 'Ultra-minimal monochrome canvas' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTheme(item.id as any)}
                    className={`p-3 border text-left flex flex-col gap-1 transition-colors cursor-pointer ${
                      theme === item.id 
                        ? 'border-ink bg-paper-raised ring-1 ring-ink shadow-sm' 
                        : 'border-line bg-paper hover:border-ink'
                    }`}
                  >
                    <span className="font-bold text-[12px] text-ink">{item.label}</span>
                    <span className="text-[10px] text-ink-soft">{item.desc}</span>
                  </button>
                ))}
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

      {/* TAB 3: STORAGE & SYSTEM */}
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
                <span className="text-ink-soft">BACKEND_PROVIDER:</span>
                <span className="col-span-2 flex items-center gap-1.5 font-bold">
                  <span className={`w-2 h-2 rounded-full ${authService.isConfigured() ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span className={authService.isConfigured() ? 'text-emerald-700' : 'text-amber-800'}>
                    {authService.isConfigured() ? 'Supabase Cloud Connected' : 'Supabase Not Configured (set .env)'}
                  </span>
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
    </div>
  );
};
