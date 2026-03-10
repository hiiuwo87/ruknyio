'use client';

import { motion } from 'framer-motion';
import { MessageSquare, FileText } from 'lucide-react';
import { SettingsSection } from '@/components/(app)/settings';

export default function WhatsAppTemplatesPage() {
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
          <FileText className="size-5 text-green-500" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">قوالب</h1>
          <p className="text-xs text-muted-foreground">
            إدارة قوالب رسائل WhatsApp Business
          </p>
        </div>
      </div>

      <SettingsSection title="قوالب الرسائل" description="إنشاء وإدارة قوالب رسائل WhatsApp للتواصل مع العملاء">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-green-500/10 mb-4">
            <MessageSquare className="size-7 text-green-500" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">قوالب الرسائل</h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            أنشئ قوالب رسائل جاهزة لإرسالها للعملاء عبر WhatsApp Business
          </p>
        </div>
      </SettingsSection>
    </motion.div>
  );
}
