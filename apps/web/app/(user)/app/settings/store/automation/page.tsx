'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Mail,
  MessageSquare,
  Truck,
  CheckCircle2,
  AlertCircle,
  Send,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SettingsSection,
  SettingsField,
  SettingsRow,
  ToggleSwitch,
} from '@/components/(app)/settings';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const automationRules = [
  {
    id: 'low-stock',
    title: 'تنبيه المخزون المنخفض',
    description: 'إشعارات تلقائية عند انخفاض المخزون',
    icon: AlertCircle,
  },
  {
    id: 'order-confirmation',
    title: 'تأكيد الطلبات التلقائي',
    description: 'إرسال تأكيد بريد إلكتروني بعد الطلب',
    icon: Mail,
  },
  {
    id: 'delivery-notification',
    title: 'إشعارات التوصيل',
    description: 'تحديثات تلقائية للعميل عند التوصيل',
    icon: Truck,
  },
  {
    id: 'customer-followup',
    title: 'متابعة العملاء',
    description: 'رسائل متابعة بعد 3 أيام من الشراء',
    icon: MessageSquare,
  },
];

export default function StoreAutomationPage() {
  const [automationSettings, setAutomationSettings] = useState({
    lowStockAlert: true,
    orderConfirmation: true,
    deliveryNotification: true,
    customerFollowup: false,
    autoReplyEnabled: true,
    autoReplyMessage: 'شكراً لتواصلك معنا. سنرد عليك في أقرب وقت.',
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const ruleKeyMap: Record<string, 'lowStockAlert' | 'orderConfirmation' | 'deliveryNotification' | 'customerFollowup'> = {
    'low-stock': 'lowStockAlert',
    'order-confirmation': 'orderConfirmation',
    'delivery-notification': 'deliveryNotification',
    'customer-followup': 'customerFollowup',
  };

  const toggleRule = (ruleId: string) => {
    const ruleKey = ruleKeyMap[ruleId];
    if (!ruleKey) return;

    setAutomationSettings(prev => ({
      ...prev,
      [ruleKey]: !prev[ruleKey],
    }));
  };

  const handleSaveAutomation = async () => {
    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      toast.success('تم حفظ إعدادات الأتمتة بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Zap className="size-5" />
          </div>
          <h1 className="text-2xl font-bold">الأتمتة</h1>
        </div>
        <p className="text-muted-foreground text-sm">قواعد تلقائية وإجراءات ذكية لتسهيل وتحسين إدارة متجرك</p>
      </div>

      <SettingsSection title="قواعد الأتمتة" description="فعّل القواعد التي تريد تطبيقها">
        <div className="grid gap-3">
          {automationRules.map((rule, idx) => {
            const key = ruleKeyMap[rule.id];
            if (!key) return null;

            const Icon = rule.icon;
            const isActive = automationSettings[key];

            return (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <SettingsRow>
                  <div className="flex items-start gap-3 flex-1">
                    <div className={cn(
                      'mt-0.5 p-2 rounded-lg transition-colors',
                      isActive 
                        ? 'bg-primary/10 text-primary' 
                        : 'bg-muted text-muted-foreground'
                    )}>
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-semibold text-foreground">{rule.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{rule.description}</p>
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={automationSettings[key]}
                    onChange={() => toggleRule(rule.id)}
                  />
                </SettingsRow>
              </motion.div>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection title="الرد التلقائي" description="إعدادات الرد التلقائي على الرسائل">
        <div className="space-y-4">
          <SettingsRow>
            <div className="flex items-start gap-3 flex-1">
              <div className={cn(
                'mt-0.5 p-2 rounded-lg transition-colors',
                automationSettings.autoReplyEnabled
                  ? 'bg-primary/10 text-primary' 
                  : 'bg-muted text-muted-foreground'
              )}>
                <Send className="size-4" />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-foreground">تفعيل الرد التلقائي</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">الرد على الرسائل بشكل تلقائي فور استقبالها</p>
              </div>
            </div>
            <ToggleSwitch
              checked={automationSettings.autoReplyEnabled}
              onChange={() =>
                setAutomationSettings(prev => ({
                  ...prev,
                  autoReplyEnabled: !prev.autoReplyEnabled,
                }))
              }
            />
          </SettingsRow>

          <AnimatePresence>
            {automationSettings.autoReplyEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="space-y-3 pt-2 border-t border-border">
                  <SettingsField label="رسالة الرد التلقائي">
                    <textarea
                      value={automationSettings.autoReplyMessage}
                      onChange={(e) =>
                        setAutomationSettings(prev => ({
                          ...prev,
                          autoReplyMessage: e.target.value,
                        }))
                      }
                      placeholder="اكتب رسالة الرد التلقائي..."
                      className="min-h-28 w-full rounded-lg border border-input bg-background px-4 py-3 text-[13px] placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    />
                    <p className="text-[11px] text-muted-foreground mt-2">
                      عدد الأحرف: {automationSettings.autoReplyMessage.length}/500
                    </p>
                  </SettingsField>

                  <div className="flex justify-end gap-2 pt-3">
                    <Button variant="outline" size="sm">إلغاء</Button>
                    <Button onClick={handleSaveAutomation} disabled={saving} size="sm" className="gap-2">
                      {saving ? <Clock className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                      حفظ التغييرات
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SettingsSection>
    </div>
  );
}
