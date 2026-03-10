'use client';

import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import Image from 'next/image';
import { SettingsSection } from '@/components/(app)/settings';

export default function WhatsAppAccountPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mt-4">
        <div className="flex size-10 items-center justify-center rounded-full bg-green-500/10">
          <User className="size-5 text-green-500" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">الحساب</h1>
          <p className="text-xs text-muted-foreground">
            إدارة حساب WhatsApp Business
          </p>
        </div>
      </div>

      <SettingsSection title="معلومات الحساب" description="بيانات حساب WhatsApp Business المرتبط بمتجرك">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-green-500/10 mb-4">
            <Image src="/icons/whatsapp.svg" alt="WhatsApp" width={28} height={28} />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">حساب WhatsApp</h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            قم بربط وإدارة حساب WhatsApp Business لتفعيل التواصل مع العملاء
          </p>
        </div>
      </SettingsSection>
    </motion.div>
  );
}
