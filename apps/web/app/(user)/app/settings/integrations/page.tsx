'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  GitMerge,
  Unlink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  CalendarDays,
  CalendarCheck,
  Video,
  Users,
  ArrowLeftRight,
  HardDrive,
  ImageIcon,
  FileText,
  Trash2,
  BarChart3,
  Crown,
  Link2,
  TrendingUp,
  Eye,
  ShoppingCart,
  MousePointerClick,
} from 'lucide-react';
import { usePhonePreview } from '@/components/(app)/shared/phone-preview-context';
import { useAuth } from '@/providers';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { ToggleSwitch } from '@/components/(app)/settings';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getGoogleCalendarStatus,
  getGoogleCalendarAuthUrl,
  exchangeGoogleCalendarCode,
  unlinkGoogleCalendar,
} from '@/actions/google-calendar';
import { getStorageUsage, type StorageUsage } from '@/actions/storage';
import {
  getAnalyticsSettings,
  updateAnalyticsSettings,
  disconnectAnalytics,
  type AnalyticsSettings,
} from '@/actions/google-analytics';

// ─── Constants ───────────────────────────────────────────────

const CAL_FEATURES = [
  { icon: CalendarDays, label: 'مزامنة الأحداث', desc: 'أحداثك تُضاف تلقائياً لتقويم Google' },
  { icon: Video, label: 'Google Meet', desc: 'إنشاء روابط اجتماع تلقائياً' },
  { icon: Users, label: 'إدارة الحضور', desc: 'إرسال دعوات وتتبع الاستجابات' },
  { icon: ArrowLeftRight, label: 'تحديث ثنائي', desc: 'أي تعديل هنا ينعكس على التقويم' },
];

const SCOPES = ['إنشاء الأحداث', 'تحديث الأحداث', 'حذف الأحداث', 'روابط Google Meet', 'إدارة الحضور'];

const COMING_SOON = [
  { icon: '/icons/telegram.svg', label: 'تيليجرام', desc: 'إشعارات فورية وأوامر سريعة عبر بوت تيليجرام' },
  { icon: '/icons/whatsapp.svg', label: 'واتساب بزنس', desc: 'إرسال تأكيد الطلبات وتحديثات التوصيل للعملاء' },
];

const CATEGORY_LABELS: Record<string, { label: string; icon: typeof ImageIcon }> = {
  AVATAR: { label: 'الصور الشخصية', icon: ImageIcon },
  COVER: { label: 'صور الغلاف', icon: ImageIcon },
  PRODUCT_IMAGE: { label: 'صور المنتجات', icon: ImageIcon },
  EVENT_COVER: { label: 'صور الأحداث', icon: CalendarDays },
  EVENT_GALLERY: { label: 'معرض الأحداث', icon: ImageIcon },
  FORM_COVER: { label: 'أغلفة النماذج', icon: FileText },
  FORM_BANNER: { label: 'بنرات النماذج', icon: FileText },
  FORM_SUBMISSION: { label: 'مرفقات النماذج', icon: FileText },
  BANNER: { label: 'البنرات', icon: ImageIcon },
};

// ─── Helpers ─────────────────────────────────────────────────

