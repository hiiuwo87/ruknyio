import { Response, Request } from 'express';

/**
 * 🔒 Secure Cookie Configuration
 *
 * نظام الأمان (كلا التوكنين في httpOnly Cookies):
 * - Access Token في httpOnly Cookie (30 دقيقة)
 * - Refresh Token في httpOnly Cookie (14 يوم)
 *
 * الحماية:
 * - httpOnly: يمنع XSS من قراءة التوكنات
 * - SameSite=Lax لجميع الكوكيز: دعم OAuth/QuickSign مع حماية CSRF عبر Origin/Referer
 * - CSRF Token إضافي للعمليات الحساسة
 */

// تحديد بيئة العمل
const isProduction = process.env.NODE_ENV === 'production';
// Allow override to force non-secure cookies in local dev if NODE_ENV is mis-set
const cookieSecure = (process.env.COOKIE_SECURE === 'true') || isProduction;

// 🔒 Domain للكوكيز (مهم للـ cross-origin)
// ⚠️ في بيئة التطوير، نستخدم undefined (لا domain) للسماح بمشاركة الكوكيز بين ports مختلفة
// domain: 'localhost' لا يعمل بشكل صحيح مع ports مختلفة في بعض المتصفحات
// (Frontend على 3000، API على 3001)
//
// 🔒 في الإنتاج مع subdomains (مثل auth.rukny.xyz + rukny.xyz):
//    اضبط COOKIE_DOMAIN=rukny.xyz (بدون نقطة في البداية)
//    هذا يسمح لجميع الـ subdomains بمشاركة الكوكيز
//    إذا تركته undefined، الكوكي سيكون host-only على auth.rukny.xyz فقط
const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

// 🔒 Origins المسموحة للـ CSRF validation
// إضافة دعم للشبكة المحلية في بيئة التطوير
// ⚠️ تأكد من إضافة جميع النطاقات المستخدمة (www و non-www)
const ALLOWED_ORIGINS: string[] = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  process.env.FRONTEND_URL_ALT, // e.g. https://www.rukny.xyz if FRONTEND_URL is https://rukny.xyz
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // Local network IPs are handled dynamically in validateCsrfOrigin()
].filter(Boolean) as string[];

// أسماء الكوكيز
// 🔒 نستخدم __Secure- prefix فقط عندما تكون الكوكيز آمنة (secure=true)
export const COOKIE_NAMES = {
  ACCESS_TOKEN: cookieSecure ? '__Secure-access_token' : 'access_token',
  REFRESH_TOKEN: cookieSecure ? '__Secure-refresh_token' : 'refresh_token',
  CSRF_TOKEN: cookieSecure ? '__Secure-csrf_token' : 'csrf_token',
  /** تذكر هذا الجهاز (2FA) - يُستخدم للتحقق من الجهاز الموثوق */
  TRUSTED_DEVICE: cookieSecure ? '__Secure-trusted_device_id' : 'trusted_device_id',
} as const;

// إعدادات الأمان للكوكيز
interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  maxAge: number;
  domain?: string;
}

/**
 * 🔒 تحديد إعدادات SameSite
 * 
 * ⚠️ نستخدم 'lax' بدلاً من 'strict' لأن:
 * - strict يمنع إرسال الكوكي عند العودة من OAuth (Google/LinkedIn)
 * - strict يمنع فتح الروابط من البريد/تطبيقات خارجية
 * 
 * 'lax' يسمح بإرسال الكوكي في:
 * - Top-level navigations (GET requests)
 * - لكن ليس في cross-site POST/iframe/AJAX
 * 
 * الحماية الإضافية:
 * - Origin header validation في /auth/refresh
 * - Rate limiting
 */
const getSameSite = (): 'strict' | 'lax' | 'none' => {
  return 'lax'; // آمن مع OAuth + حماية CSRF إضافية
};

