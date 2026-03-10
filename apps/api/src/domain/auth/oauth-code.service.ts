import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

type CodePayload = {
  access_token: string;
  refresh_token: string; // ✅ أضفنا refresh_token
  user: {
    id: string;
    name: string;
    email: string;
    role?: any;
    avatar?: string | null;
  };
  needsProfileCompletion?: boolean;
};

interface CodeRecord extends CodePayload {
  expiresAt: number; // epoch ms
  used: boolean;
}

@Injectable()
export class OAuthCodeService {
  private store = new Map<string, CodeRecord>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  generate(payload: CodePayload): string {
    const code = this.randomCode();
    const record: CodeRecord = {
      ...payload,
      expiresAt: Date.now() + this.TTL_MS,
      used: false,
    };
    this.store.set(code, record);
    return code;
  }

  exchange(code: string): CodePayload {
    const record = this.store.get(code);
    if (!record) {
      throw new BadRequestException('Invalid code');
    }

    if (record.used) {
      this.store.delete(code);
      throw new BadRequestException('Code already used');
    }

    if (Date.now() > record.expiresAt) {
      this.store.delete(code);
      throw new BadRequestException('Code expired');
    }

    // mark used and delete to enforce single-use
    record.used = true;
    this.store.delete(code);
    return {
      access_token: record.access_token,
      refresh_token: record.refresh_token, // ✅ أضفنا refresh_token
      user: record.user,
      needsProfileCompletion: record.needsProfileCompletion,
    };
  }

  private randomCode(): string {
    // 32 bytes = 64 hex chars; safe for URL
    return crypto.randomBytes(32).toString('hex');
  }
}
