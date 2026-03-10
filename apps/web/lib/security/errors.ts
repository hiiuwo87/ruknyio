/**
 * 🔐 Error Classification & Handling
 * 
 * Classifies API errors and determines whether they're safe to show users
 * or should be logged as internal errors
 */

export enum ErrorType {
  // User-facing errors (safe to show to client)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  CONFLICT = 'CONFLICT',
  
  // Internal errors (log only, don't expose details)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
}

export interface ClassifiedError {
  type: ErrorType;
  message: string;
  userMessage: string; // Safe to show to user
  statusCode?: number;
  details?: Record<string, unknown>;
}

/**
 * Classify HTTP status codes
 */
function classifyStatusCode(status: number): ErrorType {
  if (status >= 400 && status < 500) {
    switch (status) {
      case 400:
        return ErrorType.VALIDATION_ERROR;
      case 401:
        return ErrorType.AUTHENTICATION_ERROR;
      case 403:
        return ErrorType.AUTHORIZATION_ERROR;
      case 404:
        return ErrorType.NOT_FOUND;
      case 409:
        return ErrorType.CONFLICT;
      case 429:
        return ErrorType.RATE_LIMITED;
      default:
        return ErrorType.VALIDATION_ERROR;
    }
  }

  if (status >= 500 && status < 600) {
    switch (status) {
      case 503:
        return ErrorType.SERVICE_UNAVAILABLE;
      default:
        return ErrorType.INTERNAL_SERVER_ERROR;
    }
  }

  return ErrorType.UNKNOWN_ERROR;
}

/**
 * Get user-safe error message
 */
function getUserMessage(type: ErrorType, status?: number): string {
  switch (type) {
    case ErrorType.VALIDATION_ERROR:
      return 'يرجى التحقق من المدخلات والمحاولة مرة أخرى';
    case ErrorType.AUTHENTICATION_ERROR:
      return 'انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى';
    case ErrorType.AUTHORIZATION_ERROR:
      return 'ليس لديك صلاحيات كافية للقيام بهذا الإجراء';
    case ErrorType.NOT_FOUND:
      return 'لم يتم العثور على المورد المطلوب';
    case ErrorType.CONFLICT:
      return 'هذا العنصر موجود بالفعل';
    case ErrorType.RATE_LIMITED:
      return 'حاولت عدد مرات كبيرة جداً. يرجى الانتظار قليلاً والمحاولة مرة أخرى';
    case ErrorType.SERVICE_UNAVAILABLE:
      return 'الخدمة غير متاحة حالياً. يرجى المحاولة لاحقاً';
    case ErrorType.NETWORK_ERROR:
      return 'فشل الاتصال بالخادم. تحقق من اتصالك بالإنترنت';
    case ErrorType.TIMEOUT_ERROR:
      return 'انتهت مهلة الانتظار. يرجى المحاولة مرة أخرى';
    case ErrorType.INTERNAL_SERVER_ERROR:
      return 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً أو الاتصال بدعم العملاء';
    default:
      return 'حدث خطأ. يرجى المحاولة مرة أخرى';
  }
}

/**
 * Classify an API error
 */
export function classifyError(
  error: unknown,
  statusCode?: number
): ClassifiedError {
  // Network errors
  if (error instanceof TypeError) {
    if (error.message.includes('fetch')) {
      return {
        type: ErrorType.NETWORK_ERROR,
        message: error.message,
        userMessage: getUserMessage(ErrorType.NETWORK_ERROR),
      };
    }
  }

  // Timeout errors
  if (error instanceof Error && error.name === 'AbortError') {
    return {
      type: ErrorType.TIMEOUT_ERROR,
      message: error.message,
      userMessage: getUserMessage(ErrorType.TIMEOUT_ERROR),
    };
  }

  // HTTP status code errors
  if (statusCode) {
    const type = classifyStatusCode(statusCode);
    let message = 'API Error';

    if (error && typeof error === 'object') {
      const err = error as Record<string, unknown>;
      if (typeof err.message === 'string') {
        message = err.message;
      }
    }

    return {
      type,
      message,
      userMessage: getUserMessage(type, statusCode),
      statusCode,
      details: error && typeof error === 'object' ? (error as Record<string, unknown>) : undefined,
    };
  }

  // Unknown errors
  return {
    type: ErrorType.UNKNOWN_ERROR,
    message: error instanceof Error ? error.message : String(error),
    userMessage: getUserMessage(ErrorType.UNKNOWN_ERROR),
  };
}

/**
 * Should this error be exposed to the user?
 */
export function shouldExposeTouUser(type: ErrorType): boolean {
  const userFacingErrors = [
    ErrorType.VALIDATION_ERROR,
    ErrorType.AUTHENTICATION_ERROR,
    ErrorType.AUTHORIZATION_ERROR,
    ErrorType.NOT_FOUND,
    ErrorType.RATE_LIMITED,
    ErrorType.CONFLICT,
    ErrorType.NETWORK_ERROR,
    ErrorType.TIMEOUT_ERROR,
  ];

  return userFacingErrors.includes(type);
}

/**
 * Log error with appropriate severity
 */
export function logError(classified: ClassifiedError): void {
  const isUserFacing = shouldExposeTouUser(classified.type);

  if (isUserFacing) {
    console.warn(`[${classified.type}] ${classified.message}`);
  } else {
    // Log internal errors with full details for debugging
    console.error(`[${classified.type}] ${classified.message}`, classified.details);
  }
}