/** نفس صيغة Domain المستخدمة في Set-Cookie (بنقطة في البداية) لضمان مسح الكوكي. */
function getCookieDomainForClear(): string | undefined {
  if (!cookieDomain) return undefined;
  return cookieDomain.startsWith('.') ? cookieDomain : `.${cookieDomain}`;
}

/**
 * 🔒 إعدادات Access Token Cookie
 * 
 * - httpOnly: true → لا يمكن قراءته من JavaScript (XSS protection)
 * - secure: true → HTTPS فقط في الإنتاج
 * - sameSite: lax → حماية CSRF مع دعم OAuth/QuickSign redirects
 * - path: / → متاح لجميع المسارات (الـ proxy يستخدم /api/v1)
 * - صلاحية: 30 دقيقة (يجب أن تطابق JWT expiresIn: '30m' حتى لا يُحذف الكوكي قبل انتهاء التوكن)
 *   وكان 15 دقيقة سابقاً فكان المتصفح يحذف الكوكي بعد 15 دقيقة ويُسجّل المستخدم خروجاً عند أول 401
 *   بينما التمديد التلقائي (proactive refresh) يعمل كل 25 دقيقة.
 */
export const ACCESS_TOKEN_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: 'lax', // 🔒 Lax لدعم OAuth/QuickSign redirects
  path: '/',  // 🔒 متاح لجميع المسارات (للتوافق مع proxy)
  maxAge: 30 * 60 * 1000, // 30 دقيقة - مطابق لـ JWT access token expiry
  ...(cookieDomain && { domain: cookieDomain }),
};

/**
 * 🔒 إعدادات Refresh Token Cookie
 * 
 * - httpOnly: true → لا يمكن قراءته من JavaScript (XSS protection)
 * - secure: true → HTTPS فقط في الإنتاج
 * - sameSite: lax → حماية CSRF مع دعم OAuth redirects
 * - path: '/' دائماً → المتصفح يرسل الكوكي حسب مسار الطلب. الواجهة تستدعي /api/auth/*
 *   (proxy لـ Next.js) وليس /api/v1/auth/*، لذا path=/api/v1/auth يمنع إرسال الكوكي في الإنتاج.
 * - صلاحية: 14 يوم ✅ موحد مع token.service.ts و auth.service.ts (refreshExpiresAt)
 *   ⚠️ يجب أن تتطابق المدة مع DB session expiresAt وإلا ستحصل على 401 رغم وجود الـ cookie
 */
export const REFRESH_TOKEN_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: getSameSite(), // Lax للسماح بـ OAuth
  path: '/',  // 🔒 يجب '/' حتى يُرسل مع /api/auth/refresh (proxy) وليس فقط /api/v1/auth
  maxAge: 14 * 24 * 60 * 60 * 1000, // 14 يوم - ✅ موحد مع DB refreshExpiresAt
  ...(cookieDomain && { domain: cookieDomain }),
};

/**
 * 🔒 إعدادات CSRF Token Cookie (قابل للقراءة من JS)
 * 
 * ⚠️ نستخدم sameSite: 'lax' بدلاً من 'strict' لأن:
 * - strict يمنع إرسال الكوكي عند الـ redirect من API إلى Frontend
 * - الـ CSRF token يحتاج أن يكون متاحاً بعد OAuth/QuickSign redirects
 */
export const CSRF_TOKEN_OPTIONS: Omit<CookieOptions, 'httpOnly'> & { httpOnly: false } = {
  httpOnly: false, // 🔒 يجب أن يكون قابل للقراءة من JS
  secure: cookieSecure,
  sameSite: 'lax', // 🔒 Lax لدعم redirects بين API و Frontend
  path: '/',
  maxAge: 24 * 60 * 60 * 1000, // 24 ساعة
  ...(cookieDomain && { domain: cookieDomain }),
};

/** تذكر هذا الجهاز: صلاحية 30 يوم */
const TRUSTED_DEVICE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
export const TRUSTED_DEVICE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: 'lax',
  path: '/',
  maxAge: TRUSTED_DEVICE_MAX_AGE,
  ...(cookieDomain && { domain: cookieDomain }),
};

