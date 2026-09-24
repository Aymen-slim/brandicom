import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/clients',
  '/creators',
  '/partners',
  '/calendar',
  '/settings',
  '/finance',
  '/leads',
];
const ADMIN_PREFIXES = ['/finance', '/leads'];

export async function middleware(request: NextRequest) {
  // Handle OPTIONS preflight requests cleanly
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('origin') || '*';
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  }

  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Trigger session refresh for ALL incoming requests so tokens are
  // synchronized between cookies, Server Components, Route Handlers, and the browser.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch (err) {
    console.error('[middleware] Supabase auth error:', err);
    user = null;
  }

  const { pathname } = request.nextUrl;

  // Add CORS headers for API routes
  if (pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    // Never redirect API routes to login HTML
    return response;
  }

  const redirectWithCookies = (targetUrl: URL) => {
    const redirectRes = NextResponse.redirect(targetUrl);
    response.cookies.getAll().forEach((c) => {
      redirectRes.cookies.set(c);
    });
    return redirectRes;
  };

  // Root path routing
  if (pathname === '/') {
    const target = request.nextUrl.clone();
    target.pathname = user ? '/dashboard' : '/login';
    target.search = '';
    return redirectWithCookies(target);
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  const isLogin = pathname === '/login';
  const isAdminPath = ADMIN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  // Unauthenticated user trying to access protected route
  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    return redirectWithCookies(loginUrl);
  }

  // Authenticated user trying to access login page
  if (user && isLogin) {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = '/dashboard';
    dashUrl.search = '';
    return redirectWithCookies(dashUrl);
  }

  // Non-admin user trying to access admin-only route
  if (user && isAdminPath) {
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.role !== 'admin') {
        const dashUrl = request.nextUrl.clone();
        dashUrl.pathname = '/dashboard';
        dashUrl.search = '';
        return redirectWithCookies(dashUrl);
      }
    } catch {
      // If role check fails, leave to page/route authorization
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
