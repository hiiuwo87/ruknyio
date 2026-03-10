'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  Smartphone,
  Monitor,
  LogOut,
  Mail,
  Phone,
  Loader2,
  CheckCircle2,
  XCircle,
  Link2,
  QrCode,
  Copy,
  Lock,
  ShieldCheck,
  BadgeCheck,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/providers';
import { usePhonePreview } from '@/components/(app)/shared/phone-preview-context';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  SettingsSection,
  SettingsField,
  SettingsRow,
  ToggleSwitch,
} from '@/components/(app)/settings';
import {
  getUserProfile,
  getMyProfile,
  getSessions,
  changeEmail,
  sendEmailVerification,
  verifyEmailCode,
  getEmailChangeRequest,
  cancelEmailChangeRequest,
  setup2FA,
  verify2FA,
  disable2FA,
  deleteSession,
  deleteAllOtherSessions,
  type UserProfile,
  type SessionData,
  type ProfileData,
  type EmailChangeRequestData,
} from '@/actions/settings';

function getDeviceIcon(session: SessionData) {
  const deviceType = session.deviceType?.toLowerCase() || '';
  const os = session.os?.toLowerCase() || '';
  if (deviceType.includes('mobile') || os.includes('ios') || os.includes('android')) {
    return Smartphone;
  }
  return Monitor;
}

function formatLastActivity(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return 'نشط الآن';
  if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  if (diffDays < 7) return `منذ ${diffDays} يوم`;
  return date.toLocaleDateString('ar-IQ');
}

