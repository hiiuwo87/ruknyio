import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'سياسة الخصوصية | Rukny.io',
  description: 'سياسة الخصوصية لمنصة ركني',
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16" dir="rtl">
      <h1 className="text-3xl font-bold mb-8">سياسة الخصوصية</h1>
      <p className="text-sm text-muted-foreground mb-8">آخر تحديث: مارس 2026</p>

      <div className="prose prose-sm dark:prose-invert space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-3">1. المقدمة</h2>
          <p className="text-muted-foreground leading-relaxed">
            مرحباً بك في منصة ركني (Rukny.io). نحن نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية.
            توضح هذه السياسة كيف نجمع واستخدام ونحمي معلوماتك عند استخدام خدماتنا.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">2. البيانات التي نجمعها</h2>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>معلومات الحساب: الاسم، البريد الإلكتروني، صورة الملف الشخصي</li>
            <li>بيانات الملف الشخصي: الروابط الاجتماعية، الوصف، المحتوى المضاف</li>
            <li>بيانات الاستخدام: سجلات الزيارات والتفاعل مع المنصة</li>
            <li>بيانات التكامل: عند ربط حسابات خارجية مثل Instagram، نحصل على بيانات الملف العام فقط</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">3. كيف نستخدم بياناتك</h2>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>تقديم وتحسين خدماتنا</li>
            <li>عرض محتواك على صفحتك الشخصية</li>
            <li>إرسال إشعارات مهمة متعلقة بحسابك</li>
            <li>تحليل الاستخدام لتحسين تجربة المستخدم</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">4. مشاركة البيانات</h2>
          <p className="text-muted-foreground leading-relaxed">
            لا نبيع أو نشارك بياناتك الشخصية مع أطراف ثالثة إلا في الحالات التالية:
            بموافقتك الصريحة، للامتثال للقانون، أو لحماية حقوقنا وسلامة مستخدمينا.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">5. تكامل Instagram</h2>
          <p className="text-muted-foreground leading-relaxed">
            عند ربط حساب Instagram، نحصل على صلاحية الوصول إلى بيانات ملفك العام ومنشوراتك.
            يمكنك إلغاء هذا الربط في أي وقت من إعدادات حسابك.
            عند إلغاء الربط، نحذف جميع بيانات Instagram المخزنة لديك.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">6. حذف البيانات</h2>
          <p className="text-muted-foreground leading-relaxed">
            يمكنك طلب حذف بياناتك في أي وقت عبر إعدادات الحساب أو بالتواصل معنا.
            سنقوم بحذف جميع بياناتك الشخصية خلال 30 يوماً من الطلب.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">7. أمان البيانات</h2>
          <p className="text-muted-foreground leading-relaxed">
            نستخدم تقنيات أمان متقدمة لحماية بياناتك، بما في ذلك التشفير وبروتوكولات HTTPS.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">8. التواصل معنا</h2>
          <p className="text-muted-foreground leading-relaxed">
            لأي استفسارات حول سياسة الخصوصية، تواصل معنا عبر البريد الإلكتروني: support@rukny.io
          </p>
        </section>
      </div>
    </main>
  );
}
