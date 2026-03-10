import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function convertBigIntAndDecimal(value: any, visited = new WeakSet()): any {
  if (value === null || value === undefined) return value;

  // Primitives
  const t = typeof value;
  if (t === 'bigint') {
    try {
      const n = Number(value);
      // If out of safe range, return string representation
      if (!Number.isSafeInteger(n)) return value.toString();
      return n;
    } catch {
      return value.toString();
    }
  }
  if (t !== 'object') return value;

  // Handle Prisma Decimal (duck-type; avoids @prisma/client/runtime/library import)
  if (
    value &&
    typeof value.toNumber === 'function' &&
    value.constructor?.name === 'Decimal'
  ) {
    try {
      return value.toNumber();
    } catch {
      return parseFloat(value.toString()) || 0;
    }
  }

  // Avoid circular recursion
  if (visited.has(value)) return value;
  visited.add(value);

  // Arrays
  if (Array.isArray(value)) {
    return value.map((v) => convertBigIntAndDecimal(v, visited));
  }

  // Preserve special objects
  if (value instanceof Date) return value;
  if (Buffer.isBuffer && Buffer.isBuffer(value)) return value;
  if (value instanceof Map)
    return Array.from(value.entries()).map(([k, v]) => [
      k,
      convertBigIntAndDecimal(v, visited),
    ]);
  if (value instanceof Set)
    return Array.from(value).map((v) => convertBigIntAndDecimal(v, visited));

  // Plain objects
  const out: any = {};
  for (const key of Object.keys(value)) {
    try {
      out[key] = convertBigIntAndDecimal(value[key], visited);
    } catch {
      out[key] = value[key];
    }
  }
  return out;
}

@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => convertBigIntAndDecimal(data)));
  }
}