/**
 * 🔒 بناء سطر Set-Cookie يدوياً لضمان HttpOnly و Max-Age الصحيحين
 * (تجنب سلوك Express أحياناً مع domain الذي يضع Expires بعيد)
 */
function buildSetCookieHeader(
  name: string,
  value: string,
  opts: CookieOptions,
): string {
  // اسم الكوكي يُرمّز؛ القيمة (JWT/hex) لا تحتاج ترميزاً وتجنباً لمشاكل parsing نتركها كما هي
  const parts = [
    `${encodeURIComponent(name)}=${value}`,
    `Path=${opts.path}`,
    `Max-Age=${Math.floor(opts.maxAge / 1000)}`, // بالثواني
    opts.httpOnly ? 'HttpOnly' : '',
    opts.secure ? 'Secure' : '',
    `SameSite=${opts.sameSite}`,
  ];
  if (opts.domain) {
    const domain = opts.domain.startsWith('.') ? opts.domain : `.${opts.domain}`;
    parts.push(`Domain=${domain}`);
  }
  const header = parts.filter(Boolean).join('; ');

  if (process.env.DEBUG_COOKIES === '1') {
    console.log(`[Cookie] Building Set-Cookie for ${name}:`, {
      domain: opts.domain,
      finalDomain: opts.domain ? (opts.domain.startsWith('.') ? opts.domain : `.${opts.domain}`) : 'none',
      httpOnly: opts.httpOnly,
      secure: opts.secure,
      sameSite: opts.sameSite,
      maxAge: `${Math.floor(opts.maxAge / 1000)}s`,
      headerLength: header.length,
    });
  }

  return header;
}

/**
 * 🔒 إعداد Access Token في httpOnly Cookie (30 دقيقة، HttpOnly)
 */
export function setAccessTokenCookie(res: Response, accessToken: string): void {
  const header = buildSetCookieHeader(
    COOKIE_NAMES.ACCESS_TOKEN,
    accessToken,
    ACCESS_TOKEN_OPTIONS,
  );
  res.append('Set-Cookie', header);
}

/**
 * 🔒 إعداد Refresh Token في httpOnly Cookie (14 يوم، HttpOnly)
 */
export function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  const header = buildSetCookieHeader(
    COOKIE_NAMES.REFRESH_TOKEN,
    refreshToken,
    REFRESH_TOKEN_OPTIONS,
  );
  res.append('Set-Cookie', header);
}

/**
 * 🔒 إعداد CSRF Token (24 ساعة، غير HttpOnly لقراءة الـ frontend)
 */
export function setCsrfTokenCookie(res: Response, csrfToken: string): void {
  const header = buildSetCookieHeader(
    COOKIE_NAMES.CSRF_TOKEN,
    csrfToken,
    CSRF_TOKEN_OPTIONS as CookieOptions,
  );
  res.append('Set-Cookie', header);
}

/**
 * 🔒 إعداد كوكي "تذكر هذا الجهاز" (تحسين تجربة 2FA)
 */
export function setTrustedDeviceCookie(res: Response, deviceId: string): void {
  const header = buildSetCookieHeader(
    COOKIE_NAMES.TRUSTED_DEVICE,
    deviceId,
    TRUSTED_DEVICE_OPTIONS,
  );
  res.append('Set-Cookie', header);
}

/**
 * 🔒 قراءة معرف الجهاز الموثوق من الطلب
 */
export function getTrustedDeviceId(req: Request): string | null {
  const name = COOKIE_NAMES.TRUSTED_DEVICE;
  const raw = req.headers.cookie;
  if (!raw) return null;
  const match = new RegExp(`(?:^|;)\\s*${encodeURIComponent(name)}=([^;]*)`).exec(raw);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

/**
 * 🔒 مسح كوكي الجهاز الموثوق
 */
export function clearTrustedDeviceCookie(res: Response): void {
  const domainOpt = getCookieDomainForClear();
  clearCookieManually(res, COOKIE_NAMES.TRUSTED_DEVICE, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: 'lax',
    path: '/',
    domain: domainOpt,
  });
}

