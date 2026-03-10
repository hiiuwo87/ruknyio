'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Facebook,
  Instagram,
  MessageSquare,
  Mail,
  CheckCircle2,
  Plug,
  Phone,
  AlertCircle,
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
import { cn } from '@/lib/utils';

const integrations = [
  {
    id: 'facebook',
    name: 'فيسبوك',
    icon: Facebook,
    description: 'ربط صفحة فيسبوك الخاصة بك',
    color: '#1877F2',
  },
  {
    id: 'instagram',
    name: 'إنستغرام',
    icon: Instagram,
    description: 'ربط حساب إنستغرام',
    color: '#E4405F',
  },
  {
    id: 'whatsapp',
    name: 'واتس آب',
    icon: MessageSquare,
    description: 'ربط واتس آب للتواصل المباشر',
    color: '#25D366',
  },
  {
    id: 'email',
    name: 'البريد الإلكتروني',
    icon: Mail,
    description: 'إعدادات البريد الإلكتروني',
    color: '#EA4335',
  },
];

export default function StoreIntegrationsPage() {
  const [enabledIntegrations, setEnabledIntegrations] = useState<string[]>(['facebook', 'whatsapp']);
  const [savingIntegration, setSavingIntegration] = useState<string | null>(null);
  const toast = useToast();

  const toggleIntegration = async (integrationId: string) => {
    setSavingIntegration(integrationId);
    
    try {
      // محاكاة حفظ
      await new Promise(resolve => setTimeout(resolve, 600));
      
      setEnabledIntegrations(prev =>
        prev.includes(integrationId)
          ? prev.filter(id => id !== integrationId)
          : [...prev, integrationId]
      );
      
      toast.success(`تم ${enabledIntegrations.includes(integrationId) ? 'إيقاف' : 'تفعيل'} التكامل`);
    } catch (error) {
      toast.error('حدث خطأ أثناء التحديث');
    } finally {
      setSavingIntegration(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Plug className="size-5" />
          </div>
          <h1 className="text-2xl font-bold">التكاملات</h1>
        </div>
        <p className="text-muted-foreground text-sm">ربط متجرك مع المنصات والقنوات الأخرى لزيادة وصولك للعملاء</p>
      </div>

      <SettingsSection title="قنوات التواصل" description="فعّل التكاملات التي تريد استخدامها">
        <div className="grid gap-3">
          {integrations.map((integration, idx) => {
            const Icon = integration.icon;
            const isEnabled = enabledIntegrations.includes(integration.id);

            return (
              <motion.div
                key={integration.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <SettingsRow>
                  <div className="flex items-start gap-3 flex-1">
                    <div className={cn(
                      'mt-0.5 p-2.5 rounded-lg transition-colors',
                      isEnabled
                        ? 'text-white'
                        : 'bg-muted text-muted-foreground'
                    )}
                    style={isEnabled ? { backgroundColor: integration.color } : undefined}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-semibold text-foreground">{integration.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{integration.description}</p>
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={isEnabled}
                    disabled={savingIntegration === integration.id}
                    onChange={() => {
                      void toggleIntegration(integration.id);
                    }}
                  />
                </SettingsRow>
              </motion.div>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection title="تفاصيل الاتصال" description="أضف معلومات الاتصال الخاصة بك">
        <div className="space-y-4">
          <SettingsField label="رقم الهاتف" description="سيظهر في صفحة المتجر">
            <Input 
              placeholder="+964 123 456 7890"
              dir="ltr"
            />
          </SettingsField>

          <SettingsField label="البريد الإلكتروني" description="للاستفسارات والدعم">
            <Input 
              placeholder="support@store.com" 
              type="email"
              dir="ltr"
            />
          </SettingsField>

          <SettingsField label="رابط واتس آب" description="رابط الدردشة المباشرة">
            <Input 
              placeholder="https://wa.me/..." 
              dir="ltr"
            />
          </SettingsField>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="outline" size="sm">إلغاء</Button>
            <Button size="sm" className="gap-2">
              <CheckCircle2 className="size-4" />
              حفظ التغييرات
            </Button>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
