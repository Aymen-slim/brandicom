import { NextRequest, NextResponse } from 'next/server';
import { enforceAuth, isAdmin } from '@/lib/permissions';
import { fetchAdminPostingAlerts } from '@/lib/data';

function getCorsHeaders(request?: NextRequest) {
  const origin = request?.headers.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  const { user, error } = await enforceAuth();
  if (error || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: corsHeaders }
    );
  }

  if (!isAdmin(user)) {
    return NextResponse.json(
      {
        todayPosts: [],
        overduePosts: [],
        todayShoots: [],
        upcomingPosts: [],
        unreadCount: 0,
      },
      { status: 200, headers: corsHeaders }
    );
  }

  try {
    const alerts = await fetchAdminPostingAlerts();
    const unreadCount = alerts.todayPosts.length + alerts.overduePosts.length;
    return NextResponse.json(
      {
        ...alerts,
        unreadCount,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('Error fetching posting alerts:', err);
    return NextResponse.json(
      { error: 'Failed to fetch posting alerts' },
      { status: 500, headers: corsHeaders }
    );
  }
}

