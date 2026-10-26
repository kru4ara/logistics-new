import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Пути, которые закрыты для водителей (админские)
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
  '/today',
  '/map',
  '/api/export',
  '/api/forwarding',
  '/api/logisat',
  '/api/backfill-rates',
  '/api/check-duplicates',
  '/api/update-rates',
  '/api/trips',
];

// Исключения: эти пути не требуют сессии (cron, вебхуки, публичные API)
const PUBLIC_API_PATHS = [
  '/api/cron',
  '/api/telegram/webhook',
];

// Роли, которым разрешён доступ к админским страницам
const ADMIN_ROLES = ['admin', 'manager'];

export async function middleware(request: NextRequest) {
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

  // 3. Проверяем роль (только для залогиненных и админских путей)
  if (user) {
    // Исключение для driver-docx: пропускаем водителя, 
    // но проверка владельца будет внутри роута!
    if (pathname.startsWith('/api/trips/') && pathname.includes('/driver-docx')) {
      return response;
    }

    const isAdminPath = ADMIN_ONLY_PATHS.some((path) => pathname.startsWith(path));

    if (isAdminPath) {
      // Получаем роль из таблицы profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const rawRole = profile?.role || 'driver';
      const role = String(rawRole).trim().toLowerCase();

      // Если роль не в белом списке — редирект (или 403 для API)
      if (!ADMIN_ROLES.includes(role)) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
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
