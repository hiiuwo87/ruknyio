# 🤖 Telegram Integration Module

## نظرة عامة

نظام تكامل Telegram للتطبيق يوفر إشعارات فورية وآمنة لتنبيهات الدخول والأمان.

## 📁 هيكل الملفات

```
src/integrations/telegram/
├── telegram.service.ts           # خدمة الـ API الأساسية
├── telegram-session.service.ts   # إدارة جلسات التحقق
├── telegram.controller.ts        # REST API endpoints
├── telegram-webhook.controller.ts # استقبال Webhook
├── telegram.module.ts            # Module التسجيل
├── telegram.types.ts             # Types والـ Interfaces
├── telegram.templates.ts         # Templates الرسائل
└── README.md                     # هذا الملف
```

## 🚀 البدء السريع

### 1️⃣ تثبيت Dependencies

```bash
npm install axios nanoid
```

### 2️⃣ إنشاء Bot على Telegram

1. افتح [@BotFather](https://t.me/botfather) على Telegram
2. أرسل `/newbot`
3. اتبع التعليمات وسيحصل على Token
4. احفظ الـ Token في متغير البيئة

### 3️⃣ إضافة متغيرات البيئة

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_BOT_NAME=RuknyBot
TELEGRAM_WEBHOOK_URL=https://your-domain.com/api/telegram/webhook
TELEGRAM_ENABLED=true
```

### 4️⃣ تشغيل Migration

```bash
cd apps/api
npx prisma migrate dev --name add_telegram_integration
```

### 5️⃣ بدء التطبيق

```bash
npm run start:dev
```

## 📡 API Endpoints

### 1. إنشاء جلسة تحقق

**POST** `/api/telegram/generate-session`

```bash
curl -X POST http://localhost:3001/api/telegram/generate-session \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_abc123xyz",
    "botLink": "https://t.me/RuknyBot?start=sess_abc123xyz",
    "expiresAt": "2025-12-24T12:15:00Z"
  }
}
```

### 2. الحصول على حالة الربط

**GET** `/api/telegram/status`

```bash
curl http://localhost:3001/api/telegram/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "enabled": true,
    "chatId": "123456789",
    "username": "username",
    "firstName": "أحمد",
    "connectedAt": "2025-12-24T12:00:00Z"
  }
}
```

### 3. فصل الاتصال

**DELETE** `/api/telegram/disconnect`

```bash
curl -X DELETE http://localhost:3001/api/telegram/disconnect \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. اختبار الإرسال

**POST** `/api/telegram/test`

```bash
curl -X POST http://localhost:3001/api/telegram/test \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🎣 Webhook

### استقبال التحديثات

**POST** `/api/telegram/webhook`

الـ Webhook يستقبل:
- الرسائل (messages)
- النقرات على الأزرار (callback queries)
- تحديثات العضوية (membership updates)

### تحقق من التوقيع

```typescript
// الـ signature موجود في Header
X-Telegram-Bot-Api-Secret-Hash

// يتم التحقق تلقائياً في الـ Controller
```

## 🧪 الاختبار المحلي

### استخدام ngrok

```bash
# 1. تثبيت ngrok
npm install -g ngrok

# 2. فتح tunnel
ngrok http 3333

# 3. نسخ الرابط (مثل: https://xxxx-xxx-xxx.ngrok.io)

# 4. تحديث الـ .env
TELEGRAM_WEBHOOK_URL=https://xxxx-xxx-xxx.ngrok.io/api/telegram/webhook

# 5. إعادة تشغيل التطبيق
npm run start:dev
```

### محاكاة Webhook

```bash
curl -X POST http://localhost:3333/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Hash: your-signature" \
  -d '{
    "update_id": 123456,
    "message": {
      "message_id": 1,
      "from": {
        "id": 123,
        "is_bot": false,
        "first_name": "Test"
      },
      "chat": {"id": 123, "type": "private"},
      "date": 1703421600,
      "text": "/start sess_abc123"
    }
  }'
