import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // 1. Refresh Session
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;

    // 2. Public Routes (skip checks)
    if (['/login', '/_next', '/api', '/favicon.ico'].some(p => path.startsWith(p))) {
        return response;
    }

    // 3. Unauthenticated -> Login
    if (!user) {
        if (path === '/') return NextResponse.redirect(new URL('/login', request.url));
        // If trying to access protected route
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 4. Role-Based Protection
    // Fetch profile to check role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    const role = profile?.role || 'technician'; // Default strict

    // Manager Zone
    if (path.startsWith('/manager')) {
        if (role !== 'manager' && role !== 'admin') {
            return NextResponse.redirect(new URL('/unauthorized', request.url));
        }
    }

    // Technician Zone
    if (path.startsWith('/tech')) {
        if (role !== 'technician' && role !== 'admin') {
            return NextResponse.redirect(new URL('/unauthorized', request.url));
        }
    }

    // Root redirect based on role
    if (path === '/') {
        if (role === 'manager' || role === 'admin') {
            return NextResponse.redirect(new URL('/manager', request.url));
        } else {
            return NextResponse.redirect(new URL('/tech', request.url));
        }
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
