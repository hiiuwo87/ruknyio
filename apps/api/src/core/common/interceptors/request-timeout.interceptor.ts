import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  RequestTimeoutException,
  Logger,
} from '@nestjs/common';
import { Observable, throwError, timeout } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { QUERY_TIMEOUTS } from '../../database/database.constants';

/**
 * ⏱️ Request Timeout Interceptor
 * Prevents long-running requests from causing "request aborted" errors
 * by implementing progressive timeouts based on endpoint patterns
 */
@Injectable()
export class RequestTimeoutInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestTimeoutInterceptor.name);

  /**
   * Determine timeout based on request path
   * Different endpoints have different timeout requirements
   */
  private getTimeoutForEndpoint(path: string): number {
    // Image processing and file uploads need more time
    if (path.includes('/upload') || path.includes('/image') || path.includes('/cover')) {
      return QUERY_TIMEOUTS.IMAGE_PROCESSING + 5000; // 35 seconds
    }

    // Form creation with images
    if (path.includes('/forms') && path.includes('POST')) {
      return QUERY_TIMEOUTS.IMAGE_PROCESSING + 10000; // 40 seconds
    }

    // Reports and exports
    if (path.includes('/export') || path.includes('/report')) {
      return QUERY_TIMEOUTS.REPORT;
    }

    // Complex queries (analytics, aggregations)
    if (path.includes('/analytics') || path.includes('/stats')) {
      return QUERY_TIMEOUTS.COMPLEX;
    }

    // Default timeout for standard CRUD operations
    return QUERY_TIMEOUTS.DEFAULT;
  }

  intercept(context: ExecutionContext, next): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, path } = request;
    
    const timeoutMs = this.getTimeoutForEndpoint(path);
    
    this.logger.debug(
      `Request timeout set to ${timeoutMs}ms for ${method} ${path}`,
    );

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((err) => {
        if (err.name === 'TimeoutError') {
          this.logger.error(
            `Request timeout (${timeoutMs}ms) for ${method} ${path}`,
          );
          return throwError(
            () =>
              new RequestTimeoutException(
                `Request timeout. The operation took too long to complete. Please try again.`,
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
