import { ClientData, ClientMonthlyGoals, DeliverableData } from '@/types';
import { currentMonth } from './period';

/**
 * Extracts client monthly goals from tags:
 * goal:reels:10, goal:posts:4, goal:stories:20, goal:other:6:UGC%20Videos, goal:formats:reels,posts,other
 */
export function extractClientMonthlyGoals(tags: string[] = []): ClientMonthlyGoals {
  let reels = 0;
  let posts = 0;
  let stories = 0;
  let other = 0;
  let otherLabel = 'Other';
  let selectedFormats: string[] | undefined = undefined;

  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (typeof tag !== 'string') continue;
      if (tag.startsWith('goal:reels:')) {
        const parsed = parseInt(tag.slice('goal:reels:'.length), 10);
        if (!isNaN(parsed) && parsed >= 0) reels = parsed;
      } else if (tag.startsWith('goal:posts:')) {
        const parsed = parseInt(tag.slice('goal:posts:'.length), 10);
        if (!isNaN(parsed) && parsed >= 0) posts = parsed;
      } else if (tag.startsWith('goal:stories:')) {
        const parsed = parseInt(tag.slice('goal:stories:'.length), 10);
        if (!isNaN(parsed) && parsed >= 0) stories = parsed;
      } else if (tag.startsWith('goal:other:')) {
        const parts = tag.slice('goal:other:'.length).split(':');
        const num = parseInt(parts[0], 10);
        if (!isNaN(num) && num >= 0) other = num;
        if (parts[1]) {
          try {
            otherLabel = decodeURIComponent(parts[1]);
          } catch {
            otherLabel = parts[1];
          }
        }
      } else if (tag.startsWith('goal:formats:')) {
        const raw = tag.slice('goal:formats:'.length);
        selectedFormats = raw === 'none' ? [] : raw.split(',').filter(Boolean);
      }
    }
  }

  // If selectedFormats wasn't stored yet, automatically select any format that has a positive goal
  if (selectedFormats === undefined) {
    const auto: string[] = [];
    if (reels > 0) auto.push('reels');
    if (posts > 0) auto.push('posts');
    if (stories > 0) auto.push('stories');
    if (other > 0) auto.push('other');
    selectedFormats = auto;
  }

  return { reels, posts, stories, other, otherLabel, selectedFormats };
}

/**
 * Packs monthly goals into tags array, removing any previous goal tags.
 */
export function packClientMonthlyGoals(
  existingTags: string[] = [],
  goals: Partial<ClientMonthlyGoals>
): string[] {
  const base = Array.isArray(existingTags)
    ? existingTags.filter(
        (t) =>
          typeof t === 'string' &&
          !t.startsWith('goal:reels:') &&
          !t.startsWith('goal:posts:') &&
          !t.startsWith('goal:stories:') &&
          !t.startsWith('goal:other:') &&
          !t.startsWith('goal:formats:')
      )
    : [];

  const selected = goals.selectedFormats;
  const reels = goals.reels ?? 0;
  const posts = goals.posts ?? 0;
  const stories = goals.stories ?? 0;
  const other = goals.other ?? 0;
  const otherLabel = (goals.otherLabel || 'Other').trim();

  // Save selected formats list
  if (selected !== undefined) {
    base.push(`goal:formats:${selected.length > 0 ? selected.join(',') : 'none'}`);
  }

  const activeFormats = selected !== undefined ? selected : ['reels', 'posts', 'stories', 'other'];
  if (activeFormats.includes('reels') && reels > 0) base.push(`goal:reels:${reels}`);
  if (activeFormats.includes('posts') && posts > 0) base.push(`goal:posts:${posts}`);
  if (activeFormats.includes('stories') && stories > 0) base.push(`goal:stories:${stories}`);
  if (activeFormats.includes('other') && other > 0) {
    base.push(`goal:other:${other}:${encodeURIComponent(otherLabel)}`);
  }

  return base;
}

export interface GoalItemProgress {
  key: 'reels' | 'posts' | 'stories' | 'other';
  label: string;
  selected: boolean;
  target: number;
  published: number;
  inProgress: number;
  remaining: number;
  percent: number;
  hit: boolean;
}

