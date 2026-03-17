"use client";

import Link from "next/link";
import { FileText, Scale, Users, CreditCard, AlertTriangle, ShieldCheck, Ban, RefreshCw, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

const sections = [
  {
    id: "intro",
    title: "مقدمة",
    icon: FileText,
    content: `مرحباً بك في ركني. باستخدامك لمنصتنا، فإنك توافق على الالتزام بهذه الشروط والأحكام. يرجى قراءتها بعناية قبل استخدام خدماتنا.

تحكم هذه الشروط استخدامك لموقع ركني وجميع الخدمات المرتبطة به. إذا كنت لا توافق على أي جزء من هذه الشروط، يرجى عدم استخدام المنصة.`,
  },
  {
    id: "definitions",
    title: "التعريفات",
    icon: Scale,
    content: `**المنصة:**
موقع ركني الإلكتروني وجميع الخدمات والتطبيقات المرتبطة به.

**المستخدم:**
أي شخص يقوم بالتسجيل أو استخدام خدمات المنصة.

**الحساب:**
حساب المستخدم المسجل على المنصة.

**المحتوى:**
جميع النصوص والصور والملفات والبيانات التي يرفعها المستخدم على المنصة.

**الخدمات:**
جميع الميزات والوظائف المتاحة عبر المنصة بما في ذلك إنشاء المتاجر والنماذج والصفحات الشخصية.`,
  },
  {
    id: "account",
    title: "الحساب والتسجيل",
    icon: Users,
    content: `**متطلبات التسجيل:**
• يجب أن يكون عمرك 18 عاماً على الأقل
• تقديم معلومات صحيحة ودقيقة
• الحفاظ على سرية بيانات تسجيل الدخول
• إخطارنا فوراً بأي استخدام غير مصرح به

**مسؤولية الحساب:**
• أنت مسؤول عن جميع الأنشطة التي تتم من خلال حسابك
• يحق لنا تعليق أو إنهاء حسابك في حالة انتهاك الشروط
• لا يجوز مشاركة حسابك مع أي شخص آخر

**حذف الحساب:**
• يمكنك طلب حذف حسابك في أي وقت
• سيتم حذف بياناتك وفقاً لسياسة الخصوصية
• بعض البيانات قد تُحفظ لأغراض قانونية`,
  },
  {
    id: "usage",
    title: "الاستخدام المقبول",
    icon: ShieldCheck,
    content: `**يُسمح لك بـ:**
• إنشاء متجر إلكتروني لبيع منتجات أو خدمات مشروعة
• إنشاء نماذج واستبيانات لجمع البيانات بشكل قانوني
• إنشاء صفحة شخصية للترويج لأعمالك
• استخدام أدوات التحليلات لفهم أداء أعمالك

**الاستخدام المسؤول:**
• احترام حقوق الملكية الفكرية للآخرين
• الالتزام بالقوانين المحلية والدولية
• التعامل باحترام مع المستخدمين الآخرين
• الحفاظ على أمان المنصة وعدم محاولة اختراقها`,
  },
  {
    id: "prohibited",
    title: "الأنشطة المحظورة",
    icon: Ban,
    content: `**يُحظر عليك:**
• بيع منتجات أو خدمات غير قانونية
• نشر محتوى مسيء أو تمييزي أو يحرض على الكراهية
• انتحال شخصية الآخرين أو تضليل المستخدمين
• جمع بيانات المستخدمين بدون موافقتهم
• إرسال رسائل غير مرغوب فيها (سبام)
• محاولة اختراق أو تعطيل المنصة
• استخدام برامج آلية للوصول للمنصة
• إعادة بيع خدمات المنصة بدون إذن

**العواقب:**
انتهاك هذه القواعد قد يؤدي إلى تعليق أو إنهاء حسابك فوراً، وقد نتخذ إجراءات قانونية إذا لزم الأمر.`,
  },
  {
    id: "payment",
    title: "الدفع والاشتراكات",
    icon: CreditCard,
    content: `**خطط الاشتراك:**
• نوفر خطط اشتراك مختلفة بمميزات متنوعة
• الأسعار معروضة بالدينار العراقي وقابلة للتغيير
• سيتم إخطارك بأي تغييرات في الأسعار مسبقاً

**الدفع:**
• يتم الدفع مقدماً للفترة المختارة
• نقبل طرق الدفع المعتمدة في المنصة
• جميع المدفوعات غير قابلة للاسترداد إلا وفق سياسة الاسترداد

**التجديد التلقائي:**
• يتم تجديد الاشتراكات تلقائياً
• يمكنك إلغاء التجديد التلقائي قبل موعد التجديد
• في حالة فشل الدفع، قد يتم تعليق الخدمات`,
  },
  {
    id: "content",
    title: "المحتوى والملكية الفكرية",
    icon: FileText,
    content: `**محتوى المستخدم:**
• تحتفظ بملكية المحتوى الذي ترفعه
• تمنحنا ترخيصاً لعرض واستضافة محتواك
• أنت مسؤول عن قانونية المحتوى الذي ترفعه

**ملكية المنصة:**
• جميع حقوق الملكية الفكرية للمنصة محفوظة لنا
• لا يجوز نسخ أو توزيع أي جزء من المنصة
• العلامات التجارية والشعارات ملك لأصحابها

**الإبلاغ عن الانتهاكات:**
إذا لاحظت أي انتهاك لحقوق الملكية الفكرية، يرجى التواصل معنا فوراً.`,
  },
  {
    id: "liability",
    title: "حدود المسؤولية",
    icon: AlertTriangle,
    content: `**إخلاء المسؤولية:**
• نقدم المنصة "كما هي" بدون ضمانات صريحة أو ضمنية
• لا نضمن توفر الخدمة بشكل متواصل أو خالٍ من الأخطاء
• لسنا مسؤولين عن أي خسائر ناتجة عن استخدام المنصة

**حدود التعويض:**
• مسؤوليتنا محدودة بقيمة ما دفعته لنا خلال آخر 12 شهراً
• لا نتحمل مسؤولية الأضرار غير المباشرة أو التبعية
• أنت مسؤول عن الالتزام بالقوانين المحلية

**التعويض:**
توافق على تعويضنا عن أي مطالبات أو خسائر ناتجة عن انتهاكك لهذه الشروط أو استخدامك للمنصة.`,
  },
  {
    id: "changes",
    title: "التعديلات والإنهاء",
    icon: RefreshCw,
    content: `**تعديل الشروط:**
• يحق لنا تعديل هذه الشروط في أي وقت
• سنُعلمك بالتغييرات الجوهرية عبر البريد الإلكتروني
• استمرارك في استخدام المنصة يعني موافقتك على التعديلات

**إنهاء الخدمة:**
• يمكنك إنهاء حسابك في أي وقت
• يحق لنا إنهاء أو تعليق حسابك لأي سبب
• عند الإنهاء، تنتهي جميع الحقوق الممنوحة لك

**استمرارية بعض الأحكام:**
بعض الأحكام تستمر بعد إنهاء العلاقة بما في ذلك الملكية الفكرية وحدود المسؤولية والتعويض.`,
  },
  {
    id: "contact",
    title: "تواصل معنا",
    icon: Mail,
    content: `إذا كانت لديك أي أسئلة حول شروط الاستخدام:

**البريد الإلكتروني:**
support@rukny.io

**الدعم الفني:**
help@rukny.io
support@rukny.xyz   

**العنوان:**
العراق - محافظة ميسان


نلتزم بالرد على جميع الاستفسارات القانونية خلال 72 ساعة عمل.`,
  },
];

export default function TermsPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative pt-28 sm:pt-32 pb-16 sm:pb-24 bg-gradient-to-b from-primary/5 to-background">
        <div className="container px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Scale className="size-4" />
              شروط واضحة وعادلة
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
              شروط الاستخدام
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              يرجى قراءة هذه الشروط بعناية قبل استخدام منصة ركني. باستخدامك للمنصة فإنك توافق على الالتزام بهذه الشروط.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              آخر تحديث: 1 فبراير 2026
            </p>
          </div>
        </div>
      </section>

      {/* Table of Contents */}
      <section className="py-8 border-b bg-muted/30 m-4 rounded-4xl">
        <div className="container px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-lg font-semibold mb-4">محتويات الصفحة</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="flex items-center gap-2 p-3 rounded-2xl bg-background border hover:border-primary/50 hover:bg-primary/5 transition-colors text-sm"
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
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
