/**
 * Brand icon utility using simple-icons for real SVG logos.
 *
 * For known platforms → returns inline SVG path + official brand color.
 * For unknown domains → falls back to Google Favicon service.
 */

import {
  siInstagram,
  siTiktok,
  siYoutube,
  siGithub,
  siWhatsapp,
  siX,
  siSnapchat,
  siTelegram,
  siThreads,
  siFacebook,
  siPinterest,
  siSpotify,
  siTwitch,
  siReddit,
  siDiscord,
  siPaypal,
  siMedium,
  siBehance,
  siDribbble,
  siGmail,
  siApplepodcasts,
  siSoundcloud,
  siVimeo,
  siFlickr,
  siTumblr,
  siMastodon,
  siPatreon,
  siFigma,
  siNotion,
  siGumroad,
  siSubstack,
  siShopify,
  siEtsy,
  siCalendly,
  siZoom,
  siLine,
  siSignal,
  siViber,
  siWechat,
} from 'simple-icons';
import type { SimpleIcon } from 'simple-icons';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface BrandInfo {
  title: string;
  slug: string;
  /** Hex color WITHOUT #, e.g. "FF0069" */
  hex: string;
  /** Full SVG markup (24×24 viewBox) */
  svg: string;
  /** The raw 'd' attribute value from the SVG path */
  path: string;
}

/* ------------------------------------------------------------------ */
/*  Platform registry                                                  */
/* ------------------------------------------------------------------ */

/** Map of domain keywords → simple-icons object */
const platformRegistry: Record<string, SimpleIcon> = {
  instagram: siInstagram,
  tiktok: siTiktok,
  youtube: siYoutube,
  youtu: siYoutube,
  github: siGithub,
  whatsapp: siWhatsapp,
  'wa.me': siWhatsapp,
  x: siX,
  twitter: siX,
  snapchat: siSnapchat,
  telegram: siTelegram,
  't.me': siTelegram,
  threads: siThreads,
  facebook: siFacebook,
  'fb.com': siFacebook,
  pinterest: siPinterest,
  spotify: siSpotify,
  twitch: siTwitch,
  reddit: siReddit,
  discord: siDiscord,
  paypal: siPaypal,
  medium: siMedium,
  behance: siBehance,
  dribbble: siDribbble,
  gmail: siGmail,
  podcasts: siApplepodcasts,
  soundcloud: siSoundcloud,
  vimeo: siVimeo,
  flickr: siFlickr,
  tumblr: siTumblr,
  mastodon: siMastodon,
  patreon: siPatreon,
  figma: siFigma,
  notion: siNotion,
  gumroad: siGumroad,
  substack: siSubstack,
  shopify: siShopify,
  etsy: siEtsy,
  calendly: siCalendly,
  zoom: siZoom,
  line: siLine,
  signal: siSignal,
  viber: siViber,
  wechat: siWechat,
};

/** Local icons from public/icons (used as first-priority source). */
const localIconRegistry: Record<string, string> = {
  instagram: '/icons/instagram.svg',
  youtube: '/icons/youtube.svg',
  snapchat: '/icons/snapchat.svg',
  linkedin: '/icons/linkedin.svg',
  notion: '/icons/notion.svg',
  shopify: '/icons/shopify.svg',
  telegram: '/icons/telegram.svg',
  whatsapp: '/icons/whatsapp.svg',
  x: '/icons/x.svg',
  zoom: '/icons/zoom.svg',
  gmail: '/icons/gmail.svg',
  google: '/icons/google.svg',
  'google-calendar': '/icons/google-calendar.svg',
  'google-analytics': '/icons/google-analytics.svg',
  'aws-s3': '/icons/aws-s3.svg',
};

const keyAliases: Record<string, string> = {
  twitter: 'x',
  'wa.me': 'whatsapp',
  't.me': 'telegram',
};

