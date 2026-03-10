'use client';

/**
 * 🔐 Auth Callback Page
 *
 * Thin client wrapper that renders the full client-only callback logic
 * from `ClientCallback`. Marked as dynamic to avoid static prerendering.
 */

export const dynamic = 'force-dynamic';

import AuthCallbackClient from './ClientCallback';

export default function AuthCallbackPage() {
  return <AuthCallbackClient />;
}


