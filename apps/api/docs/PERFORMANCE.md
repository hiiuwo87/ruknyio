# تحسين الأداء وسرعة الاستجابة

## ما تم تطبيقه

### 1. تحسين `/auth/refresh`
- **تقليل الحقول المُجلبة**: استعلام الجلسة يطلب فقط الحقول اللازمة (بدون `createdAt`, `lastActivity`, `expiresAt`).
- **فهرس مركّب**: إضافة `@@index([previousRefreshTokenHash, isRevoked])` على جدول `Session` لتسريع كشف إعادة استخدام التوكن.
- **تطبيق الفهرس**: تشغيل `npx prisma migrate dev` لإنشاء migration الفهرس الجديد.

### 2. تقليل ضجيج الـ Logs
- **Cookie**: طباعة `[Cookie] Building Set-Cookie` و `[Cookie] Clearing` فقط عند `DEBUG_COOKIES=1` (لا تظهر افتراضياً).

### 3. معالجة N+1 في النماذج (Forms)
- استبدال حلقات `formField.create()` بـ **`formField.createMany()`** في:
  - إنشاء النماذج (خطوات + حقول).
  - تحديث النماذج وتحديث الخطوات.
- النتيجة: استعلام واحد بدلاً من N استعلامات لكل مجموعة حقول.

### 4. عتبة الطلبات البطيئة
- الطلبات التي تتجاوز **1000ms** تُسجَّل كـ `SLOW REQUEST` في الـ interceptor.
- يمكن تغيير العتبة من `performance.interceptor.ts`: `SLOW_REQUEST_THRESHOLD`.

---

## توصيات إضافية

### قاعدة البيانات
- **الفهارس**: التأكد من وجود فهارس على الأعمدة المستخدمة في `where` و `orderBy` و `join`.
- **الاتصال**: استخدام Connection pooling (عادة مضبوط مع Prisma).
- **استعلامات بطيئة**: مراجعة `prisma.$queryRaw` أو سجلات DB لاستعلامات > 100ms.

### تجنب N+1
- عند جلب قوائم مع علاقات، استخدم `include` أو `select` بدلاً من جلب العلاقة داخل حلقة.
- مثال: `form.findMany({ include: { fields: true } })` بدلاً من `form.findMany()` ثم `formField.findMany()` لكل نموذج.
- استخدام **`createMany`** عند إدراج عدة صفوف متشابهة بدلاً من `create` داخل حلقة.

### التخزين المؤقت (Cache)
- استخدام Redis/`CacheManager` للبيانات التي تُقرأ كثيراً وتتغير قليلاً (مثل إعدادات، إحصائيات).
- الاعتماد على `CACHE_TTL` و `CacheKeys` الموجودة وتوسيعها عند الحاجة.

### مراقبة الأداء
- تتبع مقاييس `perf:metrics` و `perf:slow_endpoints` في Redis.
- مراجعة الـ health endpoint لـ `slowQueries` واقتراحات التحسين.

---

## تشغيل Migration لفهرس الجلسات

بعد تعديل الـ schema (فهرس `previousRefreshTokenHash` + `isRevoked`):

```bash
cd apps/api
npx prisma migrate dev --name add_session_composite_index
```

ثم إعادة تشغيل الخادم.

---

## تحسينات Neon PostgreSQL (Serverless DB)

### 1. تحسين Keepalive Frequency
- **قبل**: ping كل 3 دقائق
- **بعد**: ping كل 90 ثانية
- **السبب**: Neon يُعلّق قاعدة البيانات بعد 5 دقائق من عدم النشاط، 90 ثانية تضمن عدم الوصول لهذا الحد

### 2. Connection Pool Warming عند Startup
- **ماذا**: تنفيذ queries خفيفة على الجداول الرئيسية (sessions, users) عند بدء التشغيل
- **السبب**: تسخين الـ query planner و connection pool قبل أول طلب حقيقي

### 3. تحسين Silent Refresh Timing (Frontend)
- **قبل**: تجديد عند 80% من expires_in (24 دقيقة لـ 30 دقيقة token)
- **بعد**: تجديد عند 50% من expires_in (15 دقيقة لـ 30 دقيقة token)
- **السبب**: يعطي وقت أكبر للتعامل مع cold starts البطيئة لـ Neon

### 4. Performance Timing Logging
- **ماذا**: تسجيل وقت كل query في `refreshTokens()`
- **السبب**: تتبع الاستعلامات البطيئة (> 500ms) وتشخيص المشاكل

---

## مراقبة الأداء في Production

### استخدام الـ logs
```bash
# البحث عن refreshes بطيئة
grep "Refresh completed" logs.txt | grep -v "under 1000ms"

# البحث عن slow queries
grep "⚠️ Slow" logs.txt
```

### Health Endpoint
```
GET /health → يعرض queryCount, slowQueries
GET /health/metrics → Prometheus format للـ monitoring
```
