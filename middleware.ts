import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Защищённые пути (куда нельзя без входа)
const protectedRoutes = ['/', '/trips', '/drivers', '/trucks', '/clients', '/routes', '/reports', '/reminders', '/map', '/fixed-costs', '/driver'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Если пользователь пытается зайти на защищённую страницу
  if (protectedRoutes.includes(pathname)) {
    // Проверяем наличие сессии (cookie Supabase). Её имя обычно начинается с "sb-"
    const sessionCookie = request.cookies.get('sb-access-token') || request.cookies.get('sb-refresh-token');
    
    // Если сессии нет — перенаправляем на логин
    if (!sessionCookie) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

// Указываем, на какие пути распространяется middleware
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