/**
 * 🔒 مسح كوكي واحد باستخدام Set-Cookie مع Max-Age=0
 * هذا أكثر فعالية من clearCookie() الذي قد يفشل بسبب domain/path mismatch
 */
function clearCookieManually(res: Response, name: string, opts: Pick<CookieOptions, 'httpOnly' | 'secure' | 'sameSite' | 'path' | 'domain'>): void {
  const parts = [
    `${encodeURIComponent(name)}=`,
    `Path=${opts.path}`,
    'Max-Age=0', // مسح فوري
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT', // للتوافق مع المتصفحات القديمة
    opts.httpOnly ? 'HttpOnly' : '',
    opts.secure ? 'Secure' : '',
    `SameSite=${opts.sameSite}`,
  ];
  if (opts.domain) {
    const domain = opts.domain.startsWith('.') ? opts.domain : `.${opts.domain}`;
    parts.push(`Domain=${domain}`);
  }
  const header = parts.filter(Boolean).join('; ');

  if (process.env.DEBUG_COOKIES === '1') {
    console.log(`[Cookie] Clearing ${name}:`, {
      domain: opts.domain,
      path: opts.path,
      secure: opts.secure,
    });
  }

  res.append('Set-Cookie', header);
}

/**
 * 🔒 مسح جميع Auth Cookies
 * يستخدم Set-Cookie manual بدلاً من clearCookie لضمان المسح الفعلي
 */
export function clearAuthCookies(res: Response): void {
  const domainOpt = getCookieDomainForClear();
  
  // مسح Access Token
  clearCookieManually(res, COOKIE_NAMES.ACCESS_TOKEN, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: 'lax',
    path: '/',
    domain: domainOpt,
  });
  
  // مسح Refresh Token
  clearCookieManually(res, COOKIE_NAMES.REFRESH_TOKEN, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: getSameSite(),
    path: '/',
    domain: domainOpt,
  });
  
  // مسح CSRF Token
  clearCookieManually(res, COOKIE_NAMES.CSRF_TOKEN, {
    httpOnly: false,
    secure: cookieSecure,
    sameSite: 'lax',
    path: '/',
    domain: domainOpt,
  });

  // مسح Trusted Device (2FA) حتى يُطلب التحقق في الدخول التالي إن وُجد
  clearCookieManually(res, COOKIE_NAMES.TRUSTED_DEVICE, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: 'lax',
    path: '/',
    domain: domainOpt,
  });
}

/**
 * 🔒 مسح Refresh Token Cookie فقط
 */
export function clearRefreshTokenCookie(res: Response): void {
  const domainOpt = getCookieDomainForClear();
  clearCookieManually(res, COOKIE_NAMES.REFRESH_TOKEN, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: getSameSite(),
    path: '/',
    domain: domainOpt,
  });
}

/**
 * 🔒 استخراج Access Token من Cookie أو Authorization Header
 * 
 * الأولوية:
 * 1. Cookie (الأكثر أماناً)
 * 2. Authorization Header (للتوافق مع mobile apps/APIs)
 */
export function extractAccessToken(req: Request): string | null {
  // أولاً: من الـ Cookie
  const cookieToken = req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN];
  if (cookieToken) {
    return cookieToken;
  }
  
  // ثانياً: من Authorization Header (fallback)
  const authHeader = req.headers?.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

/**
 * استخراج Refresh Token من Cookie
 */
export function extractRefreshToken(req: Request): string | null {
  return req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] || null;
}

/**
 * استخراج CSRF Token من Header
 */
export function extractCsrfToken(req: Request): string | null {
  return req.headers?.['x-csrf-token'] as string || null;
}

/**
 * التحقق من وجود tokens صالحة
 */
