/**
 * Apify Social Media Metrics Integration
 *
 * Scrapes live engagement metrics (views, likes, comments, shares)
 * for Instagram (using Actor shu8hvrXbJbY3Eb9W / instagram-scraper)
 * and TikTok (using clockworks~tiktok-scraper).
 */

export interface ScrapedSocialMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  thumbnailUrl?: string | null;
  caption?: string | null;
  platform: 'instagram' | 'tiktok' | 'unknown';
}

/**
 * Detect platform based on URL
 */
export function detectPlatformFromUrl(url: string): 'instagram' | 'tiktok' | 'unknown' {
  const clean = url.trim().toLowerCase();
  if (clean.includes('instagram.com') || clean.includes('instagr.am')) {
    return 'instagram';
  }
  if (clean.includes('tiktok.com')) {
    return 'tiktok';
  }
  return 'unknown';
}

/**
 * Normalizes Instagram URLs to canonical format
 */
export function normalizeInstagramUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    // Strip query parameters (like ?igsh=..., ?utm_source=...)
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.trim();
  }
}

/**
 * Fetches post engagement metrics using Apify actors.
 */
export async function fetchPostEngagement(rawUrl: string): Promise<ScrapedSocialMetrics> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error(
      'APIFY_API_TOKEN is not configured in your environment variables. Please add your token from https://console.apify.com/account/integrations.'
    );
  }

  const platform = detectPlatformFromUrl(rawUrl);
  if (platform === 'unknown') {
    throw new Error('Unsupported URL. Please provide a valid Instagram or TikTok post/reel URL.');
  }

  if (platform === 'instagram') {
    return fetchInstagramEngagement(rawUrl, token);
  } else {
    return fetchTikTokEngagement(rawUrl, token);
  }
}

/**
 * Scrape Instagram post / reel using Apify Actor shu8hvrXbJbY3Eb9W (apify/instagram-scraper)
 */
async function fetchInstagramEngagement(rawUrl: string, token: string): Promise<ScrapedSocialMetrics> {
  const cleanUrl = normalizeInstagramUrl(rawUrl);
  const actorId = 'shu8hvrXbJbY3Eb9W'; // apify/instagram-scraper
  const endpoint = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=90`;

  const inputPayload = {
    directUrls: [cleanUrl],
    resultsType: 'posts',
    resultsLimit: 1,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(inputPayload),
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      errorDetail = errJson.error?.message || errJson.message || errorDetail;
    } catch {
      // ignore
    }
    throw new Error(`Apify Instagram scraper failed (${errorDetail})`);
  }

  const items = await response.json();
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('No data found for this Instagram URL. Make sure the post is public and the URL is correct.');
  }

  const post = items[0];

  // Instagram scraper outputs views/plays in videoPlayCount or videoViewCount
  const views = Number(post.videoPlayCount ?? post.videoViewCount ?? 0);
  const likes = Number(post.likesCount ?? post.likes ?? 0);
  const comments = Number(post.commentsCount ?? post.comments ?? 0);
  const shares = Number(post.sharesCount ?? 0);
  const thumbnailUrl = post.displayUrl || post.thumbnailUrl || post.images?.[0] || null;
  const caption = post.caption || null;

  return {
    views,
    likes,
    comments,
    shares,
    thumbnailUrl,
    caption,
    platform: 'instagram',
  };
}

/**
 * Scrape TikTok video using Apify Actor clockworks/tiktok-scraper
 */
async function fetchTikTokEngagement(rawUrl: string, token: string): Promise<ScrapedSocialMetrics> {
  const actorId = 'clockworks~tiktok-scraper';
  const endpoint = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=90`;

  const inputPayload = {
    postURLs: [rawUrl.trim()],
    scrapeRelatedVideos: false,
    maxComments: 0,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(inputPayload),
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      errorDetail = errJson.error?.message || errJson.message || errorDetail;
    } catch {
      // ignore
    }
    throw new Error(`Apify TikTok scraper failed (${errorDetail})`);
  }

  const items = await response.json();
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('No data found for this TikTok URL. Make sure the video is public.');
  }

  const video = items[0];

  const views = Number(video.playCount ?? video.viewsCount ?? 0);
  const likes = Number(video.diggCount ?? video.likesCount ?? 0);
  const comments = Number(video.commentCount ?? video.commentsCount ?? 0);
  const shares = Number(video.shareCount ?? 0);
  const thumbnailUrl = video.videoMeta?.coverUrl || video.covers?.default || null;
  const caption = video.text || null;

  return {
    views,
    likes,
    comments,
    shares,
    thumbnailUrl,
    caption,
    platform: 'tiktok',
  };
}