export interface ClientGoalsProgress {
  period: string;
  daysInMonth: number;
  currentDay: number;
  daysRemaining: number;
  isNearEndOfMonth: boolean;
  hasGoals: boolean;
  allGoalsHit: boolean;
  alertNeeded: boolean;
  isAtRisk: boolean;
  reels: GoalItemProgress;
  posts: GoalItemProgress;
  stories: GoalItemProgress;
  other: GoalItemProgress;
  visibleGoals: GoalItemProgress[];
  totalTarget: number;
  totalPublished: number;
  totalRemaining: number;
  totalPercent: number;
  missingSummary: string;
  alertMessage: string;
}

/**
 * Computes monthly goals progress and alerts for a client.
 */
export function computeClientGoalsProgress(
  client: ClientData,
  deliverables: DeliverableData[] = [],
  customPeriod?: string
): ClientGoalsProgress {
  const period = customPeriod || currentMonth();
  const goals: ClientMonthlyGoals = client.monthlyGoals || extractClientMonthlyGoals(client.tags);

  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr, 10) || new Date().getFullYear();
  const month = parseInt(monthStr, 10) || new Date().getMonth() + 1;

  const daysInMonth = new Date(year, month, 0).getDate();
  const now = new Date();
  const isCurrentMonth = period === currentMonth();
  const currentDay = isCurrentMonth ? now.getDate() : period < currentMonth() ? daysInMonth : 1;
  const daysRemaining = isCurrentMonth ? Math.max(0, daysInMonth - currentDay) : period < currentMonth() ? 0 : daysInMonth;

  // Near end of month is within the last 7 days of the active month
  const isNearEndOfMonth = isCurrentMonth && daysRemaining <= 7;

  // Filter deliverables for this month
  const monthDeliverables = deliverables.filter((d) => {
    if (d.publishDate) return d.publishDate.startsWith(period);
    if (d.scheduledAt) return d.scheduledAt.startsWith(period);
    return d.createdAt ? d.createdAt.startsWith(period) : false;
  });

  const countFor = (predicate: (d: DeliverableData) => boolean) => {
    let published = 0;
    let inProgress = 0;
    for (const d of monthDeliverables) {
      if (predicate(d)) {
        if (d.published || d.status === 'published') {
          published++;
        } else {
          inProgress++;
        }
      }
    }
    return { published, inProgress };
  };

  const selectedFormats = new Set(goals.selectedFormats || []);
  const isReelsSelected = selectedFormats.has('reels');
  const isPostsSelected = selectedFormats.has('posts');
  const isStoriesSelected = selectedFormats.has('stories');
  const isOtherSelected = selectedFormats.has('other');

  // 1. Reels
  const reelsCounts = countFor((d) => d.format === 'reel');
  const reelsTarget = isReelsSelected ? goals.reels || 0 : 0;
  const reelsRemaining = Math.max(0, reelsTarget - reelsCounts.published);
  const reelsHit = reelsTarget === 0 || reelsCounts.published >= reelsTarget;
  const reelsPercent = reelsTarget > 0 ? Math.min(100, Math.round((reelsCounts.published / reelsTarget) * 100)) : (reelsCounts.published > 0 ? 100 : 0);

  // 2. Posts (Photos & Carousels)
  const postsCounts = countFor((d) => d.format === 'photo' || d.format === 'carousel');
  const postsTarget = isPostsSelected ? goals.posts || 0 : 0;
  const postsRemaining = Math.max(0, postsTarget - postsCounts.published);
  const postsHit = postsTarget === 0 || postsCounts.published >= postsTarget;
  const postsPercent = postsTarget > 0 ? Math.min(100, Math.round((postsCounts.published / postsTarget) * 100)) : (postsCounts.published > 0 ? 100 : 0);

  // 3. Stories
  const storiesCounts = countFor((d) => d.format === 'story');
  const storiesTarget = isStoriesSelected ? goals.stories || 0 : 0;
  const storiesRemaining = Math.max(0, storiesTarget - storiesCounts.published);
  const storiesHit = storiesTarget === 0 || storiesCounts.published >= storiesTarget;
  const storiesPercent = storiesTarget > 0 ? Math.min(100, Math.round((storiesCounts.published / storiesTarget) * 100)) : (storiesCounts.published > 0 ? 100 : 0);

  // 4. Other (custom content)
  const otherLabel = (goals.otherLabel || 'Other Content').trim();
  const otherCounts = countFor((d) => {
    // Matches deliverables that aren't reels, standard posts, or stories, or match label
    const f = d.format;
    return f !== 'reel' && f !== 'photo' && f !== 'carousel' && f !== 'story';
  });
  const otherTarget = isOtherSelected ? goals.other || 0 : 0;
  const otherRemaining = Math.max(0, otherTarget - otherCounts.published);
  const otherHit = otherTarget === 0 || otherCounts.published >= otherTarget;
  const otherPercent = otherTarget > 0 ? Math.min(100, Math.round((otherCounts.published / otherTarget) * 100)) : (otherCounts.published > 0 ? 100 : 0);

  const reelsItem: GoalItemProgress = {
    key: 'reels',
    label: 'Reels',
    selected: isReelsSelected,
    target: reelsTarget,
    published: reelsCounts.published,
    inProgress: reelsCounts.inProgress,
    remaining: reelsRemaining,
    percent: reelsPercent,
    hit: reelsHit,
  };

  const postsItem: GoalItemProgress = {
    key: 'posts',
    label: 'Posts (Photos / Carousels)',
    selected: isPostsSelected,
    target: postsTarget,
    published: postsCounts.published,
    inProgress: postsCounts.inProgress,
    remaining: postsRemaining,
    percent: postsPercent,
    hit: postsHit,
  };

  const storiesItem: GoalItemProgress = {
    key: 'stories',
    label: 'Stories',
    selected: isStoriesSelected,
    target: storiesTarget,
    published: storiesCounts.published,
    inProgress: storiesCounts.inProgress,
    remaining: storiesRemaining,
    percent: storiesPercent,
    hit: storiesHit,
  };

  const otherItem: GoalItemProgress = {
    key: 'other',
    label: otherLabel || 'Other Content',
    selected: isOtherSelected,
    target: otherTarget,
    published: otherCounts.published,
    inProgress: otherCounts.inProgress,
    remaining: otherRemaining,
    percent: otherPercent,
    hit: otherHit,
  };

  // Visible goals: ONLY items that are selected and have a target > 0!
  const allItems = [reelsItem, postsItem, storiesItem, otherItem];
  const visibleGoals = allItems.filter((item) => item.selected && item.target > 0);

  // Totals across selected goals
  const totalTarget = visibleGoals.reduce((sum, item) => sum + item.target, 0);
  const totalPublished = visibleGoals.reduce((sum, item) => sum + item.published, 0);
  const totalRemaining = Math.max(0, totalTarget - totalPublished);
  const totalPercent = totalTarget > 0 ? Math.min(100, Math.round((totalPublished / totalTarget) * 100)) : (totalPublished > 0 ? 100 : 0);
  const allGoalsHit = visibleGoals.length > 0 ? visibleGoals.every((item) => item.hit) : true;
  const hasGoals = visibleGoals.length > 0 && totalTarget > 0;

  // Alerts
  const alertNeeded = hasGoals && isNearEndOfMonth && !allGoalsHit;
  const isAtRisk = hasGoals && (!allGoalsHit && (daysRemaining <= 7 || (currentDay > 15 && totalPercent < 50)));

  // Missing summary string in English
  const missingParts: string[] = [];
  for (const item of visibleGoals) {
    if (item.remaining > 0) {
      missingParts.push(`${item.remaining} ${item.label}`);
    }
  }
  const missingSummary = missingParts.length > 0 ? missingParts.join(', ') : 'None';

  const alertMessage = alertNeeded
    ? `⚠️ END-OF-MONTH ALERT: Monthly deliverables goals are at risk for ${client.name}! Only ${daysRemaining} day${daysRemaining > 1 ? 's' : ''} remaining in ${period}. Missing to publish: ${missingSummary}. Immediate action required!`
    : `Monthly goals for ${client.name}: ${totalPublished}/${totalTarget} completed (${totalPercent}%).`;

  return {
    period,
    daysInMonth,
    currentDay,
    daysRemaining,
    isNearEndOfMonth,
    hasGoals,
    allGoalsHit,
    alertNeeded,
    isAtRisk,
    reels: reelsItem,
    posts: postsItem,
    stories: storiesItem,
    other: otherItem,
    visibleGoals,
    totalTarget,
    totalPublished,
    totalRemaining,
    totalPercent,
    missingSummary,
    alertMessage,
  };
}
