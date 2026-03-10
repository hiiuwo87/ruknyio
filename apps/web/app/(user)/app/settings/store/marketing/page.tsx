'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Megaphone,
  Target,
  TrendingUp,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  SettingsSection,
  SettingsField,
  SettingsRow,
  ToggleSwitch,
} from '@/components/(app)/settings';
import { useToast } from '@/components/ui/toast';

const campaigns = [
  {
    id: 1,
    name: 'تخفيف الصيف',
    status: 'نشط',
    discount: 25,
    endDate: '2026-09-30',
  },
  {
    id: 2,
    name: 'عرض الجمعة السوداء',
    status: 'قادم',
    discount: 50,
    endDate: '2026-11-15',
  },
];

export default function StoreMarketingPage() {
  const [campaignsList] = useState(campaigns);
  const [saving, setSaving] = useState(false);
  const [discountSettings, setDiscountSettings] = useState({
    enableAutoDiscount: true,
    enableReferral: true,
    referralBonus: 50000,
    minimumOrder: 100000,
  });
  const toast = useToast();

  const handleSaveMarketing = async () => {
    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      toast.success('تم حفظ الإعدادات التسويقية بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">التسويق والعروض</h1>
        <p className="text-muted-foreground mt-1">إدارة حملاتك التسويقية والعروض الخاصة</p>
      </div>

      <SettingsSection title="الحملات النشطة" description="الحملات التسويقية الحالية">
        <div className="space-y-3">
          {campaignsList.map((campaign, idx) => (
            <motion.div
              key={campaign.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="border rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 mt-4">
                  <Megaphone className="size-5 text-primary" />
                  <div>
                    <h3 className="font-medium">{campaign.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      ينتهي: {new Date(campaign.endDate).toLocaleDateString('ar-IQ')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg text-primary">{campaign.discount}%</div>
                  <p className={`text-xs px-2 py-1 rounded-full ${
                    campaign.status === 'نشط'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {campaign.status}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="مميزات التسويق" description="فعّل المميزات التسويقية">
        <div className="space-y-4">
          <SettingsRow>
            <div>
              <p className="text-[13px] font-medium text-foreground">التخفيفات التلقائية</p>
              <p className="text-[11px] text-muted-foreground">تفعيل التخفيفات التلقائية بناءً على الكمية</p>
            </div>
            <ToggleSwitch
              checked={discountSettings.enableAutoDiscount}
              onChange={() =>
                setDiscountSettings(prev => ({
                  ...prev,
                  enableAutoDiscount: !prev.enableAutoDiscount,
                }))
              }
            />
          </SettingsRow>

          <SettingsRow>
            <div>
              <p className="text-[13px] font-medium text-foreground">برنامج الإحالة</p>
              <p className="text-[11px] text-muted-foreground">السماح للعملاء بإحالة أصدقائهم والحصول على مكافآت</p>
            </div>
            <ToggleSwitch
              checked={discountSettings.enableReferral}
              onChange={() =>
                setDiscountSettings(prev => ({
                  ...prev,
                  enableReferral: !prev.enableReferral,
                }))
              }
            />
          </SettingsRow>

          {discountSettings.enableReferral && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
              className="space-y-4 pt-3 border-t"
            >
              <SettingsField label="مكافأة الإحالة (د.ع)">
                <Input
                  type="number"
                  value={discountSettings.referralBonus}
                  onChange={(e) =>
                    setDiscountSettings(prev => ({
                      ...prev,
                      referralBonus: parseInt(e.target.value),
                    }))
                  }
                  placeholder="50000"
                />
              </SettingsField>

              <SettingsField label="الحد الأدنى للطلب (د.ع)">
                <Input
                  type="number"
                  value={discountSettings.minimumOrder}
                  onChange={(e) =>
                    setDiscountSettings(prev => ({
                      ...prev,
                      minimumOrder: parseInt(e.target.value),
                    }))
                  }
                  placeholder="100000"
                />
              </SettingsField>
            </motion.div>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="إحصائيات التسويق" description="مراقبة أداء حملاتك">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: 'إجمالي التخفيفات', value: '2,450,000', icon: TrendingUp },
              { label: 'العملاء المُحالين', value: '120', icon: Target },
              { label: 'معدل التحويل', value: '12.5%', icon: BarChart3 },
            ].map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="border rounded-lg p-3 text-center"
                >
                  <Icon className="size-4 mx-auto text-primary mb-2" />
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="font-bold text-sm mt-1">{stat.value}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </SettingsSection>

      <div className="flex justify-end gap-2">
        <Button variant="outline">إلغاء</Button>
        <Button onClick={handleSaveMarketing} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          حفظ التغييرات
        </Button>
      </div>
    </div>
  );
}
