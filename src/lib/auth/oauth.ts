/**
 * Galuxium Nexus V2: OAuth Redirect & Provider Configuration
 */

/**
 * Resolves the exact OAuth redirect URI based on current execution environment
 * Handles local dev, dynamic Vercel branch previews, and production domains.
 */
export function getOAuthRedirectUrl(nextPath = '/dashboard'): string {
  let siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview' && process.env.NEXT_PUBLIC_VERCEL_URL) {
    siteUrl = `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  } else if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'production') {
    siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://galuxium-nexus-v2.vercel.app';
  }

  // Ensure trailing slash removed
  siteUrl = siteUrl.replace(/\/$/, '');
  return `${siteUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

export const OAUTH_SCOPES = {
  google: 'email profile openid',
};
