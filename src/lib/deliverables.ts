import { Platform } from '@/types';

export interface DeliverableLinks {
  instagramLink: string | null;
  tiktokLink: string | null;
  primaryLink: string | null;
  platform: Platform | null;
  isBoth: boolean;
}

/**
 * Normalizes an Instagram or TikTok URL
 */
function cleanUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  return trimmed !== '' ? trimmed : null;
}

/**
 * Detects if a URL is an Instagram post/reel
 */
export function isInstagramUrl(url: string): boolean {
  return /(?:instagram\.com|instagr\.am)\/(?:p|reel|tv|reels)\//i.test(url) ||
    /(?:instagram\.com|instagr\.am)/i.test(url);
}

/**
 * Detects if a URL is a TikTok video
 */
export function isTikTokUrl(url: string): boolean {
  return /(?:tiktok\.com|vm\.tiktok\.com)/i.test(url);
}

/**
 * Parses raw link string (which could be a JSON object, comma/newline separated URLs, or a single URL)
 * and returns structured Instagram, TikTok, and primary URLs.
 */
export function parseDeliverableLinks(
  rawLink: string | null | undefined,
  existingPlatform?: string | null
): DeliverableLinks {
  if (!rawLink || !rawLink.trim()) {
    const isExplicitBoth = existingPlatform === 'both';
    return {
      instagramLink: null,
      tiktokLink: null,
      primaryLink: null,
      platform: isExplicitBoth ? 'both' : (existingPlatform as Platform) || null,
      isBoth: isExplicitBoth,
    };
  }

  const trimmed = rawLink.trim();

  // 1. Check if rawLink is JSON
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const ig = cleanUrl(parsed.instagram || parsed.instagramLink || parsed.ig);
      const tt = cleanUrl(parsed.tiktok || parsed.tiktokLink || parsed.tt);
      const single = cleanUrl(parsed.link || parsed.url || parsed.primary);
      const hasBoth = Boolean((ig && tt) || parsed.platform === 'both');

      let resolvedPlatform: Platform | null = null;
      if (hasBoth) {
        resolvedPlatform = 'both';
      } else if (ig) {
        resolvedPlatform = 'instagram';
      } else if (tt) {
        resolvedPlatform = 'tiktok';
      } else if (parsed.platform) {
        resolvedPlatform = parsed.platform as Platform;
      } else if (existingPlatform) {
        resolvedPlatform = existingPlatform as Platform;
      }

      return {
        instagramLink: ig,
        tiktokLink: tt,
        primaryLink: ig || tt || single || null,
        platform: resolvedPlatform,
        isBoth: hasBoth,
      };
    } catch {
      // fallback to text parsing
    }
  }

  // 2. Check if multiple URLs separated by newline, comma, or space
  const urls = trimmed
    .split(/[\r\n,\s]+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//i.test(u));

  if (urls.length > 1) {
    let ig: string | null = null;
    let tt: string | null = null;

    for (const u of urls) {
      if (!ig && isInstagramUrl(u)) {
        ig = u;
      } else if (!tt && isTikTokUrl(u)) {
        tt = u;
      }
    }

    const hasBoth = Boolean(ig && tt);
    return {
      instagramLink: ig,
      tiktokLink: tt,
      primaryLink: ig || tt || urls[0],
      platform: hasBoth ? 'both' : ig ? 'instagram' : tt ? 'tiktok' : (existingPlatform as Platform) || null,
      isBoth: hasBoth,
    };
  }

  // 3. Single URL
  const single = cleanUrl(trimmed);
  if (!single) {
    return {
      instagramLink: null,
      tiktokLink: null,
      primaryLink: null,
      platform: (existingPlatform as Platform) || null,
      isBoth: false,
    };
  }

  const isIg = isInstagramUrl(single);
  const isTt = isTikTokUrl(single);

  return {
    instagramLink: isIg ? single : null,
    tiktokLink: isTt ? single : null,
    primaryLink: single,
    platform: (existingPlatform === 'both' ? 'both' : isIg ? 'instagram' : isTt ? 'tiktok' : (existingPlatform as Platform) || null),
    isBoth: existingPlatform === 'both',
  };
}

/**
 * Serializes deliverable links into standard storage format.
 * - If both Instagram and TikTok exist (or platform is explicitly 'both'): returns JSON string
 * - If only one link exists and platform is not 'both': returns plain URL
 * - If empty: returns null
 */
export function serializeDeliverableLinks(input: {
  instagramLink?: string | null;
  tiktokLink?: string | null;
  link?: string | null;
  platform?: Platform | string | null;
}): string | null {
  const ig = cleanUrl(input.instagramLink);
  const tt = cleanUrl(input.tiktokLink);
  const fallback = cleanUrl(input.link);

  // If fallback is provided and contains JSON or both URLs, parse it first
  if (!ig && !tt && fallback) {
    const parsed = parseDeliverableLinks(fallback, input.platform);
    if (parsed.isBoth || (parsed.instagramLink && parsed.tiktokLink)) {
      return JSON.stringify({
        platform: 'both',
        instagram: parsed.instagramLink,
        tiktok: parsed.tiktokLink,
      });
    }
    if (input.platform === 'both') {
      return JSON.stringify({
        platform: 'both',
        instagram: parsed.instagramLink || fallback,
        tiktok: parsed.tiktokLink || null,
      });
    }
    return parsed.primaryLink || fallback;
  }

  if (input.platform === 'both' || (ig && tt)) {
    return JSON.stringify({
      platform: 'both',
      instagram: ig,
      tiktok: tt,
    });
  }

  if (ig) return ig;
  if (tt) return tt;
  return fallback;
}