function formatSyncTime(dateStr?: string) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  if (diffMin < 1) return 'الآن';
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  if (diffHr < 24) return `منذ ${diffHr} ساعة`;
  return date.toLocaleDateString('ar-IQ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

// ─── Storage Usage Dialog ────────────────────────────────────

function StorageDialog({
  open,
  onOpenChange,
  usage,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  usage: StorageUsage | null;
  loading: boolean;
}) {
  const categories = usage?.categoryBreakdown
    ? Object.entries(usage.categoryBreakdown)
        .filter(([, size]) => size > 0)
        .sort(([, a], [, b]) => b - a)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: '#313851' }}>
            <HardDrive className="size-4" style={{ color: '#9787F3' }} />
            تفاصيل التخزين
          </DialogTitle>
        </DialogHeader>

        {loading || !usage ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin" style={{ color: '#9787F3' }} />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Main usage bar */}
            <div className="space-y-2.5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[22px] font-bold" style={{ color: '#313851' }}>
                    {formatBytes(usage.used)}
                  </p>
                  <p className="text-[11px]" style={{ color: '#C2CBD3' }}>
                    من أصل {formatBytes(usage.limit)}
                  </p>
                </div>
                <p className="text-[13px] font-semibold" style={{ color: usage.percentage > 85 ? '#ef4444' : '#9787F3' }}>
                  {usage.percentage}%
                </p>
              </div>
              <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: '#C2CBD3' + '30' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(usage.percentage, 100)}%`,
                    backgroundColor: usage.percentage > 85 ? '#ef4444' : '#9787F3',
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px]" style={{ color: '#C2CBD3' }}>
                <span>{usage.files} ملف</span>
                <span>متاح: {formatBytes(usage.available)}</span>
              </div>
            </div>

            {/* Category breakdown */}
            {categories.length > 0 && (
              <div className="space-y-2">
                <p className="text-[12px] font-medium" style={{ color: '#313851' }}>توزيع التخزين</p>
                <div className="space-y-1.5">
                  {categories.map(([cat, size]) => {
                    const meta = CATEGORY_LABELS[cat] || { label: cat, icon: FileText };
                    const Icon = meta.icon;
                    const pct = usage.limit > 0 ? Math.round((size / usage.limit) * 100) : 0;
                    return (
                      <div key={cat} className="flex items-center gap-2.5">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: '#9787F3' + '14' }}>
                          <Icon className="size-3.5" style={{ color: '#9787F3' }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] font-medium" style={{ color: '#313851' }}>{meta.label}</span>
                            <span className="text-[10px]" style={{ color: '#C2CBD3' }}>{formatBytes(size)}</span>
                          </div>
                          <div className="h-1 w-full rounded-full overflow-hidden" style={{ backgroundColor: '#C2CBD3' + '20' }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: '#9787F3' + '80' }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Trash */}
            {usage.trashUsed > 0 && (
              <div className="flex items-center gap-2.5 rounded-2xl p-3" style={{ backgroundColor: '#C2CBD3' + '15' }}>
                <Trash2 className="size-4 shrink-0" style={{ color: '#C2CBD3' }} />
                <div>
                  <p className="text-[11px] font-medium" style={{ color: '#313851' }}>سلة المحذوفات</p>
                  <p className="text-[10px]" style={{ color: '#C2CBD3' }}>{formatBytes(usage.trashUsed)} — تُحذف نهائياً بعد 30 يوم</p>
                </div>
              </div>
            )}

            {/* Upgrade hint */}
            <div className="flex items-center gap-2.5 rounded-2xl border p-3" style={{ borderColor: '#9787F3' + '30' }}>
              <Crown className="size-4 shrink-0" style={{ color: '#9787F3' }} />
              <div className="flex-1">
                <p className="text-[11px] font-medium" style={{ color: '#313851' }}>تحتاج مساحة أكبر؟</p>
                <p className="text-[10px]" style={{ color: '#C2CBD3' }}>ترقية إلى باقة مدفوعة للحصول على مساحة إضافية — قريباً</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ────────────────────────────────────────────────────

export default function IntegrationsSettingsPage() {
  const { collapsed } = usePhonePreview();
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Google Calendar state
  const [isLoading, setIsLoading] = useState(true);
  const [isLinked, setIsLinked] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const exchangeAttempted = useRef(false);

  // S3 Storage state
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [storageLoading, setStorageLoading] = useState(true);
  const [storageDialogOpen, setStorageDialogOpen] = useState(false);

  // Google Analytics state
  const [gaSettings, setGaSettings] = useState<AnalyticsSettings | null>(null);
  const [gaLoading, setGaLoading] = useState(true);
  const [gaDialogOpen, setGaDialogOpen] = useState(false);
  const [gaMeasurementId, setGaMeasurementId] = useState('');
  const [gaSaving, setGaSaving] = useState(false);
  const [gaDisconnecting, setGaDisconnecting] = useState(false);

  // Load all statuses
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setStorageLoading(true);
      setGaLoading(true);
      const [calRes, storRes, gaRes] = await Promise.all([
        getGoogleCalendarStatus(),
        getStorageUsage(),
        getAnalyticsSettings(),
      ]);
      if (calRes.data) {
        setIsLinked(calRes.data.linked);
        if (calRes.data.linked) setLastSync(new Date().toISOString());
      }
      if (storRes.data) setStorageUsage(storRes.data);
      if (gaRes.data) {
        setGaSettings(gaRes.data);
        if (gaRes.data.googleAnalyticsId) setGaMeasurementId(gaRes.data.googleAnalyticsId);
      }
      setGaLoading(false);
      setStorageLoading(false);
      setIsLoading(false);
    })();
  }, []);

  // OAuth callback
  useEffect(() => {
    const code = searchParams.get('google_code');
    const err = searchParams.get('google_error');
    if (err) { toast.error('فشل في ربط تقويم Google: ' + err); router.replace('/app/settings/integrations'); return; }
    if (code && !exchangeAttempted.current) {
      exchangeAttempted.current = true;
      (async () => {
        setIsConnecting(true);
        const { error } = await exchangeGoogleCalendarCode(code);
        setIsConnecting(false);
        if (error) { toast.error(error); } else { setIsLinked(true); setLastSync(new Date().toISOString()); toast.success('تم ربط تقويم Google بنجاح!'); }
        router.replace('/app/settings/integrations');
      })();
    }
  }, [searchParams, router, toast]);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    const { data: authUrl, error } = await getGoogleCalendarAuthUrl('/app/settings/integrations');
    setIsConnecting(false);
    if (error || !authUrl) { toast.error(error || 'فشل في بدء عملية الربط'); return; }
    window.location.href = authUrl;
  }, [toast]);

  const handleUnlink = useCallback(async () => {
    setIsUnlinking(true);
    const { error } = await unlinkGoogleCalendar();
    setIsUnlinking(false);
    if (error) { toast.error(error); return; }
    setIsLinked(false); setLastSync(null); setAutoSync(true); setCalendarDialogOpen(false);
    toast.success('تم إلغاء ربط تقويم Google');
  }, [toast]);

  const handleOpenStorageDialog = useCallback(async () => {
    setStorageDialogOpen(true);
    if (!storageUsage) {
      setStorageLoading(true);
      const { data } = await getStorageUsage();
      if (data) setStorageUsage(data);
      setStorageLoading(false);
    }
  }, [storageUsage]);

  const handleConnectGA = useCallback(async () => {
    const trimmed = gaMeasurementId.trim();
    if (!trimmed || !/^G-[A-Z0-9]+$/.test(trimmed)) {
      toast.error('معرّف القياس غير صالح — يجب أن يبدأ بـ G-');
      return;
    }
    setGaSaving(true);
    const { data, error } = await updateAnalyticsSettings(trimmed);
    setGaSaving(false);
    if (error) { toast.error(error); return; }
    if (data) { setGaSettings(data); setGaMeasurementId(data.googleAnalyticsId); }
    setGaDialogOpen(false);
    toast.success('تم ربط Google Analytics بنجاح!');
  }, [gaMeasurementId, toast]);

  const handleDisconnectGA = useCallback(async () => {
    setGaDisconnecting(true);
    const { data, error } = await disconnectAnalytics();
    setGaDisconnecting(false);
    if (error) { toast.error(error); return; }
    if (data) setGaSettings(data);
    setGaMeasurementId('');
    setGaDialogOpen(false);
    toast.success('تم إلغاء ربط Google Analytics');
  }, [toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-5 animate-spin" style={{ color: '#9787F3' }} />
      </div>
    );
  }

  const storagePct = storageUsage?.percentage ?? 0;

  return (
    <div className="space-y-6">
      {/* Storage Dialog */}
      <StorageDialog
        open={storageDialogOpen}
        onOpenChange={setStorageDialogOpen}
        usage={storageUsage}
        loading={storageLoading}
      />

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mt-4">
        <div className="flex size-10 items-center justify-center rounded-2xl" style={{ backgroundColor: '#9787F3' }}>
          <GitMerge className="size-[18px] text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold" style={{ color: '#313851' }}>التكاملات</h1>
          <p className="text-[13px]" style={{ color: '#C2CBD3' }}>ربط ركني مع خدمات خارجية لمزامنة الأحداث والمواعيد</p>
        </div>
      </div>

      {/* ── Active Integrations Grid ───────────────────────── */}
      <div className={cn('grid gap-4', collapsed ? 'lg:grid-cols-2 grid-cols-1' : 'grid-cols-1')}>

      {/* ── S3 Cloud Storage ────────────────────────────────── */}
      <div className="overflow-hidden rounded-[2rem] border" style={{ borderColor: '#9787F3' }}>
        {/* Header */}
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="relative shrink-0 mt-0.5">
              <div className="flex size-11 sm:size-13 items-center justify-center rounded-2xl border" style={{ borderColor: '#C2CBD3' }}>
                <Image src="/icons/aws-s3.svg" alt="Cloud Storage" width={24} height={24} />
              </div>
              <div className="absolute -bottom-1 -left-1 flex size-[16px] sm:size-[18px] items-center justify-center rounded-full ring-2 ring-white" style={{ backgroundColor: '#9787F3' }}>
                <CheckCircle2 className="size-2 sm:size-2.5 text-white" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-[14px] sm:text-[15px] font-semibold leading-tight" style={{ color: '#313851' }}>التخزين السحابي</h3>
                <span className="inline-flex items-center gap-1 rounded-full px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-medium text-white shrink-0" style={{ backgroundColor: '#9787F3' }}>
                  <span className="size-1.5 rounded-full bg-white/60 animate-pulse" />
                  مفعّل
                </span>
              </div>
              <p className="text-[11px] sm:text-[12px] line-clamp-2" style={{ color: '#C2CBD3' }}>
                تخزين سحابي آمن — 5GB مجاناً شهرياً
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenStorageDialog}
            className="flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: '#9787F3' }}
          >
            <BarChart3 className="size-3" />
            تفاصيل الاستخدام
          </button>
        </div>

        {/* Usage bar */}
        <div className="border-t px-5 sm:px-6 py-4" style={{ borderColor: '#C2CBD3' + '40' }}>
          {storageLoading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="size-4 animate-spin" style={{ color: '#C2CBD3' }} />
            </div>
          ) : storageUsage ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium" style={{ color: '#313851' }}>
                  {formatBytes(storageUsage.used)} / {formatBytes(storageUsage.limit)}
                </span>
                <span className="text-[11px] font-medium" style={{ color: storagePct > 85 ? '#ef4444' : '#9787F3' }}>
                  {storagePct}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: '#C2CBD3' + '30' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(storagePct, 100)}%`, backgroundColor: storagePct > 85 ? '#ef4444' : '#9787F3' }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: '#C2CBD3' }}>{storageUsage.files} ملف مرفوع</span>
                <span className="text-[10px]" style={{ color: '#C2CBD3' }}>متاح: {formatBytes(storageUsage.available)}</span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-center py-1" style={{ color: '#C2CBD3' }}>لا يمكن تحميل البيانات</p>
          )}
        </div>

        {/* Feature tags */}
        <div className="flex items-center gap-1.5 flex-wrap border-t px-5 sm:px-6 py-3.5" style={{ borderColor: '#C2CBD3' + '40' }}>
          {[
            { icon: ImageIcon, label: 'صور المنتجات' },
            { icon: HardDrive, label: 'ملفات آمنة' },
            { icon: CalendarDays, label: 'صور الأحداث' },
          ].map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium"
              style={{ backgroundColor: '#9787F3' + '12', color: '#9787F3' }}
            >
              <Icon className="size-3" />
              {label}
            </span>
          ))}
        </div>

        {/* Upgrade hint */}
        {storagePct > 70 && (
          <div className="flex items-center gap-2.5 border-t px-5 sm:px-6 py-3.5" style={{ borderColor: '#C2CBD3' + '40' }}>
            <Crown className="size-3.5 shrink-0" style={{ color: '#9787F3' }} />
            <p className="text-[11px]" style={{ color: '#C2CBD3' }}>
              {storagePct > 85
                ? 'المساحة على وشك الامتلاء — ترقية الباقة قريباً'
                : 'تجاوزت 70% — يمكنك شراء وحدات إضافية أو الاشتراك بالباقات قريباً'
              }
            </p>
          </div>
        )}
      </div>

      {/* ── Google Calendar ─────────────────────────────────── */}
      <div className="overflow-hidden rounded-[2rem] border" style={{ borderColor: isLinked ? '#9787F3' : '#C2CBD3' }}>
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="relative shrink-0 mt-0.5">
              <div className="flex size-11 sm:size-13 items-center justify-center rounded-2xl border" style={{ borderColor: '#C2CBD3' }}>
                <Image src="/icons/google-calendar.svg" alt="Google Calendar" width={24} height={24} />
              </div>
              {isLinked && (
                <div className="absolute -bottom-1 -left-1 flex size-[16px] sm:size-[18px] items-center justify-center rounded-full ring-2 ring-white" style={{ backgroundColor: '#9787F3' }}>
                  <CheckCircle2 className="size-2 sm:size-2.5 text-white" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-[14px] sm:text-[15px] font-semibold leading-tight" style={{ color: '#313851' }}>تقويم Google</h3>
                {isLinked && (
                  <span className="inline-flex items-center gap-1 rounded-full px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-medium text-white shrink-0" style={{ backgroundColor: '#9787F3' }}>
                    <span className="size-1.5 rounded-full bg-white/60 animate-pulse" />
                    مرتبط
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-[12px] line-clamp-2" style={{ color: '#C2CBD3' }}>
                {isLinked ? 'مرتبطة ويتم مزامنتها تلقائياً' : 'مزامنة الأحداث تلقائياً مع تقويم Google'}
              </p>
              {isLinked && lastSync && (
                <p className="flex items-center gap-1 text-[10px] sm:text-[11px] mt-1" style={{ color: '#C2CBD3' }}>
                  <Clock className="size-3" />
                  آخر مزامنة: {formatSyncTime(lastSync)}
                </p>
              )}
            </div>
          </div>
          {isLinked ? (
            <button
              onClick={handleUnlink}
              disabled={isUnlinking}
              className="flex w-full items-center justify-center gap-1.5 rounded-full border px-4 py-2.5 text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-50"
              style={{ borderColor: '#C2CBD3', color: '#313851' }}
            >
              {isUnlinking ? <Loader2 className="size-3 animate-spin" /> : <Unlink className="size-3" />}
              إلغاء الربط
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#9787F3' }}
            >
              {isConnecting ? <Loader2 className="size-3 animate-spin" /> : <GitMerge className="size-3" />}
              ربط التقويم
            </button>
          )}
        </div>

        {/* Connected extras */}
        {isLinked && (
          <>
            <div className="border-t px-5 sm:px-6 py-3.5" style={{ borderColor: '#C2CBD3' + '40' }}>
              <div className="flex items-center gap-1.5 flex-wrap">
                {CAL_FEATURES.map(({ label, icon: Icon }) => (
                  <span key={label} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium" style={{ backgroundColor: '#9787F3' + '12', color: '#9787F3' }}>
                    <Icon className="size-3" />
                    {label}
                  </span>
                ))}
              </div>

            </div>

            <button
              type="button"
              onClick={() => setCalendarDialogOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 border-t py-2.5 text-[11px] font-medium transition-colors hover:opacity-80"
              style={{ borderColor: '#C2CBD3' + '40', color: '#C2CBD3' }}
            >
              عرض التفاصيل
            </button>

            <Dialog open={calendarDialogOpen} onOpenChange={setCalendarDialogOpen}>
              <DialogContent className="max-w-[95vw] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2" style={{ color: '#313851' }}>
                    <Image src="/icons/google-calendar.svg" alt="Google Calendar" width={18} height={18} />
                    تفاصيل تقويم Google
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Account */}
                  <div className="space-y-1.5">
                    <p className="text-[12px] font-medium" style={{ color: '#313851' }}>الحساب المرتبط</p>
                    <div className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5" style={{ borderColor: '#C2CBD3' + '50' }}>
                      <Image src="/icons/google.svg" alt="Google" width={16} height={16} />
                      <span className="text-[12px]" style={{ color: '#313851' }} dir="ltr">{user?.email || '—'}</span>
                    </div>
                  </div>

                  {/* Auto-sync */}
                  <div className="flex items-center justify-between rounded-2xl border px-3.5 py-3" style={{ borderColor: '#C2CBD3' + '40' }}>
                    <span className="text-[12px] font-medium" style={{ color: '#313851' }}>مزامنة تلقائية</span>
                    <ToggleSwitch checked={autoSync} onChange={() => { setAutoSync(!autoSync); toast.success(!autoSync ? 'تم تفعيل المزامنة التلقائية' : 'تم تعطيل المزامنة التلقائية'); }} />
                  </div>

                  {/* Features */}
                  <div className="space-y-1.5">
                    <p className="text-[12px] font-medium" style={{ color: '#313851' }}>المميزات</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {CAL_FEATURES.map(({ icon: Icon, label, desc }) => (
                        <div key={label} className="flex items-start gap-2 rounded-xl p-2.5" style={{ backgroundColor: '#9787F3' + '08' }}>
                          <Icon className="size-3.5 shrink-0 mt-0.5" style={{ color: '#9787F3' }} />
                          <div>
                            <p className="text-[11px] font-medium" style={{ color: '#313851' }}>{label}</p>
                            <p className="text-[10px]" style={{ color: '#C2CBD3' }}>{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Note */}
                  <div className="flex gap-2.5 rounded-2xl p-3" style={{ backgroundColor: '#C2CBD3' + '18' }}>
                    <AlertCircle className="size-4 shrink-0 mt-0.5" style={{ color: '#C2CBD3' }} />
                    <p className="text-[11px] leading-relaxed" style={{ color: '#313851' }}>
                      يتم مزامنة الأحداث مباشرةً عند إنشائها أو تعديلها. إلغاء الربط لن يحذف الأحداث الموجودة في تقويم Google.
                    </p>
                  </div>

                  {/* Unlink button */}
                  <button
                    onClick={() => { handleUnlink(); setCalendarDialogOpen(false); }}
                    disabled={isUnlinking}
                    className="flex w-full items-center justify-center gap-1.5 rounded-full border py-2.5 text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-50"
                    style={{ borderColor: '#C2CBD3', color: '#313851' }}
                  >
                    {isUnlinking ? <Loader2 className="size-3 animate-spin" /> : <Unlink className="size-3" />}
                    إلغاء ربط التقويم
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}

        {/* Not connected features */}
        {!isLinked && (
          <div className="border-t px-4 sm:px-5 py-4" style={{ borderColor: '#C2CBD3' + '40' }}>
            <div className={cn('grid gap-3', collapsed ? 'sm:grid-cols-2' : 'grid-cols-1')}>
              {CAL_FEATURES.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3 rounded-2xl border p-3.5" style={{ borderColor: '#C2CBD3' + '40' }}>
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#9787F3' + '14' }}>
                    <Icon className="size-4" style={{ color: '#9787F3' }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium" style={{ color: '#313851' }}>{label}</p>
                    <p className="text-[11px]" style={{ color: '#C2CBD3' }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Google Analytics ────────────────────────────────── */}
      <div className="overflow-hidden rounded-[2rem] border" style={{ borderColor: gaSettings?.isConnected ? '#9787F3' : '#C2CBD3' }}>
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="relative shrink-0 mt-0.5">
              <div className="flex size-11 sm:size-13 items-center justify-center rounded-2xl border" style={{ borderColor: '#C2CBD3' }}>
                <Image src="/icons/google-analytics.svg" alt="Google Analytics" width={24} height={24} />
              </div>
              {gaSettings?.isConnected && (
                <div className="absolute -bottom-1 -left-1 flex size-[16px] sm:size-[18px] items-center justify-center rounded-full ring-2 ring-white" style={{ backgroundColor: '#9787F3' }}>
                  <CheckCircle2 className="size-2 sm:size-2.5 text-white" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-[14px] sm:text-[15px] font-semibold leading-tight" style={{ color: '#313851' }}>Google Analytics</h3>
                {gaSettings?.isConnected && (
                  <span className="inline-flex items-center gap-1 rounded-full px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-medium text-white shrink-0" style={{ backgroundColor: '#9787F3' }}>
                    <span className="size-1.5 rounded-full bg-white/60 animate-pulse" />
                    مرتبط
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-[12px] line-clamp-2" style={{ color: '#C2CBD3' }}>
                {gaSettings?.isConnected
                  ? `تتبع الزيارات — ${gaSettings.googleAnalyticsId}`
                  : 'تتبع زيارات المتجر وسلوك العملاء عبر GA4'
                }
              </p>
            </div>
          </div>

          {gaLoading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="size-4 animate-spin" style={{ color: '#C2CBD3' }} />
            </div>
          ) : gaSettings?.isConnected ? (
            <div className="flex gap-2">
              <button
                onClick={() => setGaDialogOpen(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-medium text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: '#9787F3' }}
              >
                <BarChart3 className="size-3" />
                التفاصيل
              </button>
              <button
                onClick={handleDisconnectGA}
                disabled={gaDisconnecting}
                className="flex items-center justify-center gap-1.5 rounded-full border px-4 py-2.5 text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-50"
                style={{ borderColor: '#C2CBD3', color: '#313851' }}
              >
                {gaDisconnecting ? <Loader2 className="size-3 animate-spin" /> : <Unlink className="size-3" />}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setGaDialogOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-medium text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: '#9787F3' }}
            >
              <Link2 className="size-3" />
              ربط Analytics
            </button>
          )}
        </div>

        {/* Connected: tracked events summary */}
        {gaSettings?.isConnected && (
          <div className="flex items-center gap-1.5 flex-wrap border-t px-5 sm:px-6 py-3.5" style={{ borderColor: '#C2CBD3' + '40' }}>
            {[
              { icon: Eye, label: 'مشاهدات الصفحات' },
              { icon: ShoppingCart, label: 'التجارة الإلكترونية' },
              { icon: MousePointerClick, label: 'أحداث مخصصة' },
            ].map(({ label, icon: Icon }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium"
                style={{ backgroundColor: '#9787F3' + '12', color: '#9787F3' }}
              >
                <Icon className="size-3" />
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Not connected: features preview */}
        {!gaSettings?.isConnected && !gaLoading && (
          <div className="border-t px-5 sm:px-6 py-4" style={{ borderColor: '#C2CBD3' + '40' }}>
            <div className="space-y-2">
              {[
                { icon: Eye, label: 'تتبع مشاهدات الصفحات', desc: 'معرفة أكثر الصفحات زيارة في متجرك' },
                { icon: ShoppingCart, label: 'تتبع التجارة الإلكترونية', desc: 'تتبع المبيعات والمنتجات وسلة المشتريات' },
                { icon: TrendingUp, label: 'تحليلات الأداء', desc: 'بيانات حية عن سلوك الزوار والتحويلات' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-2.5 rounded-xl p-2.5" style={{ backgroundColor: '#9787F3' + '08' }}>
                  <Icon className="size-3.5 shrink-0 mt-0.5" style={{ color: '#9787F3' }} />
                  <div>
                    <p className="text-[11px] font-medium" style={{ color: '#313851' }}>{label}</p>
                    <p className="text-[10px]" style={{ color: '#C2CBD3' }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Google Analytics Dialog */}
      <Dialog open={gaDialogOpen} onOpenChange={setGaDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: '#313851' }}>
              <Image src="/icons/google-analytics.svg" alt="Google Analytics" width={18} height={18} />
              {gaSettings?.isConnected ? 'تفاصيل Google Analytics' : 'ربط Google Analytics'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Measurement ID input */}
            <div className="space-y-1.5">
              <p className="text-[12px] font-medium" style={{ color: '#313851' }}>معرّف القياس (Measurement ID)</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={gaMeasurementId}
                  onChange={(e) => setGaMeasurementId(e.target.value.toUpperCase())}
                  placeholder="G-XXXXXXXXXX"
                  dir="ltr"
                  disabled={gaSettings?.isConnected}
                  className="flex-1 rounded-xl border px-3 py-2.5 text-[12px] outline-none transition-colors focus:ring-2 disabled:opacity-60"
                  style={{
                    borderColor: '#C2CBD3' + '50',
                    color: '#313851',
                    // @ts-expect-error -- CSS custom focus ring
                    '--tw-ring-color': '#9787F3' + '40',
                  }}
                />
              </div>
              <p className="text-[10px]" style={{ color: '#C2CBD3' }}>
                تجده في Google Analytics → الإدارة → مصادر البيانات → تفاصيل البث
              </p>
            </div>

            {gaSettings?.isConnected ? (
              <>
                {/* Tracked events */}
                <div className="space-y-1.5">
                  <p className="text-[12px] font-medium" style={{ color: '#313851' }}>الأحداث المتتبعة</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { icon: Eye, label: 'مشاهدات الصفحات', desc: 'تتبع تلقائي لكل صفحة' },
                      { icon: ShoppingCart, label: 'التجارة الإلكترونية', desc: 'مبيعات، سلة، شراء' },
                      { icon: MousePointerClick, label: 'أحداث مخصصة', desc: 'نماذج، بحث، تسجيل' },
                      { icon: TrendingUp, label: 'التحويلات', desc: 'تتبع أهداف الأعمال' },
                    ].map(({ icon: Icon, label, desc }) => (
                      <div key={label} className="flex items-start gap-2 rounded-xl p-2.5" style={{ backgroundColor: '#9787F3' + '08' }}>
                        <Icon className="size-3.5 shrink-0 mt-0.5" style={{ color: '#9787F3' }} />
                        <div>
                          <p className="text-[11px] font-medium" style={{ color: '#313851' }}>{label}</p>
                          <p className="text-[10px]" style={{ color: '#C2CBD3' }}>{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Note */}
                <div className="flex gap-2.5 rounded-2xl p-3" style={{ backgroundColor: '#C2CBD3' + '18' }}>
                  <AlertCircle className="size-4 shrink-0 mt-0.5" style={{ color: '#C2CBD3' }} />
                  <p className="text-[11px] leading-relaxed" style={{ color: '#313851' }}>
                    البيانات تُرسل مباشرةً إلى حسابك في Google Analytics. يمكنك مراجعة التقارير من لوحة تحكم GA4. إلغاء الربط لن يحذف البيانات المسجلة سابقاً.
                  </p>
                </div>

                {/* Disconnect */}
                <button
                  onClick={handleDisconnectGA}
                  disabled={gaDisconnecting}
                  className="flex w-full items-center justify-center gap-1.5 rounded-full border py-2.5 text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-50"
                  style={{ borderColor: '#C2CBD3', color: '#313851' }}
                >
                  {gaDisconnecting ? <Loader2 className="size-3 animate-spin" /> : <Unlink className="size-3" />}
                  إلغاء ربط Analytics
                </button>
              </>
            ) : (
              <>
                {/* How it works */}
                <div className="space-y-1.5">
                  <p className="text-[12px] font-medium" style={{ color: '#313851' }}>كيف يعمل؟</p>
                  <div className="space-y-2">
                    {[
                      { step: '1', text: 'أنشئ حساب Google Analytics 4 مجاني' },
                      { step: '2', text: 'أنشئ مصدر بيانات (Data Stream) لموقعك' },
                      { step: '3', text: 'انسخ معرّف القياس (G-XXXXXXXXXX) والصقه هنا' },
                    ].map(({ step, text }) => (
                      <div key={step} className="flex items-center gap-2.5">
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: '#9787F3' }}>
                          {step}
                        </div>
                        <p className="text-[11px]" style={{ color: '#313851' }}>{text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Connect button */}
                <button
                  onClick={handleConnectGA}
                  disabled={gaSaving || !gaMeasurementId.trim()}
                  className="flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#9787F3' }}
                >
                  {gaSaving ? <Loader2 className="size-3 animate-spin" /> : <Link2 className="size-3" />}
                  ربط Google Analytics
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      </div>{/* end grid */}

      {/* ── Coming Soon ─────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold" style={{ color: '#313851' }}>تكاملات قادمة</h2>
          <div className="h-px flex-1" style={{ backgroundColor: '#C2CBD3' + '40' }} />
        </div>
        <div className={cn('grid gap-3', collapsed ? 'sm:grid-cols-2' : 'grid-cols-1')}>
          {COMING_SOON.map((item) => (
            <div key={item.label} className="relative flex items-center gap-3.5 rounded-[2rem] border p-4 opacity-60" style={{ borderColor: '#C2CBD3' + '50' }}>
              <span className="absolute top-3 left-3 inline-flex rounded-full px-2 py-0.5 text-[9px] font-medium" style={{ backgroundColor: '#C2CBD3' + '25', color: '#C2CBD3' }}>قريباً</span>
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border" style={{ borderColor: '#C2CBD3' + '40' }}>
                <Image src={item.icon} alt={item.label} width={24} height={24} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium" style={{ color: '#313851' }}>{item.label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: '#C2CBD3' }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
