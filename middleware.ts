import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Пути, которые закрыты для водителей
const ADMIN_ONLY_PATHS = [
  '/reports',
  '/audit',
  '/statistics',
  '/clients',
  '/contractors',
  '/drivers',
  '/trucks',
  '/locations',
  '/forwarding',
  '/fixed-costs',
  '/reminders',
  '/api/export',
  '/api/forwarding',
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
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
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 1. Проверяем сессию
  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Не залогинен и не на /login — редирект на /login
  if (!user && !pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Залогинен и на /login — редирект на главную
  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // 2. Проверяем роль (только для залогиненных)
  if (user) {
    const isAdminPath = ADMIN_ONLY_PATHS.some((path) => pathname.startsWith(path));

    if (isAdminPath) {
      // Получаем роль из таблицы profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const role = profile?.role || 'driver'; // Если нет профиля — безопасный дефолт

      // Если это водитель — редирект на его страницу
      if (role === 'driver') {
        const url = request.nextUrl.clone()
        url.pathname = '/driver'
        return NextResponse.redirect(url)
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