export function hasAuthTokens(req: Request): { 
  hasAccessToken: boolean; 
  hasRefreshToken: boolean;
  hasCsrfToken: boolean;
} {
  return {
    hasAccessToken: !!extractAccessToken(req),
    hasRefreshToken: !!extractRefreshToken(req),
    hasCsrfToken: !!extractCsrfToken(req),
  };
}

/**
 * 🔒 توليد CSRF Token مرتبط بـ Session
 * يربط الـ CSRF token بـ sessionId للحماية الإضافية
 * @param sessionId - معرف الجلسة (اختياري - إذا لم يُمرر يُولد token عشوائي)
 */
export function generateCsrfToken(sessionId?: string): string {
  const crypto = require('crypto');
  const randomPart = crypto.randomBytes(16).toString('hex');
  
  if (sessionId) {
    // 🔒 ربط CSRF بـ sessionId باستخدام HMAC
    const secret = process.env.JWT_SECRET || 'csrf-secret-key';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${sessionId}:${randomPart}`);
    const signature = hmac.digest('hex').substring(0, 16);
    return `${randomPart}.${signature}`;
  }
  
  // Fallback: token عشوائي بدون ربط
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 🔒 التحقق من CSRF Token
 */
export function validateCsrfToken(req: Request): { valid: boolean; reason?: string } {
  const headerToken = extractCsrfToken(req);
  const cookieToken = req.cookies?.[COOKIE_NAMES.CSRF_TOKEN];
  
  if (!headerToken) {
    return { valid: false, reason: 'Missing CSRF token in header' };
  }
  
  if (!cookieToken) {
    return { valid: false, reason: 'Missing CSRF token in cookie' };
  }
  
  if (headerToken !== cookieToken) {
    return { valid: false, reason: 'CSRF token mismatch' };
  }
  
  return { valid: true };
}

/**
 * 🔒 CSRF Protection للـ Refresh Endpoint
 * 
 * بما أننا نستخدم SameSite=Lax (لدعم OAuth)،
 * نحتاج حماية إضافية للـ POST requests مثل /auth/refresh
 * 
 * نتحقق من:
 * 1. Origin header يطابق FRONTEND_URL
 * 2. أو Referer header من نفس الـ domain
 */
export function validateCsrfOrigin(req: Request): { valid: boolean; reason?: string } {
  const origin = req.headers?.origin;
  const referer = req.headers?.referer;

  // Helper function to check if origin is a local network IP
  const isLocalNetworkOrigin = (url: string | undefined): boolean => {
    if (!url) return false;
    return (
      url.includes('localhost') || 
      url.includes('127.0.0.1') ||
      /^https?:\/\/192\.168\.\d+\.\d+/.test(url) ||
      /^https?:\/\/10\.\d+\.\d+\.\d+/.test(url) ||
      /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/.test(url)
    );
  };

  // 🔒 في Development، نسمح بأي origin محلي (localhost + local network IPs)
  if (!isProduction) {
    if (!origin && !referer) {
      return { valid: true }; // Postman, curl, etc.
    }
    if (isLocalNetworkOrigin(origin)) {
      return { valid: true };
    }
    if (isLocalNetworkOrigin(referer)) {
      return { valid: true };
    }
  }

  // 🔒 في Production، نتحقق من Origin
  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin)) {
      return { valid: true };
    }
    return { valid: false, reason: `Invalid origin: ${origin}` };
  }

  // 🔒 Fallback إلى Referer (مع حماية من referer غير صالح)
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (ALLOWED_ORIGINS.includes(refererOrigin)) {
        return { valid: true };
      }
      return { valid: false, reason: `Invalid referer: ${referer}` };
    } catch {
      return { valid: false, reason: 'Invalid referer format' };
    }
  }

  // 🔒 لا يوجد Origin أو Referer - نرفض في Production
  if (isProduction) {
    return { valid: false, reason: 'Missing origin header' };
  }

  return { valid: true };
}

/**
 * 🔒 قائمة Origins المسموحة (للتصدير)
 */
export function getAllowedOrigins(): string[] {
  return [...ALLOWED_ORIGINS];
}
