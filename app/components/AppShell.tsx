import { cookies, type UnsafeUnwrappedCookies } from 'next/headers';
import AppShellClient from './AppShellClient';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const cookieStore = (/* @next-codemod-error Await this API and update its callers; remove the temporary UnsafeUnwrappedCookies cast after repairing the migration. */
  cookies() as unknown as UnsafeUnwrappedCookies);

  const role = cookieStore.get('role')?.value ?? null;
  const rawName = cookieStore.get('user_name')?.value;
  const userName = rawName ? decodeURIComponent(rawName) : '';

  return (
    <AppShellClient role={role} userName={userName}>
      {children}
    </AppShellClient>
  );
}
