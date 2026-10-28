import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { can, isDriverRole, capabilityForRequest } from './lib/roles'

// Исключения: эти пути не требуют сессии (cron, вебхуки, публичные API)
const PUBLIC_API_PATHS = [
  '/api/cron',
  '/api/telegram/webhook',
];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const pathname = request.nextUrl.pathname;

  // 1. Пропускаем публичные API (cron, вебхуки) без проверки сессии
  if (PUBLIC_API_PATHS.some((path) => pathname.startsWith(path))) {
    return response;
  }

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

  // 2. Проверяем сессию
  const { data: { user } } = await supabase.auth.getUser()

  // Не залогинен и не на /login — редирект на /login (или 401 для API)
  if (!user && !pathname.startsWith('/login')) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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

  // 3. Проверяем право доступа к пути.
  //    Требуемое право определяется по префиксу пути и методу запроса —
  //    см. PATH_CAPABILITIES в lib/roles.ts.
  if (user) {
    // Исключение для driver-docx: пропускаем водителя,
    // но проверка владельца будет внутри роута!
    if (pathname.startsWith('/api/trips/') && pathname.includes('/driver-docx')) {
      return response;
    }

    const capability = capabilityForRequest(pathname, request.method)

    if (capability) {
      // Получаем роль из таблицы profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const role = profile?.role || 'driver';

      // Нет права — редирект (или 403 для API)
      if (!can(role, capability)) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const url = request.nextUrl.clone()
        // Водителя — в его раздел, остальных — на главную
        url.pathname = isDriverRole(role) ? '/driver' : '/'
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
