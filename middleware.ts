import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const isDashboardPage = request.nextUrl.pathname.startsWith('/dashboard')
    const isAuthPage = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register')

    // OPTIMIZATION: Prevent 504 Gateway Timeouts on Vercel.
    // supabase.auth.getUser() makes a network request. We ONLY want to do this
    // blocking network call if the user is actually hitting a protected route.
    // For display screens, API calls, and public pages, we bypass this check.
    if (!isDashboardPage && !isAuthPage) {
        return supabaseResponse
    }

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (isDashboardPage && !user) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    if (isAuthPage && user) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        /*
         * Match all routes EXCEPT:
         * - Static files (_next/static, _next/image, images, etc.)
         * - Display API endpoints (high-frequency polling from screens)
         * - Proxy API (public, no auth needed)
         * - Heartbeat API (public, no auth needed)
         */
        '/((?!_next/static|_next/image|favicon.ico|api/display|api/proxy|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