export default function AccountSecurityPage() {
  const { user } = useAuth();
  const { collapsed } = usePhonePreview();
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);

  // Email change state
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);

  // Email change request state
  const [emailChangeRequest, setEmailChangeRequest] = useState<EmailChangeRequestData | null>(null);
  const [isCancellingRequest, setIsCancellingRequest] = useState(false);

  // Email verification state
  const [showVerification, setShowVerification] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [emailVerifyCode, setEmailVerifyCode] = useState('');
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [twoFAError, setTwoFAError] = useState<string | null>(null);
  const [is2FALoading, setIs2FALoading] = useState(false);

  // Session management
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const [userRes, profileRes, sessionsRes, emailReqRes] = await Promise.all([
        getUserProfile(),
        getMyProfile(),
        getSessions(),
        getEmailChangeRequest(),
      ]);

      if (userRes.data) {
        setUserProfile(userRes.data);
        setTwoFactorEnabled(userRes.data.twoFactorEnabled);
      }
      if (profileRes.data) {
        setProfileData(profileRes.data);
      }
      if (sessionsRes.data) {
        setSessions(sessionsRes.data);
      }
      if (emailReqRes.data) {
        setEmailChangeRequest(emailReqRes.data);
      }
      setIsLoading(false);
    }
    loadData();
  }, []);

  // Handle email change
  const handleChangeEmail = async () => {
    if (!newEmail) return;
    setEmailError(null);
    setEmailSuccess(false);
    setIsChangingEmail(true);

    const { error, data } = await changeEmail(newEmail);
    setIsChangingEmail(false);

    if (error) {
      setEmailError(error);
    } else {
      setEmailSuccess(true);
      setNewEmail('');
      // Refresh email change request status
      const { data: reqData } = await getEmailChangeRequest();
      if (reqData) setEmailChangeRequest(reqData);
      setTimeout(() => setEmailSuccess(false), 5000);
    }
  };

  // Handle cancel email change request
  const handleCancelRequest = async () => {
    setIsCancellingRequest(true);
    const { error } = await cancelEmailChangeRequest();
    setIsCancellingRequest(false);
    if (!error) {
      setEmailChangeRequest(null);
    }
  };

  // Handle send email verification
  const handleSendVerification = async () => {
    setIsSendingVerification(true);
    setVerifyError(null);
    const { error } = await sendEmailVerification();
    setIsSendingVerification(false);
    if (error) {
      setVerifyError(error);
    } else {
      setVerificationSent(true);
      setShowVerification(true);
    }
  };

  // Handle verify email code
  const handleVerifyEmail = async () => {
    if (!emailVerifyCode) return;
    setIsVerifyingEmail(true);
    setVerifyError(null);
    const { error } = await verifyEmailCode(emailVerifyCode);
    setIsVerifyingEmail(false);
    if (error) {
      setVerifyError(error);
    } else {
      // Refresh profile to get updated emailVerified
      const { data } = await getUserProfile();
      if (data) {
        setUserProfile(data);
      }
      setShowVerification(false);
      setEmailVerifyCode('');
      setVerificationSent(false);
    }
  };

  // Handle 2FA toggle
  const handle2FAToggle = async (enabled: boolean) => {
    if (enabled) {
      // Start 2FA setup
      setIs2FALoading(true);
      setTwoFAError(null);
      const { data, error } = await setup2FA();
      setIs2FALoading(false);

      if (error) {
        setTwoFAError(error);
        return;
      }

      if (data) {
        setQrCode(data.qrCode);
        setTwoFactorSecret(data.secret);
        setShow2FASetup(true);
      }
    } else {
      // Show disable form
      setShow2FASetup(true);
      setQrCode(null);
      setTwoFactorSecret(null);
    }
  };

  const handleVerify2FA = async () => {
    if (!verificationCode) return;
    setIs2FALoading(true);
    setTwoFAError(null);

    if (twoFactorEnabled) {
      // Disabling
      const { error } = await disable2FA(verificationCode);
      setIs2FALoading(false);
      if (error) {
        setTwoFAError(error);
      } else {
        setTwoFactorEnabled(false);
        setShow2FASetup(false);
        setVerificationCode('');
      }
    } else {
      // Enabling
      const { error } = await verify2FA(verificationCode);
      setIs2FALoading(false);
      if (error) {
        setTwoFAError(error);
      } else {
        setTwoFactorEnabled(true);
        setShow2FASetup(false);
        setVerificationCode('');
        setQrCode(null);
        setTwoFactorSecret(null);
      }
    }
  };

  // Handle session deletion
  const handleDeleteSession = async (sessionId: string) => {
    setDeletingSessionId(sessionId);
    const { error } = await deleteSession(sessionId);
    setDeletingSessionId(null);
    if (!error) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    }
  };

  const handleDeleteAllOther = async () => {
    setIsDeletingAll(true);
    const { error } = await deleteAllOtherSessions();
    setIsDeletingAll(false);
    if (!error) {
      setSessions((prev) => prev.filter((s) => s.isCurrent));
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
    <div className="space-y-5 mt-2">
      {/* Row 1: Contact Info + Login Method */}
      <div className={cn('grid gap-5', collapsed ? 'lg:grid-cols-2' : 'grid-cols-1')}>
        {/* Email & Phone */}
        <SettingsSection
          className="h-full"
          title="معلومات الاتصال"
          description="بريدك الإلكتروني ورقم هاتفك المرتبطين بحسابك"
        >
        <div className="space-y-3">
          <SettingsRow>
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Mail className="size-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground truncate">
                  {userProfile?.email || user?.email || 'لم يتم الإضافة'}
                </p>
                <p className="text-[11px] text-muted-foreground">البريد الإلكتروني</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {userProfile?.emailVerified ? (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <BadgeCheck className="size-3" />
                  مُوثّق
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px] gap-1">
                  <AlertCircle className="size-3" />
                  غير مُوثّق
                </Badge>
              )}
            </div>
          </SettingsRow>

          {/* Email Change Requirements & Form */}
          <div className="px-4 space-y-3">
            {/* Email Verification Flow - when not verified */}
            {!userProfile?.emailVerified && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-3.5 text-destructive" />
                  <p className="text-[12px] font-medium text-foreground">بريدك الإلكتروني غير مُوثّق</p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  قم بتوثيق بريدك الإلكتروني لحماية حسابك وتمكين تغيير البريد مستقبلاً
                </p>

                {!showVerification ? (
                  <Button
                    size="sm"
                    className="text-xs gap-1.5 w-full"
                    onClick={handleSendVerification}
                    disabled={isSendingVerification}
                  >
                    {isSendingVerification ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Mail className="size-3" />
                    )}
                    {isSendingVerification ? 'جاري الإرسال...' : 'إرسال رمز التوثيق'}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    {verificationSent && (
                      <p className="text-[11px] text-emerald-500 flex items-center gap-1">
                        <CheckCircle2 className="size-3" />
                        تم إرسال رمز التحقق إلى بريدك الإلكتروني
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Input
                        value={emailVerifyCode}
                        onChange={(e) => setEmailVerifyCode(e.target.value)}
                        placeholder="أدخل رمز التحقق"
                        className="flex-1 text-center"
                        maxLength={6}
                        dir="ltr"
                      />
                      <Button
                        size="sm"
                        className="text-xs gap-1.5"
                        onClick={handleVerifyEmail}
                        disabled={isVerifyingEmail || !emailVerifyCode}
                      >
                        {isVerifyingEmail ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-3" />
                        )}
                        توثيق
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        className="text-[11px] text-primary hover:underline cursor-pointer"
                        onClick={handleSendVerification}
                        disabled={isSendingVerification}
                      >
                        {isSendingVerification ? 'جاري الإرسال...' : 'إعادة إرسال الرمز'}
                      </button>
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                        onClick={() => {
                          setShowVerification(false);
                          setEmailVerifyCode('');
                          setVerifyError(null);
                        }}
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}

                {verifyError && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <XCircle className="size-3" />
                    {verifyError}
                  </p>
                )}
              </div>
            )}

            {/* Requirements checklist */}
            {(!userProfile?.emailVerified || !twoFactorEnabled) && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Lock className="size-3.5 text-amber-500" />
                  <p className="text-[12px] font-medium text-foreground">تغيير البريد الإلكتروني مقفل</p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  يجب استيفاء الشروط التالية قبل تغيير بريدك الإلكتروني:
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    {userProfile?.emailVerified ? (
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                    ) : (
                      <XCircle className="size-3.5 text-destructive" />
                    )}
                    <span className={cn('text-[11px]', userProfile?.emailVerified ? 'text-emerald-600' : 'text-muted-foreground')}>
                      توثيق البريد الإلكتروني الحالي
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {twoFactorEnabled ? (
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                    ) : (
                      <XCircle className="size-3.5 text-destructive" />
                    )}
                    <span className={cn('text-[11px]', twoFactorEnabled ? 'text-emerald-600' : 'text-muted-foreground')}>
                      تفعيل المصادقة الثنائية (2FA)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Email change request status */}
            {emailChangeRequest && (
              <div className={cn(
                'rounded-xl border p-3 space-y-2',
                emailChangeRequest.status === 'PENDING' && 'border-amber-500/20 bg-amber-500/5',
                emailChangeRequest.status === 'APPROVED' && 'border-emerald-500/20 bg-emerald-500/5',
                emailChangeRequest.status === 'REJECTED' && 'border-destructive/20 bg-destructive/5',
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {emailChangeRequest.status === 'PENDING' && (
                      <>
                        <p className="text-[12px] font-medium text-amber-600">طلب قيد المراجعة</p>
                      </>
                    )}
                    {emailChangeRequest.status === 'APPROVED' && (
                      <>
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                        <p className="text-[12px] font-medium text-emerald-600">تم قبول الطلب</p>
                      </>
                    )}
                    {emailChangeRequest.status === 'REJECTED' && (
                      <>
                        <XCircle className="size-3.5 text-destructive" />
                        <p className="text-[12px] font-medium text-destructive">تم رفض الطلب</p>
                      </>
                    )}
                  </div>
                  {emailChangeRequest.status === 'PENDING' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[11px] h-6 px-2 text-muted-foreground hover:text-destructive"
                      onClick={handleCancelRequest}
                      disabled={isCancellingRequest}
                    >
                      {isCancellingRequest ? <Loader2 className="size-3 animate-spin" /> : 'إلغاء الطلب'}
                    </Button>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">
                    البريد الجديد: <span className="font-medium text-foreground" dir="ltr">{emailChangeRequest.newEmail}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    تاريخ الطلب: {new Date(emailChangeRequest.createdAt).toLocaleDateString('en-ar', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  {emailChangeRequest.reason && (
                    <p className="text-[11px] text-muted-foreground">
                      السبب: <span className="text-foreground">{emailChangeRequest.reason}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Email change form - only shown when requirements are met and no pending request */}
            {userProfile?.emailVerified && twoFactorEnabled && emailChangeRequest?.status !== 'PENDING' && (
              <div className="space-y-2.5">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <ShieldCheck className="size-3.5 text-primary" />
                    <p className="text-[12px] font-medium text-foreground">طلب تغيير البريد الإلكتروني</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    سيتم مراجعة طلبك من قبل فريق الدعم قبل تطبيق التغيير
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="البريد الإلكتروني الجديد"
                    type="email"
                    dir="ltr"
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={handleChangeEmail}
                    disabled={isChangingEmail || !newEmail}
                  >
                    {isChangingEmail ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Mail className="size-3" />
                    )}
                    إرسال الطلب
                  </Button>
                </div>
                {emailError && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <XCircle className="size-3" />
                    {emailError}
                  </p>
                )}
                {emailSuccess && (
                  <p className="text-[11px] text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="size-3" />
                    تم إرسال طلب تغيير البريد الإلكتروني — بانتظار مراجعة المسؤول
                  </p>
                )}
              </div>
            )}
          </div>

          <SettingsRow>
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Phone className="size-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground truncate">
                  {userProfile?.phone || 'لم يتم الإضافة'}
                </p>
                <p className="text-[11px] text-muted-foreground">رقم الهاتف</p>
              </div>
            </div>
          </SettingsRow>
        </div>
        </SettingsSection>

        {/* Authentication Method */}
        <SettingsSection
          className="h-full"
          title="طريقة تسجيل الدخول"
          description="حسابك يستخدم روابط الدخول السريع ( الرابط السحري ) عبر البريد الإلكتروني"
        >
        <SettingsRow>
          <div className="flex items-center gap-3 mt-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Link2 className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-foreground">الدخول السريع ( الرابط السحري )</p>
              <p className="text-[11px] text-muted-foreground">
                يتم إرسال رابط دخول آمن لبريدك الإلكتروني في كل مرة تسجل فيها الدخول
              </p>
            </div>
          </div>
          <Badge variant="default" className="text-[10px]">
            مفعّل
          </Badge>
        </SettingsRow>
        </SettingsSection>
      </div>

      {/* Row 2: 2FA + Connected Accounts */}
      <div className={cn('grid gap-5', collapsed ? 'lg:grid-cols-2' : 'grid-cols-1')}>
        {/* 2FA */}
        <SettingsSection
          className="h-full"
          title="المصادقة الثنائية"
          description="أضف طبقة أمان إضافية لحسابك"
        >
        <div className="space-y-4">
          <SettingsRow>
            <div className="flex items-center gap-3 mt-4">
              <div
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-xl',
                  twoFactorEnabled ? 'bg-emerald-500/10' : 'bg-muted/50'
                )}
              >
                <Shield
                  className={cn(
                    'size-4',
                    twoFactorEnabled
                      ? 'text-emerald-500'
                      : 'text-muted-foreground'
                  )}
                />
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground">
                  المصادقة الثنائية (2FA)
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {twoFactorEnabled
                    ? 'مفعّلة - حسابك محمي'
                    : 'غير مفعّلة - يُنصح بتفعيلها'}
                </p>
              </div>
            </div>
            <Button
              variant={twoFactorEnabled ? 'destructive' : 'default'}
              size="sm"
              className="text-xs"
              onClick={() => handle2FAToggle(!twoFactorEnabled)}
              disabled={is2FALoading}
            >
              {is2FALoading && <Loader2 className="size-3 animate-spin ml-1.5" />}
              {twoFactorEnabled ? 'تعطيل' : 'تفعيل'}
            </Button>
          </SettingsRow>

          {/* 2FA Setup/Disable Form */}
          {show2FASetup && (
            <div className="rounded-xl bg-background/50 p-4 space-y-4 border border-border/30">
              {qrCode && (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-[12px] text-muted-foreground text-center">
                    امسح رمز QR بتطبيق المصادقة (مثل Google Authenticator)
                  </p>
                  <img src={qrCode} alt="2FA QR Code" className="size-40 rounded-lg" />
                  {twoFactorSecret && (
                    <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5">
                      <code className="text-xs font-mono" dir="ltr">{twoFactorSecret}</code>
                      <button
                        onClick={() => navigator.clipboard.writeText(twoFactorSecret)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!qrCode && twoFactorEnabled && (
                <p className="text-[12px] text-muted-foreground text-center">
                  أدخل رمز التحقق من تطبيق المصادقة لتعطيل المصادقة الثنائية
                </p>
              )}

              <div className="flex gap-2 max-w-xs mx-auto">
                <Input
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="أدخل رمز التحقق"
                  className="text-center"
                  maxLength={6}
                  dir="ltr"
                />
                <Button
                  size="sm"
                  onClick={handleVerify2FA}
                  disabled={is2FALoading || !verificationCode}
                >
                  {is2FALoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    'تحقق'
                  )}
                </Button>
              </div>

              {twoFAError && (
                <p className="text-[11px] text-destructive text-center flex items-center justify-center gap-1">
                  <XCircle className="size-3" />
                  {twoFAError}
                </p>
              )}

              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setShow2FASetup(false);
                    setVerificationCode('');
                    setTwoFAError(null);
                  }}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          )}
        </div>
        </SettingsSection>

        {/* Connected Accounts */}
        <SettingsSection
          className="h-full"
          title="الحسابات المرتبطة"
          description="حسابات تسجيل الدخول المرتبطة بحسابك"
        >
        <div className="space-y-3">
          {/* Google */}
          <SettingsRow>
            <div className="flex items-center gap-3 mt-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background/80 border border-border/30">
                <img src="/icons/google.svg" alt="Google" className="size-5" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground">Google</p>
                <p className="text-[11px] text-muted-foreground">
                  {profileData?.user?.googleId ? 'مرتبط بحسابك' : 'غير مرتبط'}
                </p>
              </div>
            </div>
            {profileData?.user?.googleId ? (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <CheckCircle2 className="size-3" />
                مرتبط
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => {
                  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
                  window.location.href = `${apiBase}/auth/google`;
                }}
              >
                <ExternalLink className="size-3" />
                ربط
              </Button>
            )}
          </SettingsRow>

          {/* LinkedIn */}
          <SettingsRow>
            <div className="flex items-center gap-3 mt-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background/80 border border-border/30">
                <img src="/icons/linkedin.svg" alt="LinkedIn" className="size-5" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground">LinkedIn</p>
                <p className="text-[11px] text-muted-foreground">
                  {profileData?.user?.linkedinId ? 'مرتبط بحسابك' : 'غير مرتبط'}
                </p>
              </div>
            </div>
            {profileData?.user?.linkedinId ? (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <CheckCircle2 className="size-3" />
                مرتبط
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => {
                  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
                  window.location.href = `${apiBase}/auth/linkedin`;
                }}
              >
                <ExternalLink className="size-3" />
                ربط
              </Button>
            )}
          </SettingsRow>
        </div>
        </SettingsSection>
      </div>

      {/* Active Sessions */}
      <SettingsSection
        title="الجلسات النشطة"
        description="الأجهزة المتصلة حالياً بحسابك"
      >
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <p className="text-[12px] text-muted-foreground text-center py-4">
              لا توجد جلسات نشطة
            </p>
          ) : (
            sessions.slice(0, 3).map((session) => {
              const DeviceIcon = getDeviceIcon(session);
              const deviceLabel = [session.browser, session.os]
                .filter(Boolean)
                .join(' على ') || session.deviceName || 'جهاز غير معروف';

              return (
                <SettingsRow key={session.id}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-xl',
                        session.isCurrent ? 'bg-primary/10' : 'bg-muted/50'
                      )}
                    >
                      <DeviceIcon
                        className={cn(
                          'size-4',
                          session.isCurrent
                            ? 'text-primary'
                            : 'text-muted-foreground'
                        )}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium text-foreground truncate">
                          {deviceLabel}
                        </p>
                        {session.isCurrent && (
                          <Badge variant="default" className="text-[9px] h-4">
                            هذا الجهاز
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {session.location || 'موقع غير معروف'} · {formatLastActivity(session.lastActivity)}
                      </p>
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-destructive hover:text-destructive"
                      onClick={() => handleDeleteSession(session.id)}
                      disabled={deletingSessionId === session.id}
                    >
                      {deletingSessionId === session.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <>
                          <LogOut className="size-3.5 ml-1" />
                          إنهاء
                        </>
                      )}
                    </Button>
                  )}
                </SettingsRow>
              );
            })
          )}

          {sessions.filter((s) => !s.isCurrent).length > 0 && (
            <div className="flex justify-end pt-2">
              <Button
                variant="destructive"
                size="sm"
                className="text-xs gap-1.5"
                onClick={handleDeleteAllOther}
                disabled={isDeletingAll}
              >
                {isDeletingAll ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <LogOut className="size-3.5" />
                )}
                {isDeletingAll ? 'جاري الإنهاء...' : 'إنهاء جميع الجلسات الأخرى'}
              </Button>
            </div>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}
