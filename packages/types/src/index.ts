/**
 * @rukny/types
 * 
 * Shared TypeScript types for the Rukny.io monorepo.
 * These types are used across both frontend (Next.js) and backend (NestJS).
 * 
 * @example
 * ```typescript
 * import { User, Event, ApiResponse } from '@rukny/types';
 * 
 * const user: User = { ... };
 * const response: ApiResponse<User> = { success: true, data: user };
 * ```
 */

// API types
export * from './api';

// User types
export * from './user';

// Event types
export * from './event';

// Store/E-commerce types
export * from './store';

// Form builder types
export * from './form';

// Form theme types (legacy) - exclude FormTheme to avoid conflict with ./form
export {
  type FormThemeColors,
  type FormThemeTypography,
  type FormThemeLayout,
  type FormThemeAdvanced,
  type CardStyle,
  type BorderRadius,
  type Shadow,
  type Spacing,
  type MaxWidth,
  type BackgroundType,
  type FormThemeTemplate,
  DEFAULT_FORM_THEME,
  ARABIC_FONTS,
  FORM_THEME_TEMPLATES,
} from './form-theme';
