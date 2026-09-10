import { InspirationFormat, InspirationIdea, InspirationPlatform } from '@/types';

/**
 * Detects the social platform from a reel or video URL.
 */
export function detectVideoPlatform(url: string): InspirationPlatform {
  if (!url || typeof url !== 'string') return 'other';
  const clean = url.trim().toLowerCase();
  if (clean.includes('instagram.com') || clean.includes('instagr.am')) {
    return 'instagram';
  }
  if (clean.includes('tiktok.com')) {
    return 'tiktok';
  }
  if (clean.includes('youtube.com') || clean.includes('youtu.be')) {
    return 'youtube';
  }
  if (clean.includes('facebook.com') || clean.includes('fb.watch')) {
    return 'facebook';
  }
  return 'other';
}

/**
 * Detects default format (reel or video) based on URL.
 */
export function detectVideoFormat(url: string): InspirationFormat {
  if (!url || typeof url !== 'string') return 'reel';
  const clean = url.trim().toLowerCase();
  if (clean.includes('/reel') || clean.includes('/reels/') || clean.includes('/shorts/') || clean.includes('tiktok.com')) {
    return 'reel';
  }
  return 'video';
}

/**
 * Cleans tracking params from reel/video URL for clean display.
 */
export function cleanVideoUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    // Strip social media trackers
    ['igsh', 'utm_source', 'utm_medium', 'utm_campaign', 'share_id', '_r', 'is_from_webapp', 'sender_device'].forEach(
      (param) => parsed.searchParams.delete(param)
    );
    const query = parsed.searchParams.toString();
    return `${parsed.origin}${parsed.pathname}${query ? `?${query}` : ''}`;
  } catch {
    return trimmed;
  }
}

/**
 * Extracts inspiration ideas encoded in client tags.
 * Tags format: "inspo:<base64-json>" or "inspo:<json>"
 */
export function extractClientInspirations(tags: string[] = []): InspirationIdea[] {
  const result: InspirationIdea[] = [];
  if (!Array.isArray(tags)) return result;

  for (const tag of tags) {
    if (typeof tag !== 'string' || !tag.startsWith('inspo:')) continue;
    try {
      const payload = tag.slice('inspo:'.length);
      let jsonStr = payload;
      if (!payload.startsWith('{')) {
        // base64 decoded
        try {
          if (typeof atob === 'function') {
            jsonStr = atob(payload);
          } else if (typeof Buffer !== 'undefined') {
            jsonStr = Buffer.from(payload, 'base64').toString('utf-8');
          }
        } catch {
          jsonStr = payload;
        }
      }
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === 'object' && parsed.id && parsed.url) {
        result.push({
          id: String(parsed.id),
          clientId: parsed.clientId,
          title: String(parsed.title || 'Untitled Inspiration'),
          url: String(parsed.url),
          platform: parsed.platform || detectVideoPlatform(parsed.url),
          format: parsed.format || detectVideoFormat(parsed.url),
          notes: parsed.notes ? String(parsed.notes) : undefined,
          thumbnailUrl: parsed.thumbnailUrl || null,
          createdAt: parsed.createdAt || new Date().toISOString(),
          createdBy: parsed.createdBy,
        });
      }
    } catch (err) {
      console.warn('Failed to parse inspiration tag:', tag, err);
    }
  }

  // Sort descending by creation date (newest first)
  return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Packs inspiration ideas into client tags, replacing previous inspo: tags.
 */
export function packClientInspirations(
  existingTags: string[] = [],
  inspirations: InspirationIdea[]
): string[] {
  const baseTags = (Array.isArray(existingTags) ? existingTags : []).filter(
    (t) => typeof t === 'string' && !t.startsWith('inspo:')
  );

  const inspoTags = inspirations.map((item) => {
    const serialized = JSON.stringify({
      id: item.id,
      title: item.title,
      url: item.url,
      platform: item.platform,
      format: item.format,
      notes: item.notes,
      thumbnailUrl: item.thumbnailUrl,
      createdAt: item.createdAt,
      createdBy: item.createdBy,
    });

    let b64: string;
    try {
      if (typeof btoa === 'function') {
        b64 = btoa(unescape(encodeURIComponent(serialized)));
      } else if (typeof Buffer !== 'undefined') {
        b64 = Buffer.from(serialized, 'utf-8').toString('base64');
      } else {
        b64 = encodeURIComponent(serialized);
      }
    } catch {
      b64 = encodeURIComponent(serialized);
    }

    return `inspo:${b64}`;
  });

  return [...baseTags, ...inspoTags];
}
