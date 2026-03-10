'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  MapPin,
  Phone,
  Mail,
  Truck,
  Package,
  CreditCard,
  Save,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  SettingsSection,
  SettingsField,
  SettingsRow,
  ToggleSwitch,
} from '@/components/(app)/settings';
import { BannerSliderSettings } from '@/components/(app)/settings/banner-slider-settings';
import { getMyStore, updateStore, getUserProfile, type StoreData } from '@/actions/settings';
import { useToast } from '@/components/ui/toast';

const paymentMethods = [
  { key: 'cash', label: 'الدفع عند الاستلام', description: 'الدفع نقداً عند التوصيل' },
  { key: 'zainCash', label: 'زين كاش', description: 'الدفع عبر محفظة زين كاش' },
  { key: 'fastPay', label: 'فاست بي', description: 'الدفع عبر فاست بي' },
  { key: 'bankTransfer', label: 'حوالة بنكية', description: 'التحويل المصرفي المباشر' },
];

export default function StoreSettingsPage() {
  const toast = useToast();
  const [store, setStore] = useState<StoreData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [shippingEnabled, setShippingEnabled] = useState(true);
  const [pickupEnabled, setPickupEnabled] = useState(false);
  const [acceptedPayments, setAcceptedPayments] = useState<Record<string, boolean>>({
    cash: true,
    zainCash: false,
    fastPay: false,
    bankTransfer: false,
  });

  const [storeForm, setStoreForm] = useState({
    phone: '',
    email: '',
    address: '',
    city: '',
  });

  // Load store data on mount
  const loadStore = useCallback(async () => {
    setIsLoading(true);
    const [storeResult, userResult] = await Promise.all([
      getMyStore(),
      getUserProfile(),
    ]);

    if (storeResult.data) {
      const s = storeResult.data;
      setStore(s);
      setStoreForm({
        phone: s.contactPhone || '',
        email: s.contactEmail || userResult.data?.email || '',
        address: s.address || '',
        city: s.city || '',
      });
    } else if (userResult.data) {
      // No store yet — pre-fill email from user profile
      setStoreForm((prev) => ({
        ...prev,
        email: userResult.data!.email || '',
      }));
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadStore();
  }, [loadStore]);

  const updateField = (field: string, value: string) => {
    setStoreForm((prev) => ({ ...prev, [field]: value }));
  };

  const togglePayment = (key: string) => {
    setAcceptedPayments((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!store) {
      toast.error('لم يتم العثور على المتجر');
      return;
    }

    setIsSaving(true);
    const { data, error } = await updateStore(store.id, {
      contactEmail: storeForm.email || undefined,
      contactPhone: storeForm.phone || undefined,
      address: storeForm.address || undefined,
      city: storeForm.city || undefined,
    });

    if (error) {
      toast.error(error || 'فشل في حفظ التغييرات');
    } else {
      if (data) setStore(data);
      toast.success('تم حفظ التغييرات بنجاح');
    }

    setIsSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* Banner Slider */}
      <BannerSliderSettings />

      {/* Contact Info */}
      <SettingsSection title="معلومات التواصل" description="بيانات التواصل مع المتجر">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 text-muted-foreground animate-spin" />
          </div>
        ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField label="رقم الهاتف" htmlFor="storePhone">
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="storePhone"
                  value={storeForm.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="07xx xxx xxxx"
                  className="pr-9"
                  dir="ltr"
                />
              </div>
            </SettingsField>

            <SettingsField label="البريد الإلكتروني" htmlFor="storeEmail">
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="storeEmail"
                  type="email"
                  value={storeForm.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="store@example.com"
                  className="pr-9"
                  dir="ltr"
                />
              </div>
            </SettingsField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField label="العنوان" htmlFor="storeAddress">
              <div className="relative">
                <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="storeAddress"
                  value={storeForm.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="العنوان التفصيلي"
                  className="pr-9"
                />
              </div>
            </SettingsField>

            <SettingsField label="المدينة" htmlFor="storeCity">
              <Input
                id="storeCity"
                value={storeForm.city}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder="مثال: بغداد"
              />
            </SettingsField>
          </div>
        </div>
        )}
      </SettingsSection>

      {/* Shipping & Pickup */}
      <SettingsSection title="التوصيل والاستلام" description="تفعيل أو تعطيل خيارات التوصيل والاستلام">
        <div className="space-y-3">
          <SettingsRow>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-xl',
                  shippingEnabled ? 'bg-primary/10' : 'bg-muted/50'
                )}
              >
                <Truck
                  className={cn(
                    'size-4',
                    shippingEnabled ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground">التوصيل</p>
                <p className="text-[11px] text-muted-foreground">
                  تفعيل خدمة التوصيل للطلبات
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={shippingEnabled}
              onChange={setShippingEnabled}
            />
          </SettingsRow>

          <SettingsRow>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-xl',
                  pickupEnabled ? 'bg-primary/10' : 'bg-muted/50'
                )}
              >
                <Package
                  className={cn(
                    'size-4',
                    pickupEnabled ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground">
                  الاستلام من المتجر
                </p>
                <p className="text-[11px] text-muted-foreground">
                  السماح بالاستلام المباشر من المتجر
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={pickupEnabled}
              onChange={setPickupEnabled}
            />
          </SettingsRow>
        </div>
      </SettingsSection>

      {/* Payment Methods */}
      <SettingsSection title="طرق الدفع" description="طرق الدفع المقبولة في متجرك">
        <div className="space-y-3">
          {paymentMethods.map((method) => (
            <SettingsRow key={method.key}>
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-xl',
                    acceptedPayments[method.key] ? 'bg-primary/10' : 'bg-muted/50'
                  )}
                >
                  <CreditCard
                    className={cn(
                      'size-4',
                      acceptedPayments[method.key]
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    )}
                  />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-foreground">
                    {method.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {method.description}
                  </p>
                </div>
              </div>
              <ToggleSwitch
                checked={acceptedPayments[method.key]}
                onChange={() => togglePayment(method.key)}
              />
            </SettingsRow>
          ))}
        </div>
      </SettingsSection>

      {/* Save Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex justify-end"
      >
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          <Save className="size-4" />
          {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </Button>
      </motion.div>
    </div>
  );
}
