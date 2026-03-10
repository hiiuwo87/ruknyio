/**
 * Telegram Message Templates
 */

export class TelegramMessageTemplates {
  /**
   * 🔐 رسالة الترحيب عند البدء
   */
  static getWelcomeMessage(): string {
    return `
<b>مرحبا بك في Rukny Bot! 👋</b>

أنا بوت Rukny للإشعارات الأمنية والأنشطة.

ستتلقى تنبيهات حول:
🔐 تسجيلات الدخول الجديدة
⚠️ محاولات دخول فاشلة
🔔 تحديثات الأمان المهمة

<i>أدخل كود التحقق من لوحة التحكم لتوصيل حسابك</i>
    `.trim();
  }

  /**
   * ✅ رسالة الربط الناجح
   */
  static getSuccessMessage(email: string): string {
    return `
<b>✅ تم ربط الحساب بنجاح!</b>

البريد الإلكتروني: <code>${email}</code>

ستتلقى الآن جميع إشعارات الأمان والنشاطات على هذا الحساب.
    `.trim();
  }

  /**
   * ❌ رسالة الخطأ
   */
  static getErrorMessage(error: string): string {
    return `
<b>❌ خطأ في الربط</b>

${error}

يرجى محاولة مرة أخرى أو التواصل مع الدعم.
    `.trim();
  }

  /**
   * ⏱ رسالة الإلغاء
   */
  static getCancelledMessage(): string {
    return `<b>❌ تم إلغاء الربط</b>`;
  }

  /**
   * 🔐 تنبيه تسجيل دخول جديد
   */
  static getLoginNotification(details: {
    device?: string;
    location?: string;
    ip?: string;
    time?: string;
  }): string {
    return `
<b>🔐 تسجيل دخول جديد</b>

تم تسجيل دخول على حسابك:

${details.device ? `📱 <b>الجهاز:</b> ${details.device}` : ''}
${details.location ? `📍 <b>الموقع:</b> ${details.location}` : ''}
${details.ip ? `🌐 <b>الـ IP:</b> ${details.ip}` : ''}
${details.time ? `🕐 <b>الوقت:</b> ${details.time}` : ''}

<i>إذا لم تقم بهذا الدخول، غيّر كلمة المرور فوراً</i>
    `.trim();
  }

  /**
   * ⚠️ تنبيه محاولات دخول فاشلة
   */
  static getFailedLoginNotification(details: {
    attempts?: number;
    location?: string;
    ip?: string;
    time?: string;
    reason?: string;
  }): string {
    return `
<b>⚠️ محاولات دخول فاشلة</b>

تم رصد محاولات دخول فاشلة على حسابك:

${details.attempts ? `🔴 <b>عدد المحاولات:</b> ${details.attempts}` : ''}
${details.location ? `📍 <b>الموقع:</b> ${details.location}` : ''}
${details.ip ? `🌐 <b>الـ IP:</b> ${details.ip}` : ''}
${details.time ? `🕐 <b>الوقت:</b> ${details.time}` : ''}
${details.reason ? `<b>السبب:</b> ${details.reason}` : ''}

<i>إذا لم تكن أنت، تأكد من أمان حسابك</i>
    `.trim();
  }

  /**
   * 🔑 تنبيه تغيير كلمة المرور
   */
  static getPasswordChangeNotification(details?: {
    time?: string;
    device?: string;
  }): string {
    return `
<b>🔑 تم تغيير كلمة المرور</b>

تم تغيير كلمة المرور على حسابك:

${details?.time ? `🕐 <b>الوقت:</b> ${details.time}` : ''}
${details?.device ? `📱 <b>الجهاز:</b> ${details.device}` : ''}

<i>إذا لم تقم بهذا، تواصل مع الدعم فوراً</i>
    `.trim();
  }

  /**
   * 🔓 تنبيه تفعيل التحقق الثنائي
   */
  static getTwoFactorEnabledNotification(): string {
    return `
<b>🔐 تم تفعيل التحقق الثنائي</b>

تم تفعيل التحقق الثنائي على حسابك بنجاح.

حسابك الآن أكثر أماناً ✅
    `.trim();
  }

  /**
   * 📊 ملخص النشاط اليومي
   */
  static getDailySummary(stats: {
    totalLogins?: number;
    newDevices?: number;
    failedAttempts?: number;
    location?: string;
  }): string {
    return `
<b>📊 ملخص نشاط اليوم</b>

📅 ${new Date().toLocaleDateString('ar-SA')}

${stats.totalLogins ? `✅ <b>تسجيلات دخول:</b> ${stats.totalLogins}` : ''}
${stats.newDevices ? `📱 <b>أجهزة جديدة:</b> ${stats.newDevices}` : ''}
${stats.failedAttempts ? `🔴 <b>محاولات فاشلة:</b> ${stats.failedAttempts}` : ''}
${stats.location ? `📍 <b>المواقع:</b> ${stats.location}` : ''}

<i>لعرض التفاصيل الكاملة، اذهب إلى لوحة التحكم</i>
    `.trim();
  }

  /**
   * 🆘 طلب مساعدة
   */
  static getHelpMessage(): string {
    return `
<b>🆘 كيفية الاستخدام</b>

الأوامر المتاحة:

/start - بدء الربط
/status - عرض حالة الربط
/help - عرض المساعدة

<i>لأي مشاكل، تواصل مع الدعم</i>
    `.trim();
  }

  /**
   * 🧪 رسالة الاختبار
   */
  static getTestMessage(): string {
    return `
<b>✅ اختبار الاتصال</b>

إذا رأيت هذه الرسالة، فالاتصال يعمل بشكل صحيح! 🎉
    `.trim();
  }
}
