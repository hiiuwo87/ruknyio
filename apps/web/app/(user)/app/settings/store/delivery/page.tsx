'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck,
  CheckCircle2,
  Trash2,
  Plus,
  Package,
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

const deliveryCompanies = [
  {
    id: 1,
    name: 'سمسا',
    apiKey: '****',
    regions: ['بغداد', 'الموصل', 'البصرة'],
    status: 'نشط',
    enabled: true,
  },
  {
    id: 2,
    name: 'أرامكس',
    apiKey: '****',
    regions: ['بغداد', 'الرياض', 'دبي'],
    status: 'قيد الاختبار',
    enabled: false,
  },
];

export default function StoreDeliveryPage() {
  const [companies, setCompanies] = useState(deliveryCompanies);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCompany, setNewCompany] = useState({
    name: '',
    apiKey: '',
    region: '',
  });
  const toast = useToast();

  const toggleCompany = (id: number) => {
    setCompanies(prev =>
      prev.map(c =>
        c.id === id
          ? { ...c, enabled: !c.enabled, status: !c.enabled ? 'نشط' : 'معطّل' }
          : c
      )
    );
  };

  const handleAddCompany = () => {
    if (!newCompany.name || !newCompany.apiKey) {
      toast.error('الرجاء ملء جميع الحقول');
      return;
    }

    setCompanies(prev => [
      ...prev,
      {
        id: prev.length + 1,
        name: newCompany.name,
        apiKey: '****',
        regions: [],
        status: 'قيد الاختبار',
        enabled: false,
      },
    ]);

    setNewCompany({ name: '', apiKey: '', region: '' });
    setShowAddForm(false);
    toast.success('تم إضافة شركة التوصيل بنجاح');
  };

  const handleDeleteCompany = (id: number) => {
    setCompanies(prev => prev.filter(c => c.id !== id));
    toast.success('تم حذف شركة التوصيل');
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Package className="size-5" />
          </div>
          <h1 className="text-2xl font-bold">شركات التوصيل</h1>
        </div>
        <p className="text-muted-foreground text-sm">إدارة شركات التوصيل والخدمات المتاحة لعملائك</p>
      </div>

      <SettingsSection
        title="الشركات المتصلة"
        description="الشركات المتصلة بمتجرك"
      >
        <div className="mb-4 flex justify-end">
          <Button
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="gap-2"
          >
            <Plus className="size-4" />
            إضافة شركة
          </Button>
        </div>

        <div className="space-y-3">
          <AnimatePresence>
            {showAddForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="border rounded-lg p-4 bg-muted/30 space-y-3"
              >
                <SettingsField label="اسم الشركة">
                  <Input
                    placeholder="اسم شركة التوصيل"
                    value={newCompany.name}
                    onChange={(e) => setNewCompany(prev => ({ ...prev, name: e.target.value }))}
                  />
                </SettingsField>

                <SettingsField label="API Key">
                  <Input
                    placeholder="ادخل مفتاح API"
                    type="password"
                    value={newCompany.apiKey}
                    onChange={(e) => setNewCompany(prev => ({ ...prev, apiKey: e.target.value }))}
                    dir="ltr"
                  />
                </SettingsField>

                <SettingsField label="المنطقة الافتراضية">
                  <Input
                    placeholder="اسم المنطقة"
                    value={newCompany.region}
                    onChange={(e) => setNewCompany(prev => ({ ...prev, region: e.target.value }))}
                  />
                </SettingsField>

                <div className="flex gap-2 justify-end pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddForm(false)}
                  >
                    إلغاء
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddCompany}
                    className="gap-2"
                  >
                    <Plus className="size-4" />
                    إضافة
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {companies.map((company, idx) => (
            <motion.div
              key={company.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="border rounded-lg p-4 space-y-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                    <Truck className="size-4" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[13px] font-semibold text-foreground">{company.name}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {company.regions.length > 0 ? company.regions.join(', ') : 'لا توجد مناطق محددة'}
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={company.enabled}
                  onChange={() => toggleCompany(company.id)}
                />
              </div>

              <div className="flex justify-end pt-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDeleteCompany(company.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="إعدادات التوصيل" description="إعدادات عامة للتوصيل والشحن">
        <div className="space-y-4">
          <SettingsField label="تكلفة التوصيل الافتراضية" description="التكلفة المفروضة بشكل افتراضي للطلبات">
            <div className="flex gap-2">
              <Input placeholder="10000" type="number" />
              <span className="flex items-center text-muted-foreground text-sm font-medium px-2 border-l border-border">د.ع</span>
            </div>
          </SettingsField>

          <SettingsField label="المدة الزمنية المتوقعة" description="الوقت المتوقع لتوصيل الطلب">
            <Input placeholder="2-3 أيام" />
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
