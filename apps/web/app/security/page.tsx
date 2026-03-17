"use client";

import Link from "next/link";
import { Shield, Lock, KeyRound, Smartphone, AlertTriangle, UserCheck, Mail, HelpCircle, Eye, ShieldCheck, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";

const sections = [
  {
    id: "intro",
    title: "مقدمة",
    icon: Shield,
    content: `أمان حسابك هو أولويتنا القصوى في ركني. نستخدم أحدث التقنيات والممارسات الأمنية لحماية بياناتك ومعلوماتك الشخصية.

نعتمد في ركني على نظام الرابط السحري (Magic Link) لتسجيل الدخول، وهو أكثر أماناً من كلمات المرور التقليدية لأنه يُنشئ رابطاً فريداً لكل محاولة دخول.`,
  },
  {
    id: "registration",
    title: "إنشاء الحساب",
    icon: UserCheck,
    content: `**خطوات إنشاء حساب جديد:**

**1. التسجيل بالبريد الإلكتروني:**
• أدخل بريدك الإلكتروني الصحيح
• سيتم إرسال رابط تأكيد لبريدك الإلكتروني
• انقر على الرابط لتفعيل حسابك

**2. التسجيل عبر وسائل التواصل:**
• يمكنك التسجيل باستخدام حساب Google
• هذه الطريقة أسرع وأكثر أماناً
• سيتم ربط حسابك تلقائياً

**3. إكمال الملف الشخصي:**
• أدخل اسمك واسم المستخدم
• أضف صورة شخصية (اختياري)
• حسابك جاهز للاستخدام!

**ملاحظة:**
لا نستخدم كلمات المرور في ركني. بدلاً من ذلك، نستخدم نظام الرابط السحري الأكثر أماناً.`,
  },
  {
    id: "login",
    title: "آلية تسجيل الدخول",
    icon: KeyRound,
    content: `**تسجيل الدخول بالرابط السحري (Magic Link):**

هذه هي الطريقة الأساسية والأكثر أماناً لتسجيل الدخول في ركني:

**كيف يعمل:**
• أدخل بريدك الإلكتروني المسجل
• انقر على "إرسال رابط الدخول"
• افتح بريدك الإلكتروني
• انقر على الرابط السحري
• ستدخل لحسابك مباشرة!

**مميزات الرابط السحري:**
• لا حاجة لتذكر كلمة مرور
• كل رابط فريد ويُستخدم مرة واحدة
• الرابط صالح لمدة 15 دقيقة فقط
• أمان عالي ضد محاولات الاختراق

**تسجيل الدخول عبر Google:**
• انقر على "الدخول بواسطة Google"
• اختر حساب Google المرتبط
• ستدخل لحسابك فوراً

**ملاحظات أمنية:**
• يتم تشفير جميع بيانات تسجيل الدخول
• نستخدم بروتوكول HTTPS لحماية الاتصال
• كل رابط سحري يعمل مرة واحدة فقط`,
  },
  {
    id: "2fa",
    title: "المصادقة الثنائية",
    icon: Smartphone,
    content: `**ما هي المصادقة الثنائية؟**
طبقة حماية إضافية تتطلب رمزاً من تطبيق المصادقة بعد النقر على الرابط السحري.

**كيفية تفعيل المصادقة الثنائية:**
• اذهب إلى إعدادات الحساب
• انقر على "الأمان"
• اختر "تفعيل المصادقة الثنائية"
• امسح رمز QR باستخدام تطبيق المصادقة
• أدخل الرمز المكون من 6 أرقام للتأكيد

**تطبيقات المصادقة المدعومة:**
• Google Authenticator
• Microsoft Authenticator
• Authy

**رموز الاسترداد:**
• عند تفعيل المصادقة الثنائية، ستحصل على 10 رموز استرداد
• احفظ هذه الرموز في مكان آمن
• كل رمز يمكن استخدامه مرة واحدة فقط
• استخدمها إذا فقدت الوصول لتطبيق المصادقة`,
  },
  {
    id: "protection",
    title: "حماية حسابك",
    icon: ShieldCheck,
    content: `**نصائح لحماية حسابك:**

**البريد الإلكتروني:**
• تأكد من أن بريدك الإلكتروني آمن ومحدث
• فعّل المصادقة الثنائية على بريدك الإلكتروني
• لا تفتح روابط مشبوهة من رسائل غير موثوقة
• بريدك الإلكتروني هو مفتاح حسابك، احمِه جيداً

**الأجهزة:**
• سجّل الخروج من الأجهزة غير المستخدمة
• راجع الأجهزة المتصلة بحسابك من الإعدادات
• لا تنقر على روابط الدخول من أجهزة عامة

**التنبيهات:**
• فعّل إشعارات تسجيل الدخول الجديد
• ستتلقى تنبيهاً عند تسجيل الدخول من جهاز جديد
• راجع التنبيهات فوراً واتخذ إجراء إذا لزم الأمر

**الروابط السحرية:**
• لا تشارك رابط الدخول مع أي شخص
• الرابط مخصص لك فقط
• إذا لم تطلب رابط دخول، تجاهل الرسالة`,
  },
  {
    id: "hacked",
    title: "ماذا تفعل إذا تم اختراق حسابك",
    icon: AlertTriangle,
    content: `**علامات اختراق الحساب:**
• تغيير في بيانات الحساب لم تقم به
• رسائل أو منشورات لم تكتبها
• إشعارات تسجيل دخول من أماكن غير معروفة
• تلقي روابط دخول لم تطلبها

**خطوات فورية:**

**1. تأمين بريدك الإلكتروني:**
• غيّر كلمة مرور بريدك الإلكتروني فوراً
• فعّل المصادقة الثنائية على بريدك
• بريدك هو مفتاح حسابك في ركني

**2. راجع الأجهزة المتصلة:**
• اذهب إلى الإعدادات > الأمان > الأجهزة
• أنهِ جميع الجلسات النشطة
• سجّل الخروج من جميع الأجهزة

**3. راجع نشاط الحساب:**
• تحقق من أي تغييرات في الإعدادات
• راجع المعاملات والطلبات الأخيرة
• تحقق من البيانات المالية

**4. فعّل المصادقة الثنائية:**
• أضف طبقة حماية إضافية لحسابك
• هذا سيمنع الوصول غير المصرح به مستقبلاً

**5. تواصل معنا:**
• أبلغنا فوراً عبر security@rukny.io
• سنساعدك في تأمين حسابك
• قد نحتاج لتجميد الحساب مؤقتاً للحماية`,
  },
  {
    id: "lost-email",
    title: "فقدان الوصول للبريد الإلكتروني",
    icon: Mail,
    content: `**إذا لم تستطع الوصول لبريدك الإلكتروني:**

بما أننا نستخدم الرابط السحري للدخول، فإن بريدك الإلكتروني ضروري للوصول لحسابك.

**الخيار 1: استعادة البريد الإلكتروني**
• حاول استعادة الوصول لبريدك من مزود الخدمة (Gmail, Yahoo, etc.)
• معظم مزودي البريد لديهم خيارات استرداد متعددة
• بعد استعادة البريد، يمكنك تسجيل الدخول طبيعياً

**الخيار 2: التحقق من الهوية**
إذا لم تستطع استعادة بريدك، تواصل معنا مع المعلومات التالية:
• الاسم الكامل المسجل في الحساب
• اسم المستخدم (Username)
• رقم الهاتف المرتبط (إن وجد)
• آخر نشاط تتذكره في الحساب
• أي معلومات تثبت ملكيتك للحساب

**الخيار 3: رموز الاسترداد**
• إذا كنت قد فعّلت المصادقة الثنائية
• استخدم أحد رموز الاسترداد العشرة
• بعد الدخول، حدّث بريدك الإلكتروني فوراً

**ملاحظة مهمة:**
• عملية التحقق قد تستغرق 3-5 أيام عمل
• نطلب هذه المعلومات لحماية حسابك
• احرص على تحديث بريدك الإلكتروني دائماً`,
  },
  {
    id: "privacy",
    title: "حماية البيانات",
    icon: Eye,
    content: `**كيف نحمي بياناتك:**

**التشفير:**
• جميع البيانات مشفرة أثناء النقل (TLS/SSL)
• الروابط السحرية مشفرة وفريدة
• البيانات الحساسة مشفرة في قاعدة البيانات

**البنية التحتية:**
• خوادم آمنة ومعتمدة
• نسخ احتياطية يومية مشفرة
• مراقبة أمنية على مدار الساعة

**الوصول المحدود:**
• الوصول للبيانات مقتصر على الموظفين المصرح لهم
• سجلات مراجعة لجميع عمليات الوصول
• فصل البيانات بين المستخدمين

**الامتثال:**
• نلتزم بأفضل الممارسات الأمنية
• مراجعات أمنية دورية
• اختبارات اختراق منتظمة`,
  },
  {
    id: "report",
    title: "الإبلاغ عن مشكلة أمنية",
    icon: FileWarning,
    content: `**إذا اكتشفت ثغرة أمنية:**

نقدّر مساهمتك في تحسين أمان منصتنا. إذا اكتشفت أي ثغرة أمنية، يرجى إبلاغنا بشكل مسؤول.

**كيفية الإبلاغ:**
• أرسل تفاصيل الثغرة إلى security@rukny.io
• اشرح الخطوات لإعادة إنتاج المشكلة
• لا تستغل الثغرة أو تشاركها مع الآخرين

**ما نتعهد به:**
• الرد على بلاغك خلال 48 ساعة
• إبقاؤك على اطلاع بحالة الإصلاح
• ذكرك في قائمة الشكر (إن رغبت)

**ما لا يجب فعله:**
• الوصول لبيانات مستخدمين آخرين
• تعطيل الخدمات أو الأنظمة
• مشاركة الثغرة قبل إصلاحها`,
  },
  {
    id: "contact",
    title: "تواصل معنا",
    icon: HelpCircle,
    content: `**للمساعدة في مسائل الأمان:**

**البريد الإلكتروني للأمان:**
security@rukny.io

**الدعم الفني:**
support@rukny.io

**للحالات الطارئة:**
إذا كنت تعتقد أن حسابك في خطر فوري، أرسل رسالة تحتوي على "طوارئ" في العنوان وسنرد عليك بأسرع وقت ممكن.`,
  },
];

export default function SecurityPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-background">

      {/* Hero Section */}
      <section className="relative pt-28 sm:pt-32 pb-16 sm:pb-24 bg-gradient-to-b from-primary/5 to-background">
        <div className="container px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Lock className="size-4" />
              أمانك أولويتنا
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
              الأمان وحماية الحساب
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              تعرّف على كيفية حماية حسابك، وما يجب فعله في حالات الطوارئ. نحن هنا لمساعدتك في الحفاظ على أمان بياناتك.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              آخر تحديث: 1 فبراير 2026
            </p>
          </div>
        </div>
      </section>

      {/* Table of Contents */}
      <section className="py-8 border-b">
        <div className="container px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-lg font-semibold mb-4">محتويات الصفحة</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
                >
                  <section.icon className="size-4 text-primary shrink-0" />
                  <span className="line-clamp-1">{section.title}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Content Sections */}
      <section className="py-12 sm:py-16">
        <div className="container px-4 sm:px-6">
          <div className="max-w-4xl mx-auto space-y-12">
            {sections.map((section, index) => (
              <div
                key={section.id}
                id={section.id}
                className="scroll-mt-20"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <section.icon className="size-6 text-primary" />
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">
                      القسم {index + 1}
                    </span>
                    <h2 className="text-2xl font-bold">{section.title}</h2>
                  </div>
                </div>
                <div className="pr-16">
                  <div className="prose prose-gray dark:prose-invert max-w-none">
                    {section.content.split("\n\n").map((paragraph, pIndex) => (
                      <div key={pIndex} className="mb-4">
                        {paragraph.startsWith("**") ? (
                          <div>
                            {paragraph.split("\n").map((line, lIndex) => {
                              if (line.startsWith("**") && line.endsWith("**")) {
                                return (
                                  <h3
                                    key={lIndex}
                                    className="text-base font-semibold mt-4 mb-2"
                                  >
                                    {line.replace(/\*\*/g, "")}
                                  </h3>
                                );
                              }
                              if (line.startsWith("•")) {
                                return (
                                  <p
                                    key={lIndex}
                                    className="text-muted-foreground text-sm mr-4"
                                  >
                                    {line}
                                  </p>
                                );
                              }
                              return (
                                <p
                                  key={lIndex}
                                  className="text-muted-foreground text-sm"
                                >
                                  {line.replace(/\*\*/g, "")}
                                </p>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-muted-foreground leading-relaxed">
                            {paragraph}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {index < sections.length - 1 && (
                  <div className="mt-8 border-b" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} ركني. جميع الحقوق محفوظة.</p>
            <div className="flex gap-6">
              <Link href="/privacy" className="hover:text-primary transition-colors">
                سياسة الخصوصية
              </Link>
              <Link href="/terms" className="hover:text-primary transition-colors">
                شروط الاستخدام
              </Link>
              <Link href="/help" className="hover:text-primary transition-colors">
                مركز المساعدة
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