```

## 🔐 الأمان

### التحقق من التوقيع

```typescript
// في TelegramService
verifyWebhookSignature(payload, signature): boolean {
  const secretKey = crypto
    .createHash('sha256')
    .update(botToken)
    .digest();
  
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return hash === signature;
}
```

### حماية الجلسات

- جلسات التحقق تنتهي بعد 5 دقائق
- لا يمكن استخدام نفس الجلسة مرتين
- يتم حفظ جميع الـ logs للمراجعة

## 📊 Database Schema

### TelegramSession
```sql
- id: UUID
- userId: UUID (Foreign Key)
- sessionId: String (Unique)
- expiresAt: DateTime
- verifiedAt: DateTime (Nullable)
- verifiedChatId: String (Nullable)
- createdAt: DateTime
- updatedAt: DateTime
```

### TelegramWebhookLog
```sql
- id: UUID
- userId: UUID (Foreign Key, Nullable)
- updateId: String (Unique)
- eventType: String
- payload: JSON
- verified: Boolean
- status: String (pending, processed, failed)
- error: String (Nullable)
- processedAt: DateTime (Nullable)
- createdAt: DateTime
```

### User Telegram Fields
```sql
- telegramChatId: String (Unique, Nullable)
- telegramUsername: String (Nullable)
- telegramFirstName: String (Nullable)
- telegramLastName: String (Nullable)
- telegramEnabled: Boolean (Default: true)
- telegramConnectedAt: DateTime (Nullable)
```

## 💬 Messages Templates

استخدام `TelegramMessageTemplates` لإرسال رسائل موحدة:

```typescript
import { TelegramMessageTemplates } from './telegram.templates';

// رسالة الترحيب
const welcome = TelegramMessageTemplates.getWelcomeMessage();

// رسالة الربط الناجح
const success = TelegramMessageTemplates.getSuccessMessage(email);

// تنبيه الدخول
const login = TelegramMessageTemplates.getLoginNotification({
  device: 'Chrome',
  location: 'Cairo, Egypt',
  ip: '192.168.1.1',
  time: new Date().toLocaleString('ar-SA'),
});

// تنبيه محاولات فاشلة
const failed = TelegramMessageTemplates.getFailedLoginNotification({
  attempts: 3,
  location: 'Unknown',
  ip: '192.168.1.100',
});
```

## 🔗 الربط مع Services الأخرى

### AuthService

```typescript
// عند تسجيل دخول جديد
const { user } = await this.authService.login(credentials);

if (user.telegramEnabled && user.telegramChatId) {
  const message = TelegramMessageTemplates.getLoginNotification({
    device: deviceInfo.name,
    location: location,
    ip: ipAddress,
    time: new Date().toLocaleString('ar-SA'),
  });
  
  await this.telegramService.sendMessage({
    chat_id: user.telegramChatId,
    text: message,
    parse_mode: 'HTML',
  });
}
```

### SecurityService

```typescript
// عند اكتشاف محاولات فاشلة
if (failedAttempts >= 3) {
  const message = TelegramMessageTemplates.getFailedLoginNotification({
    attempts: failedAttempts,
    location: location,
    ip: ipAddress,
  });
  
  await this.telegramService.sendSecurityAlert(
    user.telegramChatId,
    'محاولات دخول فاشلة',
    { location, ip: ipAddress }
  );
}
```

## 📈 Monitoring

### عرض الـ Logs

```typescript
// البحث عن Webhook logs
const logs = await prisma.telegramWebhookLog.findMany({
  where: {
    createdAt: {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  },
  orderBy: { createdAt: 'desc' },
});

// البحث عن الأخطاء
const errors = await prisma.telegramWebhookLog.findMany({
  where: { status: 'failed' },
});
```

## ⚙️ Configuration الإنتاج

### إعدادات Bot Father

```
/setcommands

start - بدء ربط الحساب
status - عرض حالة الربط  
help - مساعدة

/setdescription
🤖 بوت Rukny - اشعارات الامان والدخول

/setshortdescription
🔐 تنبيهات الأمان والدخول فوراً
```

### SSL Certificate

```bash
# Telegram يتطلب HTTPS للـ Webhook
# استخدم Let's Encrypt لـ certificate مجاني

certbot certonly --standalone -d your-domain.com
```

## 🐛 Troubleshooting

### المشكلة: Webhook لا يستقبل البيانات

**الحل:**
- تأكد من أن الـ URL صحيح
- تأكد من استخدام HTTPS
- تحقق من firewall settings
- استخدم `setWebhook` لتعيين الـ Webhook من جديد

### المشكلة: Invalid Signature

**الحل:**
- تأكد من البوت Token صحيح
- تأكد من أن payload JSON صحيح
- تحقق من حساب الـ signature

### المشكلة: Telegram Timeout

**الحل:**
- قلل timeout في axios (حالياً 10 ثوانِ)
- تحقق من سرعة الشبكة
- استخدم async/await بشكل صحيح

## 📚 References

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram Webhooks](https://core.telegram.org/bots/api#setwebhook)
- [BotFather](https://t.me/botfather)

## 👨‍💻 Support

للمساعدة أو الإبلاغ عن مشاكل، تواصل مع فريق الدعم.

---

**آخر تحديث:** ديسمبر 2025