/** Domain patterns → registry key (for URL matching) */
const domainToKey: [RegExp, string][] = [
  [/instagram\.com/, 'instagram'],
  [/tiktok\.com/, 'tiktok'],
  [/youtube\.com|youtu\.be/, 'youtube'],
  [/github\.com/, 'github'],
  [/whatsapp\.com|wa\.me/, 'whatsapp'],
  [/x\.com|twitter\.com/, 'x'],
  [/snapchat\.com/, 'snapchat'],
  [/telegram\.org|t\.me/, 'telegram'],
  [/threads\.net/, 'threads'],
  [/facebook\.com|fb\.com/, 'facebook'],
  [/pinterest\.com/, 'pinterest'],
  [/spotify\.com/, 'spotify'],
  [/twitch\.tv/, 'twitch'],
  [/reddit\.com/, 'reddit'],
  [/discord\.com|discord\.gg/, 'discord'],
  [/paypal\.com|paypal\.me/, 'paypal'],
  [/medium\.com/, 'medium'],
  [/behance\.net/, 'behance'],
  [/dribbble\.com/, 'dribbble'],
  [/gmail\.com/, 'gmail'],
  [/podcasts\.apple\.com/, 'podcasts'],
  [/soundcloud\.com/, 'soundcloud'],
  [/vimeo\.com/, 'vimeo'],
  [/flickr\.com/, 'flickr'],
  [/tumblr\.com/, 'tumblr'],
  [/mastodon\./, 'mastodon'],
  [/patreon\.com/, 'patreon'],
  [/figma\.com/, 'figma'],
  [/notion\.so|notion\.com/, 'notion'],
  [/gumroad\.com/, 'gumroad'],
  [/substack\.com/, 'substack'],
  [/shopify\.com|myshopify\.com/, 'shopify'],
  [/etsy\.com/, 'etsy'],
  [/calendly\.com/, 'calendly'],
  [/zoom\.us/, 'zoom'],
  [/line\.me/, 'line'],
  [/signal\.org/, 'signal'],
  [/viber\.com/, 'viber'],
  [/wechat\.com|weixin\.qq\.com/, 'wechat'],
];

/** Domain patterns used for local-only platform keys. */
const localDomainToKey: [RegExp, string][] = [
  [/linkedin\.com/, 'linkedin'],
  [/google\.com/, 'google'],
  [/calendar\.google\.com/, 'google-calendar'],
  [/analytics\.google\.com/, 'google-analytics'],
  [/s3\.[a-z0-9-]+\.amazonaws\.com|amazonaws\.com/, 'aws-s3'],
];

/* ------------------------------------------------------------------ */
/*  Helper: extract SVG path from full SVG                             */
/* ------------------------------------------------------------------ */

function extractPath(svg: string): string {
  // simple-icons SVGs contain <path d="..."/> — extract everything inside <svg>
  const match = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  return match?.[1]?.replace(/<title>[^<]*<\/title>/, '').trim() ?? '';
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Get brand info by platform key (e.g. "instagram", "tiktok").
 * Returns `null` if not found.
 */
export function getBrandByKey(key: string): BrandInfo | null {
  const normalized = keyAliases[key.toLowerCase()] ?? key.toLowerCase();
  const icon = platformRegistry[normalized];
  if (!icon) return null;
  return {
    title: icon.title,
    slug: icon.slug,
    hex: icon.hex,
    svg: icon.svg,
    path: icon.path,
  };
}

/**
 * Get local icon path by platform key.
 */
export function getLocalIconPathByKey(key: string): string | null {
  const normalized = keyAliases[key.toLowerCase()] ?? key.toLowerCase();
  return localIconRegistry[normalized] ?? null;
}

/**
 * Detect platform key from URL.
 * This includes simple-icons keys and local-only keys.
 */
export function detectPlatformKeyFromUrl(url: string): string | null {
  const lower = url.toLowerCase();
  for (const [pattern, key] of domainToKey) {
    if (pattern.test(lower)) {
      return key;
    }
  }
  for (const [pattern, key] of localDomainToKey) {
    if (pattern.test(lower)) {
      return key;
    }
  }
  return null;
}

/**
 * Detect the platform from a URL and return brand info.
 * Returns `null` if the domain doesn't match any known platform.
 */
export function detectBrandFromUrl(url: string): BrandInfo | null {
  const key = detectPlatformKeyFromUrl(url);
  if (!key) return null;
  return getBrandByKey(key);
}

/**
 * Extract domain from a URL string.
 */
export function extractDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname;
  } catch {
    return null;
  }
}

/**
 * Google Favicon URL for unknown domains.
 * Returns a 128px PNG favicon.
 */
export function getFaviconUrl(domain: string, size = 128): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

/**
 * All registered platform keys for listing in the dialog.
 */
export function getAllPlatformKeys(): string[] {
  return Object.keys(platformRegistry);
}
