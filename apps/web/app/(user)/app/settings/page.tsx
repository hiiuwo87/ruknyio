'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Camera,
  Save,
  MapPin,
  EyeOff,
  Mail,
  Phone,
  Globe,
  Lock,
  AlertTriangle,
  Trash2,
  UserX,
  UserCheck,
  Loader2,
  CheckCircle2,
  XCircle,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/providers';
import { cn } from '@/lib/utils';
import { usePhonePreview } from '@/components/(app)/shared';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  SettingsSection,
  SettingsField,
  SettingsRow,
  ToggleSwitch,
} from '@/components/(app)/settings';
import {
  getMyProfile,
  updateProfile,
  uploadAvatar,
  uploadCover,
  deactivateAccount,
  reactivateAccount,
  deleteAccountPermanently,
  type ProfileData,
} from '@/actions/settings';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function ProfileSettingsPage() {
  const { user } = useAuth();
  const { collapsed } = usePhonePreview();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [profileVisibility, setProfileVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [hideEmail, setHideEmail] = useState(false);
  const [hidePhone, setHidePhone] = useState(true);
  const [hideLocation, setHideLocation] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAccountDeactivated, setIsAccountDeactivated] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    displayName: '',
    username: '',
    bio: '',
    location: '',
  });

  // Fetch profile data on mount
  useEffect(() => {
    async function fetchProfile() {
      setIsLoading(true);
      const { data, error } = await getMyProfile();
      if (data) {
        setProfile(data);
        setForm({
          displayName: data.name || '',
          username: data.username || '',
          bio: data.bio || '',
          location: (data as any).location || '',
        });
        setProfileVisibility(data.visibility || 'PUBLIC');
        setHideEmail(data.hideEmail ?? false);
        setHidePhone(data.hidePhone ?? true);
        setHideLocation(data.hideLocation ?? false);
        setIsAccountDeactivated(data.user?.isDeactivated ?? false);
      }
      setIsLoading(false);
    }
    fetchProfile();
  }, []);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    setSaveError(null);

    const { data, error } = await updateProfile({
      name: form.displayName,
      username: form.username,
      bio: form.bio,
      location: form.location,
      visibility: profileVisibility,
      hideEmail,
      hidePhone,
      hideLocation,
    });

    if (error) {
      setSaveStatus('error');
      setSaveError(error);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } else {
      setSaveStatus('saved');
      if (data) setProfile(data);
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const { data, error } = await uploadAvatar(formData);
    if (!error && data) {
      // Update local profile state with new avatar
      setProfile((prev) => prev ? { ...prev, avatar: data.avatarUrl || data.avatar } : prev);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const { data, error } = await uploadCover(formData);
    if (!error && data) {
      setProfile((prev) => prev ? { ...prev, coverImage: data.coverUrl || data.coverImage } : prev);
    }
  };

  const handleDeactivate = async () => {
    setIsDeactivating(true);
    setActionError(null);
    const { error } = await deactivateAccount();
    setIsDeactivating(false);
    if (error) {
      setActionError(error);
    } else {
      setIsAccountDeactivated(true);
    }
  };

  const handleReactivate = async () => {
    setIsReactivating(true);
    setActionError(null);
    const { error } = await reactivateAccount();
    setIsReactivating(false);
    if (error) {
      setActionError(error);
    } else {
      setIsAccountDeactivated(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setIsDeleting(true);
    setActionError(null);
    const { error } = await deleteAccountPermanently('DELETE');
    setIsDeleting(false);
    if (error) {
      setActionError(error);
    } else {
      router.push('/login');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hidden file inputs */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarUpload}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverUpload}
      />

      {/* Avatar & Cover */}
      <SettingsSection title="الصورة الشخصية" description="صورة ملفك الشخصي وصورة الغلاف">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          {/* Avatar */}
          <div className="relative group">
            <div className="size-20 rounded-full overflow-hidden bg-gradient-to-br from-primary to-primary/70 shadow-sm shadow-primary/20 ring-1 ring-primary/10">
              {profile?.avatar ? (
                <img
                  src={profile.avatar}
                  alt={profile.name || ''}
                  className="size-full object-cover"
                />
              ) : (
                <span className="flex items-center justify-center size-full text-2xl font-bold text-primary-foreground">
                  {(profile?.name || user?.name || 'ر').charAt(0)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Camera className="size-5 text-white" />
            </button>
          </div>

          {/* Cover */}
          <div className="flex-1 w-full">
            <div
              onClick={() => coverInputRef.current?.click()}
              className="relative group h-24 rounded-2xl bg-muted/50 border border-dashed border-border/50 overflow-hidden cursor-pointer"
            >
              {profile?.coverImage ? (
                <img
                  src={profile.coverImage}
                  alt="Cover"
                  className="size-full object-cover"
                />
              ) : null}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity bg-black/20">
                <Camera className="size-5 text-white" />
                <span className="text-[11px] text-white">
                  {profile?.coverImage ? 'تغيير صورة الغلاف' : 'صورة الغلاف'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      <div className={cn('grid gap-5', collapsed ? 'lg:grid-cols-2' : 'grid-cols-1')}>
        {/* Basic Info */}
        <SettingsSection title="المعلومات الأساسية" description="اسمك واسم المستخدم والنبذة التعريفية" className="h-full">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingsField label="الاسم الكامل" htmlFor="displayName">
                <Input
                  id="displayName"
                  value={form.displayName}
                  onChange={(e) => updateField('displayName', e.target.value)}
                  placeholder="أدخل اسمك الكامل"
                />
              </SettingsField>

              <SettingsField label="اسم المستخدم" htmlFor="username">
                <div className="relative">
                  <Input
                    id="username"
                    value={form.username}
                    onChange={(e) => updateField('username', e.target.value)}
                    placeholder="username"
                    className="pe-16 justify-items-end-safe"
                    dir="ltr"
                  />
                </div>
              </SettingsField>
            </div>

            <SettingsField label="النبذة التعريفية" htmlFor="bio">
              <Textarea
                id="bio"
                value={form.bio}
                onChange={(e) => updateField('bio', e.target.value)}
                placeholder="اكتب نبذة قصيرة عنك..."
                className="min-h-20"
              />
            </SettingsField>

            <SettingsField label="الموقع الجغرافي" htmlFor="location">
              <div className="relative">
                <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => updateField('location', e.target.value)}
                  placeholder="مثال: بغداد، العراق"
                  className="pr-9"
                />
              </div>
            </SettingsField>
          </div>
        </SettingsSection>

        {/* Privacy */}
        <SettingsSection title="الخصوصية" description="تحكّم بمن يستطيع رؤية ملفك الشخصي ومعلوماتك" className="h-full">
          <div className="space-y-4">
            {/* Profile Visibility */}
            <SettingsField label="ظهور الملف الشخصي">
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'PUBLIC' as const, label: 'عام', icon: Globe, desc: 'مرئي للجميع' },
                  { key: 'PRIVATE' as const, label: 'خاص', icon: Lock, desc: 'المتابعين فقط' },
                ]).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setProfileVisibility(opt.key)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 transition-all cursor-pointer',
                      profileVisibility === opt.key
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent bg-background/50 hover:bg-muted/50'
                    )}
                  >
                    <opt.icon
                      className={cn(
                        'size-4',
                        profileVisibility === opt.key ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                    <span
                      className={cn(
                        'text-[12px] font-medium',
                        profileVisibility === opt.key ? 'text-primary' : 'text-foreground/80'
                      )}
                    >
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </SettingsField>

            <div className="space-y-2 pt-1">
              <SettingsRow>
                <div className="flex items-center gap-3 mt-4">
                  <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', hideEmail ? 'bg-amber-500/10' : 'bg-muted/50')}>
                    <Mail className={cn('size-4', hideEmail ? 'text-amber-500' : 'text-muted-foreground')} />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-foreground">إخفاء البريد الإلكتروني</p>
                    <p className="text-[11px] text-muted-foreground">لن يظهر بريدك في ملفك العام</p>
                  </div>
                </div>
                <ToggleSwitch checked={hideEmail} onChange={setHideEmail} />
              </SettingsRow>

              <SettingsRow>
                <div className="flex items-center gap-3 mt-4">
                  <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', hidePhone ? 'bg-amber-500/10' : 'bg-muted/50')}>
                    <Phone className={cn('size-4', hidePhone ? 'text-amber-500' : 'text-muted-foreground')} />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-foreground">إخفاء رقم الهاتف</p>
                    <p className="text-[11px] text-muted-foreground">لن يظهر رقمك في ملفك العام</p>
                  </div>
                </div>
                <ToggleSwitch checked={hidePhone} onChange={setHidePhone} />
              </SettingsRow>

              <SettingsRow>
                <div className="flex items-center gap-3 mt-4">
                  <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', hideLocation ? 'bg-amber-500/10' : 'bg-muted/50')}>
                    <MapPin className={cn('size-4', hideLocation ? 'text-amber-500' : 'text-muted-foreground')} />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-foreground">إخفاء الموقع الجغرافي</p>
                    <p className="text-[11px] text-muted-foreground">لن يظهر موقعك في ملفك العام</p>
                  </div>
                </div>
                <ToggleSwitch checked={hideLocation} onChange={setHideLocation} />
              </SettingsRow>
            </div>
          </div>
        </SettingsSection>
      </div>

      {/* Save Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-end gap-3"
      >
        {saveStatus === 'saved' && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-500">
            <CheckCircle2 className="size-3.5" />
            تم الحفظ بنجاح
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="flex items-center gap-1.5 text-xs text-destructive">
            <XCircle className="size-3.5" />
            {saveError || 'حدث خطأ'}
          </span>
        )}
        <Button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="gap-2"
        >
          {saveStatus === 'saving' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {saveStatus === 'saving' ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </Button>
      </motion.div>

      {/* Account Status Banner (when deactivated) */}
      {isAccountDeactivated && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5"
        >
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
              <ShieldAlert className="size-5 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">حسابك معطّل حالياً</h3>
              <p className="text-xs text-muted-foreground mt-1">
                ملفك الشخصي ومتجرك مخفيان عن الزوار. يمكنك إعادة تفعيل حسابك في أي وقت لاستعادة كل شيء كما كان.
              </p>
            </div>
            <Button
              onClick={handleReactivate}
              disabled={isReactivating}
              size="sm"
              className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white shrink-0"
            >
              <UserCheck className="size-3.5" />
              {isReactivating ? 'جاري التفعيل...' : 'إعادة التفعيل'}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Danger Zone */}
      <SettingsSection
        title="Danger Zone"
        description="إجراءات حساسة تؤثر على حسابك"
        className="border border-destructive/20 bg-destructive/5"
      >
        <div className="space-y-3">
          {actionError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-xs text-destructive flex items-center gap-2"
            >
              <XCircle className="size-3.5 shrink-0" />
              {actionError}
            </motion.div>
          )}

          {/* Deactivate / Reactivate */}
          <SettingsRow className="border border-border/30">
            <div className="flex items-center gap-3 mt-4">
              <div className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-xl',
                isAccountDeactivated ? 'bg-emerald-500/10' : 'bg-amber-500/10'
              )}>
                {isAccountDeactivated ? (
                  <UserCheck className="size-4 text-emerald-500" />
                ) : (
                  <UserX className="size-4 text-amber-500" />
                )}
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground">
                  {isAccountDeactivated ? 'إعادة تفعيل الحساب' : 'تعطيل الحساب مؤقتاً'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isAccountDeactivated
                    ? 'سيعود ملفك ومتجرك للظهور للجميع'
                    : 'سيتم إخفاء ملفك ومتجرك حتى تعيد التفعيل'}
                </p>
              </div>
            </div>
            {isAccountDeactivated ? (
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                onClick={handleReactivate}
                disabled={isReactivating}
              >
                {isReactivating ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <UserCheck className="size-3" />
                )}
                {isReactivating ? 'جاري التفعيل...' : 'تفعيل'}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={handleDeactivate}
                disabled={isDeactivating}
              >
                {isDeactivating ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <UserX className="size-3" />
                )}
                {isDeactivating ? 'جاري التعطيل...' : 'تعطيل'}
              </Button>
            )}
          </SettingsRow>

          {/* Delete */}
          <SettingsRow className="border border-destructive/20">
            <div className="flex items-center gap-3 mt-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                <Trash2 className="size-4 text-destructive" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-destructive">حذف الحساب نهائياً</p>
                <p className="text-[11px] text-muted-foreground">سيتم حذف جميع بياناتك ومتجرك ولا يمكن استرجاعها</p>
              </div>
            </div>
            {!showDeleteConfirm ? (
              <Button
                variant="destructive"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="size-3" />
                حذف
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder='اكتب DELETE للتأكيد'
                  className="h-8 w-32 text-xs"
                  dir="ltr"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                >
                  إلغاء
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs gap-1.5"
                  disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                  onClick={handleDelete}
                >
                  {isDeleting ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <AlertTriangle className="size-3" />
                  )}
                  تأكيد الحذف
                </Button>
              </div>
            )}
          </SettingsRow>
        </div>
      </SettingsSection>
    </div>
  );
}
