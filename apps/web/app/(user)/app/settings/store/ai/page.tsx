'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Zap,
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

const aiFeatures = [
  {
    id: 'product-descriptions',
    name: 'كتابة أوصاف المنتجات',
    description: 'توليد أوصاف احترافية للمنتجات تلقائياً',
    status: 'متاح',
  },
  {
    id: 'image-analysis',
    name: 'تحليل الصور',
    description: 'استخراج معلومات تلقائية من صور المنتجات',
    status: 'متاح',
  },
  {
    id: 'customer-support',
    name: 'دعم العملاء الذكي',
    description: 'رد تلقائي ذكي على رسائل العملاء',
    status: 'قريباً',
  },
  {
    id: 'inventory-forecast',
    name: 'توقع المخزون',
    description: 'توقع الطلب والمخزون بناءً على البيانات',
    status: 'قريباً',
  },
];

export default function StoreAIPage() {
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>(['product-descriptions', 'image-analysis']);
  const [apiKey, setApiKey] = useState('sk_live_51K2N8****');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveApiKey, setSaveApiKey] = useState(false);
  const [usageStats] = useState({
    thisMonth: 1250,
    limit: 5000,
    percentage: 25,
  });
  const toast = useToast();

  const toggleFeature = (featureId: string) => {
    setEnabledFeatures(prev =>
      prev.includes(featureId)
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    );
  };

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    toast.success('تم نسخ API Key إلى الحافظة');
  };

  const handleSaveApiKey = async () => {
    setSaveApiKey(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      toast.success('تم حفظ API Key بنجاح');
    } finally {
      setSaveApiKey(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="size-6" />
          مميزات الذكاء الاصطناعي
        </h1>
        <p className="text-muted-foreground mt-1">استخدم تقنيات الذكاء الاصطناعي لتحسين متجرك</p>
      </div>

      <SettingsSection 
        title="المميزات المتاحة" 
        description="فعّل المميزات التي تريد استخدامها"
      >
        <div className="space-y-3">
          {aiFeatures.map((feature, idx) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <SettingsRow>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-foreground">{feature.name}</p>
                    {feature.status === 'قريباً' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        قريباً
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{feature.description}</p>
                </div>
                <ToggleSwitch
                  checked={enabledFeatures.includes(feature.id)}
                  disabled={feature.status === 'قريباً'}
                  onChange={() => toggleFeature(feature.id)}
                />
              </SettingsRow>
            </motion.div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="إعدادات API" description="أضف مفتاح API الخاص بك">
        <div className="space-y-4">
          <SettingsField label="API Key" description="مفتاح الوصول الآمن">
            <div className="flex gap-2">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk_live_****"
                dir="ltr"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyApiKey}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </SettingsField>

          <div className="flex justify-end gap-2">
            <Button variant="outline">إلغاء</Button>
            <Button 
              onClick={handleSaveApiKey} 
              disabled={saveApiKey}
              className="gap-2"
            >
              {saveApiKey ? <Zap className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              حفظ API Key
            </Button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection 
        title="استخدام الخدمات" 
        description="مراقبة استخدامك الحالي للخدمات"
      >
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                طلبات هذا الشهر
              </span>
              <span className="text-sm text-muted-foreground">
                {usageStats.thisMonth} / {usageStats.limit}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${usageStats.percentage}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-gradient-to-r from-primary to-primary/70"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {usageStats.percentage}% من الحد المسموح
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-900">
              <p className="font-medium">قريباً: زيادة الحد المسموح</p>
              <p className="text-xs opacity-75 mt-0.5">
                يمكنك ترقية خطتك للحصول على حدود أعلى والمزيد من المميزات
              </p>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="متطلبات الاستخدام" description="تعرف على متطلبات استخدام خدمات الذكاء الاصطناعي">
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-green-600" />
            <span>متجر نشط بمنتجات حقيقية</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-green-600" />
            <span>ما لا يقل عن 10 طلبات سابقة</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-green-600" />
            <span>حساب موثق ومتحقق</span>
          </li>
        </ul>
      </SettingsSection>
    </div>
  );
}