export interface ScrapedProfileInfo {
  handle: string;
  url: string;
  followers: number;
  profilePicUrl?: string | null;
  platform: 'instagram' | 'tiktok';
}

/**
 * Scrapes profile follower count for an Instagram or TikTok account
 */
export async function fetchProfileFollowers(
  handleOrUrl: string,
  platform: 'instagram' | 'tiktok'
): Promise<ScrapedProfileInfo> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error(
      'APIFY_API_TOKEN is not configured in your environment variables. Please add your token from https://console.apify.com/account/integrations.'
    );
  }

  const raw = handleOrUrl.trim();
  if (platform === 'instagram') {
    let cleanHandle = raw;
    if (cleanHandle.startsWith('http')) {
      try {
        const parsed = new URL(cleanHandle);
        const parts = parsed.pathname.split('/').filter(Boolean);
        cleanHandle = parts[0] || '';
      } catch {
        cleanHandle = cleanHandle.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '');
      }
    } else {
      cleanHandle = cleanHandle.replace(/^@/, '').trim();
    }

    if (!cleanHandle) {
      throw new Error('Please provide a valid Instagram username or profile URL.');
    }

    const profileUrl = `https://www.instagram.com/${cleanHandle}/`;
    const actorId = 'shu8hvrXbJbY3Eb9W'; // apify/instagram-scraper
    const endpoint = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=90`;

    const inputPayload = {
      directUrls: [profileUrl],
      resultsType: 'details',
      resultsLimit: 1,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputPayload),
    });

    if (!response.ok) {
      let errorDetail = `HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        errorDetail = errJson.error?.message || errJson.message || errorDetail;
      } catch {}
      throw new Error(`Apify Instagram scraper failed: ${errorDetail}`);
    }

    const items = await response.json();
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error(`No Instagram profile data found for @${cleanHandle}`);
    }

    const profile = items[0];
    const followers = Number(profile.followersCount ?? profile.subscribersCount ?? 0);
    const profilePicUrl = profile.profilePicUrlHD || profile.profilePicUrl || null;

    return {
      handle: profile.username ? `@${profile.username}` : `@${cleanHandle}`,
      url: profileUrl,
      followers,
      profilePicUrl,
      platform: 'instagram',
    };
  } else {
    // TikTok
    let cleanHandle = raw;
    if (cleanHandle.startsWith('http')) {
      try {
        const parsed = new URL(cleanHandle);
        const parts = parsed.pathname.split('/').filter(Boolean);
        cleanHandle = (parts[0] || '').replace(/^@/, '');
      } catch {
        cleanHandle = cleanHandle.replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, '').replace(/\/.*$/, '');
      }
    } else {
      cleanHandle = cleanHandle.replace(/^@/, '').trim();
    }

    if (!cleanHandle) {
      throw new Error('Please provide a valid TikTok username or profile URL.');
    }

    const profileUrl = `https://www.tiktok.com/@${cleanHandle}`;
    const actorId = 'clockworks~tiktok-scraper';
    const endpoint = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=90`;

    const inputPayload = {
      profiles: [cleanHandle],
      resultsPerPage: 1,
      scrapeRelatedVideos: false,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputPayload),
    });

    if (!response.ok) {
      let errorDetail = `HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        errorDetail = errJson.error?.message || errJson.message || errorDetail;
      } catch {}
      throw new Error(`Apify TikTok scraper failed: ${errorDetail}`);
    }

    const items = await response.json();
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error(`No TikTok profile data found for @${cleanHandle}`);
    }

    const profile = items[0];
    const followers = Number(profile.authorMeta?.fans ?? profile.fans ?? profile.followers ?? 0);
    const profilePicUrl = profile.authorMeta?.avatar || null;

    return {
      handle: `@${cleanHandle}`,
      url: profileUrl,
      followers,
      profilePicUrl,
      platform: 'tiktok',
    };
  }
}
