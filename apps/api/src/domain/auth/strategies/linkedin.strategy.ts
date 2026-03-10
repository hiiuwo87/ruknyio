import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

/**
 * 🔒 LinkedIn OAuth Strategy
 *
 * تحسينات أمنية:
 * - التحقق من email_verified من LinkedIn
 * - استخدام LinkedIn ID للتحقق من الهوية
 */
@Injectable()
export class LinkedInStrategy extends PassportStrategy(
  OAuth2Strategy,
  'linkedin',
) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    // LinkedIn OpenID Connect scopes (new API)
    const scopeString = (
      configService.get<string>('LINKEDIN_SCOPES') || 'openid,profile,email'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' ');

    super({
      authorizationURL: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenURL: 'https://www.linkedin.com/oauth/v2/accessToken',
      clientID: configService.get<string>('LINKEDIN_CLIENT_ID'),
      clientSecret: configService.get<string>('LINKEDIN_CLIENT_SECRET'),
      callbackURL: configService.get<string>('LINKEDIN_CALLBACK_URL'),
      scope: scopeString,
      state: false, // Session not used - CSRF protection handled by SameSite cookies + CORS
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: any,
  ): Promise<any> {
    try {
      // Fetch user info from LinkedIn OpenID Connect userinfo endpoint
      const response = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user profile: ${response.statusText}`);
      }

      const userInfo = await response.json();

      // 🔒 التحقق من وجود البريد الإلكتروني
      if (!userInfo.email) {
        return done(
          new UnauthorizedException(
            'لا يوجد بريد إلكتروني مرتبط بحساب LinkedIn',
          ),
          null,
        );
      }

      // 🔒 التحقق من email_verified من LinkedIn
      // LinkedIn يوفر هذه المعلومة عبر OpenID Connect
      if (userInfo.email_verified === false) {
        return done(
          new UnauthorizedException(
            'البريد الإلكتروني غير مُتحقق منه في LinkedIn',
          ),
          null,
        );
      }

      const user = {
        linkedinId: userInfo.sub,
        email: userInfo.email,
        emailVerified: userInfo.email_verified !== false, // 🔒 استخدام حالة التحقق من LinkedIn
        name:
          userInfo.name ||
          `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim(),
        avatar: userInfo.picture || null,
        accessToken,
        refreshToken,
      };

      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }
}
