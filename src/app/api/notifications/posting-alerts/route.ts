import { NextRequest, NextResponse } from 'next/server';
import { enforceAuth, isAdmin } from '@/lib/permissions';
import { fetchAdminPostingAlerts } from '@/lib/data';

export async function GET(_request: NextRequest) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  if (!isAdmin(user)) {
    return NextResponse.json({
      todayPosts: [],
      overduePosts: [],
      todayShoots: [],
      upcomingPosts: [],
      unreadCount: 0,
    });
  }

  try {
    const alerts = await fetchAdminPostingAlerts();
    const unreadCount = alerts.todayPosts.length + alerts.overduePosts.length;
    return NextResponse.json({
      ...alerts,
      unreadCount,
    });
  } catch (err: any) {
    console.error('Error fetching posting alerts:', err);
    return NextResponse.json({ error: 'Failed to fetch posting alerts' }, { status: 500 });
  }
}
